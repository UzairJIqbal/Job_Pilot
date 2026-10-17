-- Stop before submit. Approving an application no longer sends it: the worker
-- first fills the form without attaching or submitting anything, saves a
-- screenshot and parks the row in `ready_to_send`. Only the user's explicit
-- Send click (ready_to_send -> approved) records send_confirmed_at, and only
-- a confirmed row can be claimed for a live send.
--
-- Hard limits, enforced here whatever the worker passes:
--   * at most 10 live sends per user per 24 hours
--   * job match score of at least 70
--   * no send without a recorded approval (approved_at)

ALTER TABLE public.applications DROP CONSTRAINT applications_state_check;
ALTER TABLE public.applications ADD CONSTRAINT applications_state_check
  CHECK (state IN ('needs_review', 'approved', 'ready_to_send', 'submitting', 'submitted', 'failed', 'skipped'));

ALTER TABLE public.applications
  -- When the user clicked Send on the preview. Cleared by any later edit.
  ADD COLUMN send_confirmed_at timestamptz,
  -- What the current claim is for: 'preview' never touches submit.
  ADD COLUMN claim_mode text CHECK (claim_mode IN ('preview', 'send'));

-- ---------------------------------------------------------------------------
-- Guard: the user may confirm a send only from ready_to_send, and any change
-- to what would be sent drops the confirmation.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.applications_user_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_content_changed boolean;
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
    NEW.claim_mode := NULL;
    NEW.send_confirmed_at := NULL;
    RETURN NEW;
  END IF;

  IF OLD.state IN ('submitting', 'submitted') AND NEW.state IS DISTINCT FROM OLD.state THEN
    RAISE EXCEPTION 'Application is already %', OLD.state;
  END IF;
  IF NEW.state IS DISTINCT FROM OLD.state
     AND NEW.state NOT IN ('needs_review', 'approved', 'skipped') THEN
    RAISE EXCEPTION 'Only the submission worker can set state %', NEW.state;
  END IF;

  v_content_changed :=
       NEW.cover_letter        IS DISTINCT FROM OLD.cover_letter
    OR NEW.answers             IS DISTINCT FROM OLD.answers
    OR NEW.questions           IS DISTINCT FROM OLD.questions
    OR NEW.tailored_resume_key IS DISTINCT FROM OLD.tailored_resume_key;

  -- A Send click must confirm exactly what was previewed.
  IF v_content_changed AND NEW.state = 'approved' AND OLD.state = 'ready_to_send' THEN
    RAISE EXCEPTION 'The draft changed after the preview. Save the edit, then send after the new preview';
  END IF;
  -- Editing a previewed draft makes the preview stale: preview it again.
  IF v_content_changed AND OLD.state = 'ready_to_send' AND NEW.state = 'ready_to_send' THEN
    NEW.state := 'approved';
  END IF;

  NEW.receipt        := OLD.receipt;
  NEW.screenshot_key := OLD.screenshot_key;
  NEW.attempts       := OLD.attempts;
  NEW.submitted_at   := OLD.submitted_at;
  NEW.claimed_by     := OLD.claimed_by;
  NEW.claimed_at     := OLD.claimed_at;
  NEW.claim_mode     := OLD.claim_mode;
  NEW.approved_at    := CASE
    WHEN NEW.state = 'approved' AND OLD.state = 'ready_to_send' THEN OLD.approved_at
    WHEN NEW.state = 'approved' AND OLD.state <> 'approved' THEN now()
    WHEN NEW.state = 'approved' THEN OLD.approved_at
    ELSE NULL
  END;
  -- The only way to confirm a send: ready_to_send -> approved, unchanged.
  NEW.send_confirmed_at := CASE
    WHEN v_content_changed THEN NULL
    WHEN NEW.state = 'approved' AND OLD.state = 'ready_to_send' THEN now()
    WHEN NEW.state = 'approved' AND OLD.state = 'approved' THEN OLD.send_confirmed_at
    ELSE NULL
  END;
  -- Retrying a failed application clears the old error.
  NEW.error := CASE WHEN NEW.state = 'approved' AND OLD.state = 'failed' THEN NULL ELSE OLD.error END;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- claim_next_application: replaces the Phase 4 version.
-- ---------------------------------------------------------------------------
DROP FUNCTION public.claim_next_application(text, integer, integer);

CREATE FUNCTION public.claim_next_application(
  p_worker               text,
  p_daily_cap            integer DEFAULT 10,
  p_min_match_score      integer DEFAULT 70,
  p_require_confirmation boolean DEFAULT true,
  p_stale_minutes        integer DEFAULT 20
) RETURNS SETOF public.applications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- The worker may tighten these, never loosen them.
  v_cap       integer := LEAST(GREATEST(COALESCE(p_daily_cap, 10), 0), 10);
  v_min_score integer := GREATEST(COALESCE(p_min_match_score, 70), 70);
  v_confirm   boolean := COALESCE(p_require_confirmation, true);
  v_candidate record;
  v_used      integer;
  v_mode      text;
BEGIN
  -- A stale preview sent nothing: hand it back to the queue.
  UPDATE public.applications
     SET state = 'approved', claimed_by = NULL, claim_mode = NULL
   WHERE state = 'submitting' AND claim_mode = 'preview'
     AND claimed_at < now() - make_interval(mins => p_stale_minutes);

  -- A stale send may or may not have gone through: ask the user to check.
  UPDATE public.applications
     SET state = 'failed',
         error = 'The worker stopped while sending this. Check the company''s site before retrying: it may have gone through.',
         claimed_by = NULL
   WHERE state = 'submitting' AND claim_mode IS DISTINCT FROM 'preview'
     AND claimed_at < now() - make_interval(mins => p_stale_minutes);

  -- Below the match bar: fail with a reason instead of leaving it queued.
  UPDATE public.applications a
     SET state = 'failed',
         error = format('This job''s match score (%s) is below the minimum of %s for automatic sending. Apply on the company''s site if you still want it.',
                        COALESCE(j.match_score::text, 'none'), v_min_score),
         send_confirmed_at = NULL
    FROM public.jobs j
   WHERE j.id = a.job_id AND j.user_id = a.user_id
     AND a.state = 'approved'
     AND (j.match_score IS NULL OR j.match_score < v_min_score);

  FOR v_candidate IN
    SELECT a.id, a.user_id, a.send_confirmed_at
      FROM public.applications a
      JOIN public.jobs j ON j.id = a.job_id AND j.user_id = a.user_id
     WHERE a.state = 'approved'
       AND a.approved_at IS NOT NULL
       AND j.match_score >= v_min_score
     ORDER BY a.approved_at, a.created_at
     FOR UPDATE OF a SKIP LOCKED
     LIMIT 50
  LOOP
    v_mode := CASE WHEN v_confirm AND v_candidate.send_confirmed_at IS NULL THEN 'preview' ELSE 'send' END;

    IF v_mode = 'send' THEN
      -- Serialise sends per user so two workers can't both slip under the cap.
      PERFORM pg_advisory_xact_lock(hashtextextended('claim:' || v_candidate.user_id::text, 0));

      SELECT count(*) INTO v_used
        FROM public.applications s
       WHERE s.user_id = v_candidate.user_id
         AND ((s.state = 'submitting' AND s.claim_mode = 'send')
              OR (s.state = 'submitted' AND s.submitted_at > now() - interval '24 hours'));

      CONTINUE WHEN v_used >= v_cap;
    END IF;

    RETURN QUERY
      UPDATE public.applications
         SET state = 'submitting',
             attempts = attempts + 1,
             claimed_by = p_worker,
             claimed_at = now(),
             claim_mode = v_mode,
             error = NULL
       WHERE id = v_candidate.id
      RETURNING *;
    RETURN;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_next_application(text, integer, integer, boolean, integer) FROM PUBLIC, anon, authenticated;
