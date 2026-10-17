-- Submission worker: claims approved applications one at a time, fills the
-- employer's form in a browser and records a receipt.
--
-- claim_next_application() is the only way an application enters
-- `submitting`. It enforces the per-user daily cap and recovers claims left
-- behind by a worker that died mid-run. Only the admin key can call it.

ALTER TABLE public.applications
  ADD COLUMN claimed_by text,
  ADD COLUMN claimed_at timestamptz;

CREATE INDEX applications_approved_queue_idx
  ON public.applications (approved_at, created_at)
  WHERE state = 'approved';

CREATE INDEX applications_user_submitted_idx
  ON public.applications (user_id, submitted_at)
  WHERE state IN ('submitting', 'submitted');

-- ---------------------------------------------------------------------------
-- Guard: same rules as before, and the claim columns are worker-only too.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.applications_user_guard() RETURNS trigger
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
    NEW.claimed_by := NULL;
    NEW.claimed_at := NULL;
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
  NEW.claimed_by     := OLD.claimed_by;
  NEW.claimed_at     := OLD.claimed_at;
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

-- ---------------------------------------------------------------------------
-- claim_next_application: oldest approval first, skipping users at their cap.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.claim_next_application(
  p_worker        text,
  p_daily_cap     integer DEFAULT 25,
  p_stale_minutes integer DEFAULT 20
) RETURNS SETOF public.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate record;
  v_used      integer;
BEGIN
  -- A claim this old means the worker died. The form may or may not have
  -- gone through, so hand it back to the user instead of retrying blind.
  UPDATE public.applications
     SET state = 'failed',
         error = 'The worker stopped while sending this. Check the company''s site before retrying: it may have gone through.',
         claimed_by = NULL
   WHERE state = 'submitting'
     AND claimed_at < now() - make_interval(mins => p_stale_minutes);

  FOR v_candidate IN
    SELECT a.id, a.user_id
      FROM public.applications a
     WHERE a.state = 'approved'
     ORDER BY a.approved_at NULLS LAST, a.created_at
     FOR UPDATE OF a SKIP LOCKED
     LIMIT 50
  LOOP
    -- Serialise claims per user so two workers can't both slip under the cap.
    PERFORM pg_advisory_xact_lock(hashtextextended('claim:' || v_candidate.user_id::text, 0));

    SELECT count(*) INTO v_used
      FROM public.applications s
     WHERE s.user_id = v_candidate.user_id
       AND (s.state = 'submitting'
            OR (s.state = 'submitted' AND s.submitted_at > now() - interval '24 hours'));

    IF v_used < p_daily_cap THEN
      RETURN QUERY
        UPDATE public.applications
           SET state = 'submitting',
               attempts = attempts + 1,
               claimed_by = p_worker,
               claimed_at = now(),
               error = NULL
         WHERE id = v_candidate.id
        RETURNING *;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_application(text, integer, integer) FROM PUBLIC, anon, authenticated;
