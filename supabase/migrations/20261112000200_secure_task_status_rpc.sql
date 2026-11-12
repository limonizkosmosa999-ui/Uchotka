CREATE OR REPLACE FUNCTION public.update_task_status(
    p_task_id UUID,
    p_status TEXT,
    p_wait_until DATE
)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    updated_task public.tasks;
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('in_progress', 'submitted', 'waiting', 'done') THEN
        RAISE EXCEPTION 'Invalid task status';
    END IF;

    IF p_status = 'waiting' AND p_wait_until IS NULL THEN
        RAISE EXCEPTION 'Wait-until date is required for waiting tasks';
    END IF;

    IF NOT (
        public.is_manager()
        OR EXISTS (
            SELECT 1
            FROM public.companies company
            WHERE company.id = (
                SELECT task.company_id
                FROM public.tasks task
                WHERE task.id = p_task_id
            )
              AND company.owner_id = actor_id
        )
        OR public.current_user_has_task_assignment(
            p_task_id,
            ARRAY['executor', 'controller']
        )
    ) THEN
        RAISE EXCEPTION 'You are not allowed to update this task';
    END IF;

    UPDATE public.tasks
       SET status = p_status,
           wait_until = p_wait_until,
           updated_at = timezone('utc'::text, now())
     WHERE id = p_task_id
     RETURNING * INTO updated_task;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found';
    END IF;

    RETURN updated_task;
END;
$$;

REVOKE ALL ON FUNCTION public.update_task_status(UUID, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_task_status(UUID, TEXT, DATE) TO authenticated;
