DROP POLICY IF EXISTS "Tasks delete policy" ON public.tasks;
CREATE POLICY "Tasks delete policy"
    ON public.tasks FOR DELETE TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1
            FROM public.companies company
            WHERE company.id = tasks.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_task_assignment(
            tasks.id,
            ARRAY['executor', 'controller']
        )
    );
