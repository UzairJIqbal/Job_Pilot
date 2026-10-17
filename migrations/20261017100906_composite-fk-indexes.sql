-- Index the composite (child_id, user_id) foreign keys from init-schema so
-- parent deletes and joins don't scan. These supersede the single-column ones.
DROP INDEX public.jobs_run_idx;
DROP INDEX public.agent_logs_run_idx;
DROP INDEX public.agent_logs_job_idx;

CREATE INDEX jobs_run_user_idx       ON public.jobs (run_id, user_id);
CREATE INDEX agent_logs_run_user_idx ON public.agent_logs (run_id, user_id);
CREATE INDEX agent_logs_job_user_idx ON public.agent_logs (job_id, user_id);
