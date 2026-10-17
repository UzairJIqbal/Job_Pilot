-- Job Pilot initial schema.
--
-- Every app table is owned by one auth user. All access goes through the
-- signed-in user's session (SSR client), so RLS restricts each table to the
-- caller's own rows. "Keywords" live on profiles (skills, job_titles_seeking)
-- and "applications" are jobs.status — there are no separate tables for them.
--
-- Storage: the private `resumes` bucket is created with
--   npx -y @insforge/cli storage create-bucket resumes --private
-- Objects are stored at `{user_id}/resume.pdf`.

-- ---------------------------------------------------------------------------
-- profiles: one row per user, id = auth user id
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                  uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  full_name           text,
  phone               text,
  location            text,
  linkedin_url        text,
  portfolio_url       text,
  work_authorization  text,
  current_title       text,
  experience_level    text,
  years_experience    integer CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 80),
  skills              text[]  NOT NULL DEFAULT '{}',
  industries          text[]  NOT NULL DEFAULT '{}',
  work_experience     jsonb   NOT NULL DEFAULT '[]',
  education           jsonb,
  job_titles_seeking  text[]  NOT NULL DEFAULT '{}',
  remote_preference   text,
  salary_expectation  text,
  preferred_locations text[]  NOT NULL DEFAULT '{}',
  cover_letter_tone   text,
  resume_pdf_url      text,
  is_complete         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- The resume routes download whatever object this URL names, so it must
  -- point inside the owner's own folder: .../buckets/resumes/objects/{id}/...
  -- The SDK URL-encodes the key, hence the %2F normalisation.
  CONSTRAINT profiles_resume_in_own_folder CHECK (
    resume_pdf_url IS NULL
    OR replace(lower(resume_pdf_url), '%2f', '/')
       LIKE '%/buckets/resumes/objects/' || id::text || '/%'
  )
);

-- ---------------------------------------------------------------------------
-- agent_runs: one row per job search
-- ---------------------------------------------------------------------------
CREATE TABLE public.agent_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'running'
                       CHECK (status IN ('running', 'completed', 'failed')),
  job_title_searched text,
  location_searched  text,
  jobs_found         integer NOT NULL DEFAULT 0 CHECK (jobs_found >= 0),
  started_at         timestamptz NOT NULL DEFAULT now(),
  completed_at       timestamptz,
  -- Lets child tables use (run_id, user_id) FKs so a row can't hang off
  -- another user's run.
  UNIQUE (id, user_id)
);

-- ---------------------------------------------------------------------------
-- jobs: scored listings; status doubles as the application pipeline
-- ---------------------------------------------------------------------------
CREATE TABLE public.jobs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id             uuid,
  source             text NOT NULL DEFAULT 'search' CHECK (source IN ('search', 'url')),
  source_url         text,
  external_apply_url text,
  title              text NOT NULL,
  company            text NOT NULL DEFAULT '',
  location           text,
  salary             text,
  job_type           text,
  about_role         text,
  responsibilities   text[] NOT NULL DEFAULT '{}',
  requirements       text[] NOT NULL DEFAULT '{}',
  nice_to_have       text[] NOT NULL DEFAULT '{}',
  benefits           text[] NOT NULL DEFAULT '{}',
  about_company      text,
  match_score        integer CHECK (match_score IS NULL OR match_score BETWEEN 0 AND 100),
  match_reason       text,
  matched_skills     text[] NOT NULL DEFAULT '{}',
  missing_skills     text[] NOT NULL DEFAULT '{}',
  company_research   jsonb,
  interview_prep     jsonb,
  email_templates    jsonb,
  status             text NOT NULL DEFAULT 'saved'
                       CHECK (status IN ('saved', 'applied', 'interviewing', 'rejected')),
  found_at           timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  FOREIGN KEY (run_id, user_id) REFERENCES public.agent_runs (id, user_id)
    ON DELETE SET NULL (run_id)
);

-- ---------------------------------------------------------------------------
-- agent_logs: append-only activity feed for runs and per-job agents
-- ---------------------------------------------------------------------------
CREATE TABLE public.agent_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Defaulted because agent error logging inserts without user_id.
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  run_id     uuid,
  job_id     uuid,
  level      text NOT NULL DEFAULT 'info'
               CHECK (level IN ('info', 'success', 'warning', 'error')),
  message    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (run_id, user_id) REFERENCES public.agent_runs (id, user_id)
    ON DELETE SET NULL (run_id),
  FOREIGN KEY (job_id, user_id) REFERENCES public.jobs (id, user_id)
    ON DELETE SET NULL (job_id)
);

-- ---------------------------------------------------------------------------
-- Indexes (match the app's user-scoped queries)
-- ---------------------------------------------------------------------------
CREATE INDEX jobs_user_match_idx      ON public.jobs (user_id, match_score DESC);
CREATE INDEX jobs_user_found_idx      ON public.jobs (user_id, found_at DESC);
CREATE INDEX jobs_user_title_co_idx   ON public.jobs (user_id, title, company);
CREATE INDEX jobs_run_idx             ON public.jobs (run_id);
CREATE INDEX agent_runs_user_idx      ON public.agent_runs (user_id, started_at DESC);
CREATE INDEX agent_logs_user_idx      ON public.agent_logs (user_id, created_at DESC);
CREATE INDEX agent_logs_run_idx       ON public.agent_logs (run_id);
CREATE INDEX agent_logs_job_idx       ON public.agent_logs (job_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anon; authenticated gets only what the app uses.
-- RLS below narrows every operation to the caller's own rows.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.profiles, public.agent_runs, public.jobs, public.agent_logs FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE         ON public.profiles   TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.agent_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs       TO authenticated;
GRANT SELECT, INSERT                 ON public.agent_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- Row level security: own rows only
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

CREATE POLICY agent_runs_select ON public.agent_runs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY agent_runs_insert ON public.agent_runs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY agent_runs_update ON public.agent_runs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY agent_logs_select ON public.agent_logs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY agent_logs_insert ON public.agent_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
