ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);

CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    description TEXT NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    company_name TEXT,
    task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    doc_type TEXT,
    meta JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
    ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_created
    ON public.activity_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_created
    ON public.activity_logs(task_id, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;

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
            WHERE company.id = tasks.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_company_task_assignment(company_id)
    );

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
              AND (
                  actor_is_manager
                  OR company.owner_id = actor_id
                  OR public.current_user_has_company_task_assignment(company.id)
              )
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

DROP POLICY IF EXISTS "Companies select policy" ON public.companies;
CREATE POLICY "Companies select policy"
    ON public.companies FOR SELECT TO authenticated
    USING (
        owner_id = auth.uid()
        OR public.is_manager()
        OR public.current_user_has_company_task_assignment(id)
    );

DROP POLICY IF EXISTS "Activity logs select policy" ON public.activity_logs;
CREATE POLICY "Activity logs select policy"
    ON public.activity_logs FOR SELECT TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_manager()
        OR (
            company_id IS NOT NULL
            AND (
                EXISTS (
                    SELECT 1 FROM public.companies company
                    WHERE company.id = activity_logs.company_id
                      AND company.owner_id = auth.uid()
                )
                OR public.current_user_has_company_task_assignment(company_id)
            )
        )
    );

DROP POLICY IF EXISTS "Activity logs insert policy" ON public.activity_logs;
CREATE POLICY "Activity logs insert policy"
    ON public.activity_logs FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND (
            public.is_manager()
            OR company_id IS NULL
            OR EXISTS (
                SELECT 1 FROM public.companies company
                WHERE company.id = activity_logs.company_id
                  AND company.owner_id = auth.uid()
            )
            OR public.current_user_has_company_task_assignment(company_id)
        )
    );

DROP POLICY IF EXISTS "Users can read team profiles" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile or manager can read all" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile or agency accountants" ON public.users;
CREATE POLICY "Users can read team profiles"
    ON public.users FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR public.is_manager()
        OR id = public.current_user_manager_id()
        OR (
            manager_id IS NOT NULL
            AND manager_id = public.current_user_manager_id()
        )
        OR EXISTS (
            SELECT 1
            FROM public.task_assignees my_assignment
            JOIN public.task_assignees related_assignment
              ON related_assignment.task_id = my_assignment.task_id
            WHERE my_assignment.user_id = auth.uid()
              AND related_assignment.user_id = users.id
        )
        OR EXISTS (
            SELECT 1
            FROM public.tasks task
            JOIN public.companies company ON company.id = task.company_id
            WHERE task.created_by = users.id
              AND (
                  company.owner_id = auth.uid()
                  OR public.current_user_has_company_task_assignment(company.id)
              )
        )
    );

CREATE OR REPLACE FUNCTION public.set_task_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NOT NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_task_creator_before_insert ON public.tasks;
CREATE TRIGGER set_task_creator_before_insert
BEFORE INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_task_creator();

CREATE OR REPLACE FUNCTION public.write_task_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    actor_name TEXT;
    company_label TEXT;
    action_label TEXT;
    description_text TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT company.name INTO company_label
        FROM public.companies company
        WHERE company.id = OLD.company_id;

        SELECT full_name INTO actor_name FROM public.users WHERE id = actor_id;
        INSERT INTO public.activity_logs (
            user_id, user_name, action_type, description,
            company_name, doc_type, meta
        )
        VALUES (
            actor_id, COALESCE(actor_name, 'Система'), 'delete_task',
            format('Удалена задача «%s».', OLD.doc_type),
            company_label, OLD.doc_type,
            jsonb_build_object('task_id', OLD.id, 'company_id', OLD.company_id)
        );
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.is_escalated IS DISTINCT FROM OLD.is_escalated THEN
            action_label := CASE
                WHEN NEW.is_escalated THEN 'escalate'
                ELSE 'resolve_escalation'
            END;
            description_text := CASE
                WHEN NEW.is_escalated THEN format(
                    'Задача «%s» эскалирована: %s.',
                    NEW.doc_type,
                    COALESCE(NEW.escalation_reason, 'требуется контроль')
                )
                ELSE format('С задачи «%s» снята эскалация.', NEW.doc_type)
            END;
        ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
            action_label := 'status_change';
            description_text := format(
                'Изменён статус задачи «%s»: %s → %s.',
                NEW.doc_type, OLD.status, NEW.status
            );
        ELSIF ROW(NEW.doc_type, NEW.due_date, NEW.wait_until, NEW.notes, NEW.recurrence_rule)
            IS DISTINCT FROM ROW(OLD.doc_type, OLD.due_date, OLD.wait_until, OLD.notes, OLD.recurrence_rule) THEN
            action_label := 'update_task';
            description_text := format('Изменены данные задачи «%s».', NEW.doc_type);
        ELSE
            RETURN NEW;
        END IF;
    ELSE
        action_label := 'create_task';
        description_text := format('Создана задача «%s».', NEW.doc_type);
    END IF;

    SELECT company.name INTO company_label
    FROM public.companies company
    WHERE company.id = NEW.company_id;

    SELECT full_name INTO actor_name FROM public.users WHERE id = actor_id;
    INSERT INTO public.activity_logs (
        user_id, user_name, action_type, description,
        company_id, company_name, task_id, doc_type
    )
    VALUES (
        actor_id, COALESCE(actor_name, 'Система'), action_label, description_text,
        NEW.company_id, company_label, NEW.id, NEW.doc_type
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS write_task_activity_after_insert ON public.tasks;
CREATE TRIGGER write_task_activity_after_insert
AFTER INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.write_task_activity();

DROP TRIGGER IF EXISTS write_task_activity_after_update ON public.tasks;
CREATE TRIGGER write_task_activity_after_update
AFTER UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.write_task_activity();

DROP TRIGGER IF EXISTS write_task_activity_after_delete ON public.tasks;
CREATE TRIGGER write_task_activity_after_delete
AFTER DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.write_task_activity();

CREATE OR REPLACE FUNCTION public.write_task_assignment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    actor_name TEXT;
    assigned_name TEXT;
    task_document_type TEXT;
    company_label TEXT;
    role_label TEXT;
BEGIN
    SELECT full_name INTO actor_name FROM public.users WHERE id = actor_id;
    SELECT full_name INTO assigned_name FROM public.users WHERE id = NEW.user_id;
    SELECT task.doc_type, company.name
      INTO task_document_type, company_label
    FROM public.tasks task
    JOIN public.companies company ON company.id = task.company_id
    WHERE task.id = NEW.task_id;

    role_label := CASE NEW.assignment_role
        WHEN 'executor' THEN 'исполнителем'
        WHEN 'controller' THEN 'контролирующим'
    END;

    INSERT INTO public.activity_logs (
        user_id, user_name, action_type, description,
        company_id, company_name, task_id, doc_type, meta
    )
    SELECT
        actor_id, COALESCE(actor_name, 'Система'), 'assign_task',
        format('%s назначен(а) %s по задаче «%s».',
            COALESCE(assigned_name, 'Сотрудник'), role_label, task_document_type),
        task.company_id, company_label, task.id, task_document_type,
        jsonb_build_object(
            'assigned_user_id', NEW.user_id,
            'assigned_user_name', assigned_name,
            'assignment_role', NEW.assignment_role
        )
    FROM public.tasks task
    WHERE task.id = NEW.task_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS write_task_assignment_activity_after_insert ON public.task_assignees;
CREATE TRIGGER write_task_assignment_activity_after_insert
AFTER INSERT ON public.task_assignees
FOR EACH ROW EXECUTE FUNCTION public.write_task_assignment_activity();

CREATE OR REPLACE FUNCTION public.write_company_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    actor_name TEXT;
    action_label TEXT;
    description_text TEXT;
BEGIN
    SELECT full_name INTO actor_name FROM public.users WHERE id = actor_id;

    IF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_logs (
            user_id, user_name, action_type, description,
            company_name, meta
        )
        VALUES (
            actor_id, COALESCE(actor_name, 'Система'), 'company_delete',
            format('Удалена компания «%s».', OLD.name),
            OLD.name, jsonb_build_object('company_id', OLD.id)
        );
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        action_label := 'company_create';
        description_text := format('Добавлена компания «%s».', NEW.name);
    ELSE
        IF ROW(NEW.name, NEW.inn, NEW.client_type, NEW.tax_type_id, NEW.notes)
            IS NOT DISTINCT FROM ROW(OLD.name, OLD.inn, OLD.client_type, OLD.tax_type_id, OLD.notes) THEN
            RETURN NEW;
        END IF;
        action_label := 'company_update';
        description_text := format('Изменены данные компании «%s».', NEW.name);
    END IF;

    INSERT INTO public.activity_logs (
        user_id, user_name, action_type, description, company_id, company_name
    )
    VALUES (
        actor_id, COALESCE(actor_name, 'Система'), action_label,
        description_text, NEW.id, NEW.name
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS write_company_activity_after_insert ON public.companies;
CREATE TRIGGER write_company_activity_after_insert
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.write_company_activity();

DROP TRIGGER IF EXISTS write_company_activity_after_update ON public.companies;
CREATE TRIGGER write_company_activity_after_update
AFTER UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.write_company_activity();

DROP TRIGGER IF EXISTS write_company_activity_after_delete ON public.companies;
CREATE TRIGGER write_company_activity_after_delete
AFTER DELETE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.write_company_activity();

DROP POLICY IF EXISTS "Company documents select policy" ON public.company_documents;
CREATE POLICY "Company documents select policy"
    ON public.company_documents FOR SELECT TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_company_task_assignment(company_id)
    );

DROP POLICY IF EXISTS "Company documents insert policy" ON public.company_documents;
CREATE POLICY "Company documents insert policy"
    ON public.company_documents FOR INSERT TO authenticated
    WITH CHECK (
        created_by = auth.uid()
        AND (
            public.is_manager()
            OR EXISTS (
                SELECT 1 FROM public.companies company
                WHERE company.id = company_documents.company_id
                  AND company.owner_id = auth.uid()
            )
            OR public.current_user_has_company_task_assignment(company_id)
        )
    );

DROP POLICY IF EXISTS "Company documents update policy" ON public.company_documents;
CREATE POLICY "Company documents update policy"
    ON public.company_documents FOR UPDATE TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_company_task_assignment(company_id)
    )
    WITH CHECK (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_company_task_assignment(company_id)
    );

DROP POLICY IF EXISTS "Company documents delete policy" ON public.company_documents;
CREATE POLICY "Company documents delete policy"
    ON public.company_documents FOR DELETE TO authenticated
    USING (
        public.is_manager()
        OR EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id = company_documents.company_id
              AND company.owner_id = auth.uid()
        )
        OR public.current_user_has_company_task_assignment(company_id)
    );

DROP POLICY IF EXISTS "Company document files select policy" ON storage.objects;
CREATE POLICY "Company document files select policy"
    ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'company-documents'
        AND EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id::TEXT = (storage.foldername(name))[1]
              AND (
                  company.owner_id = auth.uid()
                  OR public.is_manager()
                  OR public.current_user_has_company_task_assignment(company.id)
              )
        )
    );

DROP POLICY IF EXISTS "Company document files insert policy" ON storage.objects;
CREATE POLICY "Company document files insert policy"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'company-documents'
        AND EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id::TEXT = (storage.foldername(name))[1]
              AND (
                  company.owner_id = auth.uid()
                  OR public.is_manager()
                  OR public.current_user_has_company_task_assignment(company.id)
              )
        )
    );

DROP POLICY IF EXISTS "Company document files delete policy" ON storage.objects;
CREATE POLICY "Company document files delete policy"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'company-documents'
        AND EXISTS (
            SELECT 1 FROM public.companies company
            WHERE company.id::TEXT = (storage.foldername(name))[1]
              AND (
                  company.owner_id = auth.uid()
                  OR public.is_manager()
              )
        )
    );

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
          AND tablename = 'activity_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
    END IF;
END
$$;
