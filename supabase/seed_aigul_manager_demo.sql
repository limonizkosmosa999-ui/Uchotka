-- DEMO ONLY: creates three confirmed demo logins and sample work for Aigul's panel.
-- Run after all migrations, from Supabase SQL Editor as project owner.
-- Demo accountant credentials (each account has the same temporary password):
--   demo.accountant1@example.com / Demo-2026-Staff!
--   demo.accountant2@example.com / Demo-2026-Staff!
--   demo.accountant3@example.com / Demo-2026-Staff!

BEGIN;

DO $$
DECLARE
    v_manager_id UUID;
    v_accountant_id UUID;
    v_company_id UUID;
    v_account_number INTEGER := 0;
    v_company_one_inn TEXT;
    v_company_two_inn TEXT;
    demo_account RECORD;
    simplified_tax_id UUID;
    general_tax_id UUID;
BEGIN
    SELECT id INTO v_manager_id
    FROM public.users
    WHERE lower(email) = lower('aigul1111@gmail.com');

    IF v_manager_id IS NULL THEN
        SELECT id INTO v_manager_id
        FROM auth.users
        WHERE lower(email) = lower('aigul1111@gmail.com');

        IF v_manager_id IS NULL THEN
            RAISE EXCEPTION
                'Aigul account aigul1111@gmail.com was not found. Register this account first, then rerun this seed.';
        END IF;

    END IF;

    INSERT INTO public.users (id, email, role, full_name, notification_email)
    SELECT
        id,
        email,
        'manager',
        COALESCE(raw_user_meta_data->>'full_name', 'Айгуль'),
        email
    FROM auth.users
    WHERE id = v_manager_id
    ON CONFLICT (id) DO UPDATE
    SET role = 'manager',
        email = EXCLUDED.email;

    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('role', 'manager')
    WHERE id = v_manager_id;

    UPDATE public.users
    SET manager_id = NULL
    WHERE id = v_manager_id;

    INSERT INTO public.tax_types (name, rate_description)
    VALUES
        ('Единый налог', 'Демонстрационный налоговый режим'),
        ('Общий режим', 'Демонстрационный налоговый режим')
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO simplified_tax_id FROM public.tax_types WHERE name = 'Единый налог';
    SELECT id INTO general_tax_id FROM public.tax_types WHERE name = 'Общий режим';

    FOR demo_account IN
        SELECT *
        FROM (VALUES
            ('demo.accountant1@example.com', 'Демо бухгалтер — Алина', 'Проверка отчетности и клиентских дедлайнов'),
            ('demo.accountant2@example.com', 'Демо бухгалтер — Нурзат', 'Проверка сверок и задач в ожидании'),
            ('demo.accountant3@example.com', 'Демо бухгалтер — Эльмира', 'Проверка архива и просроченных задач')
        ) AS demo(email, full_name, description)
    LOOP
        v_account_number := v_account_number + 1;
        v_company_one_inn := '9900000000000' || v_account_number::TEXT;
        v_company_two_inn := '9800000000000' || v_account_number::TEXT;

        SELECT id INTO v_accountant_id
        FROM auth.users
        WHERE lower(email) = lower(demo_account.email);

        IF v_accountant_id IS NULL THEN
            v_accountant_id := gen_random_uuid();
            INSERT INTO auth.users (
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data
            )
            VALUES (
                v_accountant_id,
                'authenticated',
                'authenticated',
                demo_account.email,
                extensions.crypt('Demo-2026-Staff!', extensions.gen_salt('bf')),
                now(),
                '{"provider":"email","providers":["email"]}'::jsonb,
                jsonb_build_object('full_name', demo_account.full_name, 'role', 'accountant')
            );
        END IF;

        INSERT INTO public.users (id, email, role, full_name, notification_email, manager_id)
        VALUES (v_accountant_id, demo_account.email, 'accountant', demo_account.full_name, demo_account.email, v_manager_id)
        ON CONFLICT (id) DO UPDATE
        SET role = EXCLUDED.role,
            full_name = EXCLUDED.full_name,
            notification_email = EXCLUDED.notification_email,
            manager_id = EXCLUDED.manager_id;

        IF NOT EXISTS (
            SELECT 1 FROM public.companies
            WHERE owner_id = v_accountant_id AND inn = v_company_one_inn
        ) THEN
            INSERT INTO public.companies (owner_id, name, inn, client_type, tax_type_id, notes)
            VALUES (
                v_accountant_id,
                'ОсОО «Ала-Тоо Партнер»',
                v_company_one_inn,
                'ОсОО',
                general_tax_id,
                'Демо-клиент: ' || demo_account.description
            );
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM public.companies
            WHERE owner_id = v_accountant_id AND inn = v_company_two_inn
        ) THEN
            INSERT INTO public.companies (owner_id, name, inn, client_type, tax_type_id, notes)
            VALUES (
                v_accountant_id,
                'ИП «Сары-Озон»',
                v_company_two_inn,
                'ИП',
                simplified_tax_id,
                'Второй демонстрационный клиент бухгалтера'
            );
        END IF;

        SELECT id INTO v_company_id
        FROM public.companies
        WHERE owner_id = v_accountant_id AND inn = v_company_one_inn;

        INSERT INTO public.tasks (company_id, doc_type, due_date, status, notes)
        SELECT v_company_id, sample.doc_type, CURRENT_DATE + sample.due_in_days,
               sample.status, '[ДЕМО AIGUL] ' || sample.notes
        FROM (VALUES
            ('Ежемесячный налоговый отчет', -1, 'in_progress', 'Просроченная задача — красный индикатор'),
            ('Сверка первичных документов', 0, 'in_progress', 'Срок сегодня — срочная задача'),
            ('Подготовить зарплатную ведомость', 3, 'in_progress', 'Срок на этой неделе'),
            ('Квартальный отчет', 15, 'in_progress', 'Плановая задача на будущую дату'),
            ('Получить подтверждение от клиента', 5, 'waiting', 'Задача ожидает ответ'),
            ('Проверка принятой отчетности', -3, 'done', 'Выполненная задача для истории')
        ) AS sample(doc_type, due_in_days, status, notes)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.tasks existing
            WHERE existing.company_id = v_company_id
              AND existing.doc_type = sample.doc_type
              AND existing.notes = '[ДЕМО AIGUL] ' || sample.notes
        );

        SELECT id INTO v_company_id
        FROM public.companies
        WHERE owner_id = v_accountant_id AND inn = v_company_two_inn;

        INSERT INTO public.tasks (company_id, doc_type, due_date, status, wait_until, notes)
        SELECT v_company_id, sample.doc_type, CURRENT_DATE + sample.due_in_days,
               sample.status, sample.wait_in_days, '[ДЕМО AIGUL] ' || sample.notes
        FROM (VALUES
            ('Отчет по единому налогу', 7, 'in_progress', NULL::date, 'Срок в течение следующей недели'),
            ('Ответ налогового органа', 2, 'waiting', CURRENT_DATE + 4, 'Ожидается ответ налоговой'),
            ('Сверка с контрагентом', 1, 'submitted', NULL::date, 'Отчет отправлен')
        ) AS sample(doc_type, due_in_days, status, wait_in_days, notes)
        WHERE NOT EXISTS (
            SELECT 1 FROM public.tasks existing
            WHERE existing.company_id = v_company_id
              AND existing.doc_type = sample.doc_type
              AND existing.notes = '[ДЕМО AIGUL] ' || sample.notes
        );
    END LOOP;
END;
$$;

COMMIT;
