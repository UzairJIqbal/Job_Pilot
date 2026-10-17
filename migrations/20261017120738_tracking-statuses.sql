-- Phase 5: track an application past "applied". Replied (the employer wrote
-- back) and offer join the existing stages; existing rows are unchanged.
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('saved', 'applied', 'replied', 'interviewing', 'offer', 'rejected'));
