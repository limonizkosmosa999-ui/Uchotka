DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
CREATE POLICY "Tasks update policy"
    ON public.tasks FOR UPDATE TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_task_assignment(tasks.id, ARRAY['executor', 'controller'])
    )
    WITH CHECK (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_task_assignment(tasks.id, ARRAY['executor', 'controller'])
    );
