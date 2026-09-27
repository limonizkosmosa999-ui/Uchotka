-- ==============================================================================
-- СХЕМА БАЗЫ ДАННЫХ ДЛЯ БУХГАЛТЕРСКОГО АГЕНТСТВА
-- Supabase Postgres + Row Level Security (RLS) + Realtime
-- ==============================================================================

-- 1. Справочник систем налогообложения (tax_types)
CREATE TABLE IF NOT EXISTS public.tax_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    rate_description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Пользователи / Профили (users)
-- Связаны с auth.users через id
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('accountant', 'manager')),
    full_name TEXT NOT NULL,
    notification_email TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Компании / Клиенты (companies)
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    inn TEXT NOT NULL,
    client_type TEXT NOT NULL CHECK (client_type IN ('ИП', 'ОсОО')),
    tax_type_id UUID NOT NULL REFERENCES public.tax_types(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Задачи по документам и срокам (tasks)
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'waiting', 'done')) DEFAULT 'in_progress',
    wait_until DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Уведомления (notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ИНДЕКСЫ ДЛЯ ПРОИЗВОДИТЕЛЬНОСТИ
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_companies_owner ON public.companies(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);

-- ==============================================================================
-- ТРИГГЕР ДЛЯ ОБНОВЛЕНИЯ updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tasks_updated_at ON public.tasks;
CREATE TRIGGER set_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ==============================================================================
-- АВТОМАТИЧЕСКОЕ СОЗДАНИЕ ПРОФИЛЯ ПРИ РЕГИСТРАЦИИ (auth.users -> public.users)
-- ==============================================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) ПОЛИТИКИ
-- ==============================================================================

ALTER TABLE public.tax_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Хелпер: проверить, является ли текущий пользователь руководителем (manager)
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid() AND role = 'manager'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 1. tax_types: Все авторизованные пользователи могут читать справочник
CREATE POLICY "Allow read tax_types for authenticated users"
    ON public.tax_types FOR SELECT
    TO authenticated
    USING (true);

-- 2. users:
-- Бухгалтер видит свой профиль; руководитель видит профили всех бухгалтеров для управления
CREATE POLICY "Users can read own profile or manager can read all"
    ON public.users FOR SELECT
    TO authenticated
    USING (id = auth.uid() OR public.is_manager());

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    TO authenticated
    USING (id = auth.uid());

-- 3. companies:
-- Бухгалтер видит и редактирует только свои компании (owner_id = auth.uid());
-- Руководитель видит и может создавать/редактировать все компании.
CREATE POLICY "Companies select policy"
    ON public.companies FOR SELECT
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_manager());

CREATE POLICY "Companies insert policy"
    ON public.companies FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid() OR public.is_manager());

CREATE POLICY "Companies update policy"
    ON public.companies FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_manager())
    WITH CHECK (owner_id = auth.uid() OR public.is_manager());

CREATE POLICY "Companies delete policy"
    ON public.companies FOR DELETE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_manager());

-- 4. tasks:
-- Бухгалтер видит и редактирует задачи по компаниям, которыми владеет.
-- Руководитель видит и может изменять все задачи.
CREATE POLICY "Tasks select policy"
    ON public.tasks FOR SELECT
    TO authenticated
    USING (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );

CREATE POLICY "Tasks insert policy"
    ON public.tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );

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

CREATE POLICY "Tasks delete policy"
    ON public.tasks FOR DELETE
    TO authenticated
    USING (
        public.is_manager() OR EXISTS (
            SELECT 1 FROM public.companies c
            WHERE c.id = tasks.company_id AND c.owner_id = auth.uid()
        )
    );

-- 5. notifications:
-- Пользователь видит и обновляет только свои уведомления
CREATE POLICY "Notifications select policy"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Notifications update policy"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- REALTIME ПУБЛИКАЦИЯ
-- ==============================================================================
-- Включаем Realtime для синхронизации панели руководителя и задач
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'companies'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.companies;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;

-- ==============================================================================
-- НАЧАЛЬНЫЕ ДАННЫЕ (SEED DATA)
-- ==============================================================================
INSERT INTO public.tax_types (name, rate_description)
VALUES
    ('Единый налог', 'Ставка 4% при безналичных расчетах (6% при наличных), освобождение от НДС и налога с продаж'),
    ('Общий режим', 'НДС 12%, налог на прибыль 10%, подоходный налог 10%, отчисления в Соцфонд 17.25%')
ON CONFLICT (name) DO UPDATE
SET rate_description = EXCLUDED.rate_description;
