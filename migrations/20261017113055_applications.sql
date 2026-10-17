-- Tailoring: the answers a user gives on every application form, and one
-- application per job holding the tailored resume, cover letter, screening
-- answers and (later) the submission receipt.
--
-- Users edit and approve their own applications. Only the submission worker
-- (admin key) moves an application into submitting / submitted / failed or
-- writes the receipt, so a user can't fake a submission from the browser.
--
-- Tailored resumes are stored in the private `resumes` bucket at
-- `{user_id}/tailored/{job_id}.pdf`.

-- ---------------------------------------------------------------------------
-- application_profiles: one row per user
-- ---------------------------------------------------------------------------
CREATE TABLE public.application_profiles (
  user_id               uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Countries the user can already work in without sponsorship.
  authorized_countries  text[]  NOT NULL DEFAULT '{}',
  needs_sponsorship     boolean,
  willing_to_relocate   boolean,
  notice_period         text,
  earliest_start_date   date,
  github_url            text,
  pronouns              text,
  -- EEO answers. "decline" picks the form's "decline to answer" option.
  gender                text NOT NULL DEFAULT 'decline',
  race_ethnicity        text NOT NULL DEFAULT 'decline',
  veteran_status        text NOT NULL DEFAULT 'decline',
  disability_status     text NOT NULL DEFAULT 'decline',
  -- [{ "question": string, "answer": string }] reused across applications.
  saved_answers         jsonb NOT NULL DEFAULT '[]'
                          CHECK (jsonb_typeof(saved_answers) = 'array'),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- applications: one per job
-- ---------------------------------------------------------------------------
CREATE TABLE public.applications (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id               uuid NOT NULL,
  state                text NOT NULL DEFAULT 'needs_review'
                         CHECK (state IN ('needs_review', 'approved', 'submitting', 'submitted', 'failed', 'skipped')),
  -- Structured resume content the PDF was rendered from.
  tailored_resume      jsonb,
  -- Before/after of every edit, shown for review.
  resume_diff          jsonb,
  tailored_resume_url  text,
  tailored_resume_key  text,
  cover_letter         text,
  -- Form questions as read from the ATS, and the answers to send.
  questions            jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(questions) = 'array'),
  answers              jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(answers) = 'array'),
  -- Written by the submission worker only.
  receipt              jsonb,
  screenshot_key       text,
  error                text,
  attempts             integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  approved_at          timestamptz,
  submitted_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id),
  FOREIGN KEY (job_id, user_id) REFERENCES public.jobs (id, user_id) ON DELETE CASCADE,
  CONSTRAINT applications_files_in_own_folder CHECK (
    (tailored_resume_key IS NULL OR tailored_resume_key LIKE user_id::text || '/%')
    AND (screenshot_key IS NULL OR screenshot_key LIKE user_id::text || '/%')
  )
);

CREATE INDEX applications_user_state_idx ON public.applications (user_id, state, updated_at DESC);
CREATE INDEX applications_job_user_idx   ON public.applications (job_id, user_id);

-- ---------------------------------------------------------------------------
-- Guard: browser sessions can review, approve, skip and retry, nothing more.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.applications_user_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.state <> 'needs_review' THEN
      RAISE EXCEPTION 'New applications start in needs_review';
    END IF;
    NEW.receipt := NULL;
    NEW.screenshot_key := NULL;
    NEW.error := NULL;
    NEW.attempts := 0;
    NEW.approved_at := NULL;
    NEW.submitted_at := NULL;
    RETURN NEW;
  END IF;

  IF OLD.state IN ('submitting', 'submitted') AND NEW.state IS DISTINCT FROM OLD.state THEN
    RAISE EXCEPTION 'Application is already %', OLD.state;
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state
     AND NEW.state NOT IN ('needs_review', 'approved', 'skipped') THEN
    RAISE EXCEPTION 'Only the submission worker can set state %', NEW.state;
  END IF;

  NEW.receipt        := OLD.receipt;
  NEW.screenshot_key := OLD.screenshot_key;
  NEW.attempts       := OLD.attempts;
  NEW.submitted_at   := OLD.submitted_at;
  NEW.approved_at    := CASE
    WHEN NEW.state = 'approved' AND OLD.state <> 'approved' THEN now()
    WHEN NEW.state = 'approved' THEN OLD.approved_at
    ELSE NULL
  END;
  -- Retrying a failed application clears the old error.
  NEW.error := CASE WHEN NEW.state = 'approved' AND OLD.state = 'failed' THEN NULL ELSE OLD.error END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER applications_user_guard
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.applications_user_guard();

CREATE TRIGGER application_profiles_updated_at
  BEFORE UPDATE ON public.application_profiles
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and RLS: own rows only
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.application_profiles, public.applications FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE         ON public.application_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications         TO authenticated;

ALTER TABLE public.application_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications         ENABLE ROW LEVEL SECURITY;

CREATE POLICY application_profiles_select ON public.application_profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY application_profiles_insert ON public.application_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY application_profiles_update ON public.application_profiles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY applications_select ON public.applications FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY applications_insert ON public.applications FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY applications_update ON public.applications FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
-- Deleting while the worker is mid-submit would orphan the receipt.
CREATE POLICY applications_delete ON public.applications FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()) AND state NOT IN ('submitting', 'submitted'));
