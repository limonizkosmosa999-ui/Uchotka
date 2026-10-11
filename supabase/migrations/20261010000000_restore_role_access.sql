CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, role, notification_email)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'role', 'accountant'),
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT UPDATE ON public.users TO authenticated;

DROP POLICY IF EXISTS "Users can read own profile or agency accountants" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile or manager can read all" ON public.users;
CREATE POLICY "Users can read own profile or manager can read all"
    ON public.users FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "Companies select policy" ON public.companies;
CREATE POLICY "Companies select policy"
    ON public.companies FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "Companies insert policy" ON public.companies;
CREATE POLICY "Companies insert policy"
    ON public.companies FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "Companies update policy" ON public.companies;
CREATE POLICY "Companies update policy"
    ON public.companies FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_manager())
    WITH CHECK (owner_id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "Companies delete policy" ON public.companies;
CREATE POLICY "Companies delete policy"
    ON public.companies FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_manager());

DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tasks insert policy" ON public.tasks;
CREATE POLICY "Tasks insert policy"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
CREATE POLICY "Tasks update policy"
    ON public.tasks FOR UPDATE
    TO authenticated
    USING (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tasks delete policy" ON public.tasks;
CREATE POLICY "Tasks delete policy"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );
