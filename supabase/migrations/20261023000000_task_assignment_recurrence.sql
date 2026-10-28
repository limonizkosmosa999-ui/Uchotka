ALTER TABLE public.companies
    ADD COLUMN IF NOT EXISTS tax_office_district TEXT,
    ADD COLUMN IF NOT EXISTS curator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS recurrence_rule TEXT
        CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('monthly', 'quarterly', 'yearly')),
    ADD COLUMN IF NOT EXISTS recurrence_series_id UUID;

ALTER TABLE public.companies
    DROP CONSTRAINT IF EXISTS companies_client_type_check;

ALTER TABLE public.companies
    ADD CONSTRAINT companies_client_type_check
    CHECK (client_type IN ('ИП', 'ОсОО', 'ОО', 'ОФ'));

CREATE INDEX IF NOT EXISTS idx_companies_tax_district ON public.companies(tax_office_district);
CREATE INDEX IF NOT EXISTS idx_companies_curator ON public.companies(curator_id);

CREATE TABLE IF NOT EXISTS public.task_assignees (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assignment_role TEXT NOT NULL CHECK (assignment_role IN ('executor', 'controller')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (task_id, user_id, assignment_role)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_role ON public.task_assignees(user_id, assignment_role);
ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_assignees TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_task_assignment(
    p_task_id UUID,
    p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.task_assignees assignment
        WHERE assignment.task_id = p_task_id
          AND assignment.user_id = auth.uid()
          AND (p_roles IS NULL OR assignment.assignment_role = ANY(p_roles))
    )
$$;

CREATE OR REPLACE FUNCTION public.can_read_task_assignees(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT public.is_manager()
        OR public.current_user_has_task_assignment(p_task_id)
        OR EXISTS (
            SELECT 1
            FROM public.tasks task
            JOIN public.companies company ON company.id = task.company_id
            WHERE task.id = p_task_id
              AND company.owner_id = auth.uid()
        )
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_company_task_assignment(p_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
        SELECT EXISTS (
            SELECT 1
            FROM public.tasks task
            JOIN public.task_assignees assignment ON assignment.task_id = task.id
            WHERE task.company_id = p_company_id
              AND assignment.user_id = auth.uid()
        )
$$;

REVOKE ALL ON FUNCTION public.current_user_has_task_assignment(UUID, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_task_assignees(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_company_task_assignment(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_task_assignment(UUID, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_task_assignees(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_has_company_task_assignment(UUID) TO authenticated;

DROP POLICY IF EXISTS "Task assignees select policy" ON public.task_assignees;
CREATE POLICY "Task assignees select policy"
    ON public.task_assignees FOR SELECT TO authenticated
    USING (public.can_read_task_assignees(task_id));

DROP POLICY IF EXISTS "Task assignees write policy" ON public.task_assignees;
CREATE POLICY "Task assignees write policy"
    ON public.task_assignees FOR ALL TO authenticated
    USING (public.is_manager())
    WITH CHECK (public.is_manager());

CREATE TABLE IF NOT EXISTS public.task_recurrence_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    recurrence_rule TEXT NOT NULL CHECK (recurrence_rule IN ('monthly', 'quarterly', 'yearly')),
    next_due_date DATE NOT NULL,
    executor_ids UUID[] NOT NULL,
    controller_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.tasks
    DROP CONSTRAINT IF EXISTS tasks_recurrence_series_id_fkey;
ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_recurrence_series_id_fkey
    FOREIGN KEY (recurrence_series_id)
    REFERENCES public.task_recurrence_series(id)
    ON DELETE SET NULL;

ALTER TABLE public.task_recurrence_series ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_recurrence_series FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_task_recurrence_next_due
    ON public.task_recurrence_series(next_due_date)
    WHERE is_active;

INSERT INTO public.task_assignees (task_id, user_id, assignment_role)
SELECT task.id, company.owner_id, 'executor'
FROM public.tasks task
JOIN public.companies company ON company.id = task.company_id
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy"
    ON public.tasks FOR SELECT TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_task_assignment(tasks.id)
    );

DROP POLICY IF EXISTS "Tasks insert policy" ON public.tasks;
CREATE POLICY "Tasks insert policy"
    ON public.tasks FOR INSERT TO authenticated
    WITH CHECK (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id AND company.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
CREATE POLICY "Tasks update policy"
    ON public.tasks FOR UPDATE TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_task_assignment(tasks.id, ARRAY['executor', 'controller'])
    )
    WITH CHECK (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_task_assignment(tasks.id, ARRAY['executor', 'controller'])
    );

DROP POLICY IF EXISTS "Tasks delete policy" ON public.tasks;
CREATE POLICY "Tasks delete policy"
    ON public.tasks FOR DELETE TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = tasks.company_id AND company.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Companies select policy" ON public.companies;
CREATE POLICY "Companies select policy"
    ON public.companies FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid()
        OR public.is_manager()
        OR public.current_user_has_company_task_assignment(id)
    );

DROP POLICY IF EXISTS "Users can read own profile or manager can read all" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile or agency accountants" ON public.users;
CREATE OR REPLACE FUNCTION public.current_user_manager_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT manager_id FROM public.users WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_user_manager_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_manager_id() TO authenticated;

CREATE POLICY "Users can read team profiles"
    ON public.users FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR public.is_manager()
        OR (
            manager_id IS NOT NULL
            AND manager_id = public.current_user_manager_id()
        )
    );

GRANT EXECUTE ON FUNCTION public.is_manager() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_company_tasks(
    p_company_ids UUID[],
    p_doc_type TEXT,
    p_due_date DATE,
    p_status TEXT,
    p_wait_until DATE,
    p_notes TEXT,
    p_executor_ids UUID[],
    p_controller_ids UUID[],
    p_recurrence_rule TEXT DEFAULT NULL
)
RETURNS SETOF public.tasks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    actor_manager_id UUID;
    actor_is_manager BOOLEAN;
    executor_id UUID;
    controller_id UUID;
    selected_company_id UUID;
    created_task public.tasks;
    series_id UUID;
    interval_months INTEGER;
    unique_company_ids UUID[];
    unique_executor_ids UUID[];
    unique_controller_ids UUID[];
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required';
    END IF;

    IF COALESCE(trim(p_doc_type), '') = '' OR p_due_date IS NULL THEN
        RAISE EXCEPTION 'Task name and due date are required';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('in_progress', 'submitted', 'waiting', 'done') THEN
        RAISE EXCEPTION 'Invalid task status';
    END IF;

    IF p_status = 'waiting' AND p_wait_until IS NULL THEN
        RAISE EXCEPTION 'Wait-until date is required for waiting tasks';
    END IF;

    IF p_recurrence_rule IS NOT NULL AND p_recurrence_rule NOT IN ('monthly', 'quarterly', 'yearly') THEN
        RAISE EXCEPTION 'Invalid recurrence rule';
    END IF;

    SELECT role = 'manager', manager_id
      INTO actor_is_manager, actor_manager_id
    FROM public.users
    WHERE id = actor_id;

    IF actor_is_manager IS NULL THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    SELECT array_agg(DISTINCT company_id)
      INTO unique_company_ids
    FROM unnest(COALESCE(p_company_ids, '{}')) company_id;

    SELECT array_agg(DISTINCT user_id)
      INTO unique_executor_ids
    FROM unnest(COALESCE(p_executor_ids, '{}')) user_id;

    SELECT array_agg(DISTINCT user_id)
      INTO unique_controller_ids
    FROM unnest(COALESCE(p_controller_ids, '{}')) user_id;

    IF COALESCE(cardinality(unique_company_ids), 0) = 0 THEN
        RAISE EXCEPTION 'Select at least one company';
    END IF;

    IF COALESCE(cardinality(unique_executor_ids), 0) = 0 THEN
        RAISE EXCEPTION 'Select at least one executor';
    END IF;

    FOREACH selected_company_id IN ARRAY unique_company_ids LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = selected_company_id
              AND (actor_is_manager OR company.owner_id = actor_id)
        ) THEN
            RAISE EXCEPTION 'Company is unavailable for this user';
        END IF;
    END LOOP;

    FOREACH executor_id IN ARRAY unique_executor_ids LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.users assigned_user
            WHERE assigned_user.id = executor_id
              AND assigned_user.role = 'accountant'
              AND (
                  actor_is_manager
                  OR assigned_user.id = actor_id
                  OR (actor_manager_id IS NOT NULL AND assigned_user.manager_id = actor_manager_id)
              )
        ) THEN
            RAISE EXCEPTION 'Executor is outside the current team';
        END IF;
    END LOOP;

    FOREACH controller_id IN ARRAY COALESCE(unique_controller_ids, '{}') LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.users assigned_user
            WHERE assigned_user.id = controller_id
              AND (
                  assigned_user.role = 'manager'
                  OR (
                      assigned_user.role = 'accountant'
                      AND (
                          actor_is_manager
                          OR assigned_user.id = actor_id
                          OR (actor_manager_id IS NOT NULL AND assigned_user.manager_id = actor_manager_id)
                      )
                  )
              )
        ) THEN
            RAISE EXCEPTION 'Controller is outside the current team';
        END IF;
    END LOOP;

    interval_months := CASE p_recurrence_rule
        WHEN 'monthly' THEN 1
        WHEN 'quarterly' THEN 3
        WHEN 'yearly' THEN 12
        ELSE NULL
    END;

    FOREACH selected_company_id IN ARRAY unique_company_ids LOOP
        INSERT INTO public.tasks (company_id, doc_type, due_date, status, wait_until, notes)
        VALUES (
            selected_company_id,
            trim(p_doc_type),
            p_due_date,
            p_status,
            CASE WHEN p_status = 'waiting' THEN p_wait_until ELSE NULL END,
            NULLIF(trim(COALESCE(p_notes, '')), '')
        )
        RETURNING * INTO created_task;

        FOREACH executor_id IN ARRAY unique_executor_ids LOOP
            INSERT INTO public.task_assignees (task_id, user_id, assignment_role)
            VALUES (created_task.id, executor_id, 'executor');
        END LOOP;

        FOREACH controller_id IN ARRAY COALESCE(unique_controller_ids, '{}') LOOP
            INSERT INTO public.task_assignees (task_id, user_id, assignment_role)
            VALUES (created_task.id, controller_id, 'controller')
            ON CONFLICT DO NOTHING;
        END LOOP;

        IF interval_months IS NOT NULL THEN
            series_id := gen_random_uuid();
            INSERT INTO public.task_recurrence_series (
                id, template_task_id, company_id, recurrence_rule, next_due_date,
                executor_ids, controller_ids
            )
            VALUES (
                series_id, created_task.id, selected_company_id, p_recurrence_rule,
                (p_due_date + make_interval(months => interval_months))::DATE,
                unique_executor_ids, COALESCE(unique_controller_ids, '{}')
            );
            UPDATE public.tasks
            SET recurrence_rule = p_recurrence_rule,
                recurrence_series_id = series_id
            WHERE id = created_task.id
            RETURNING * INTO created_task;
        END IF;

        RETURN NEXT created_task;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_tasks(UUID[], TEXT, DATE, TEXT, DATE, TEXT, UUID[], UUID[], TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_company_tasks(UUID[], TEXT, DATE, TEXT, DATE, TEXT, UUID[], UUID[], TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.generate_recurring_company_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    series RECORD;
    created_count INTEGER := 0;
    interval_months INTEGER;
    new_task public.tasks;
    assigned_user_id UUID;
BEGIN
    FOR series IN
        SELECT recurrence.*
        FROM public.task_recurrence_series recurrence
        WHERE recurrence.is_active
          AND recurrence.next_due_date <= CURRENT_DATE + 30
        ORDER BY recurrence.next_due_date
        FOR UPDATE
    LOOP
        interval_months := CASE series.recurrence_rule
            WHEN 'monthly' THEN 1
            WHEN 'quarterly' THEN 3
            WHEN 'yearly' THEN 12
        END;

        INSERT INTO public.tasks (
            company_id, doc_type, due_date, status, wait_until, notes,
            recurrence_rule, recurrence_series_id
        )
        SELECT
            series.company_id, template.doc_type, series.next_due_date, 'in_progress',
            NULL, template.notes, series.recurrence_rule, series.id
        FROM public.tasks template
        WHERE template.id = series.template_task_id
        RETURNING * INTO new_task;

        FOREACH assigned_user_id IN ARRAY series.executor_ids LOOP
            INSERT INTO public.task_assignees (task_id, user_id, assignment_role)
            VALUES (new_task.id, assigned_user_id, 'executor');
        END LOOP;

        FOREACH assigned_user_id IN ARRAY series.controller_ids LOOP
            INSERT INTO public.task_assignees (task_id, user_id, assignment_role)
            VALUES (new_task.id, assigned_user_id, 'controller')
            ON CONFLICT DO NOTHING;
        END LOOP;

        UPDATE public.task_recurrence_series
        SET next_due_date = (series.next_due_date + make_interval(months => interval_months))::DATE
        WHERE id = series.id;

        created_count := created_count + 1;
    END LOOP;

    RETURN created_count;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_recurring_company_tasks() FROM PUBLIC, authenticated, anon;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'generate-recurring-company-tasks';

SELECT cron.schedule(
    'generate-recurring-company-tasks',
    '0 8 * * *',
    'SELECT public.generate_recurring_company_tasks();'
);
