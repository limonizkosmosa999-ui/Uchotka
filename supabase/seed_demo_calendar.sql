-- Демонстрационные компании и задачи для панели и календаря.
-- Сначала зарегистрируйте akmaral@gmail.com в Supabase Auth.
-- Запустите этот скрипт в SQL Editor нужного проекта.

BEGIN;

INSERT INTO public.tax_types (name, rate_description)
VALUES
    ('Единый налог', 'Демо-данные'),
    ('Общий режим', 'Демо-данные')
ON CONFLICT (name) DO NOTHING;

DO $$
DECLARE
    demo_user_id UUID;
    simplified_tax_id UUID;
    general_tax_id UUID;
BEGIN
    SELECT id INTO demo_user_id
    FROM public.users
    WHERE lower(email) = lower('akmaral@gmail.com');

    IF demo_user_id IS NULL THEN
        SELECT id INTO demo_user_id
        FROM auth.users
        WHERE lower(email) = lower('akmaral@gmail.com');

        IF demo_user_id IS NULL THEN
            RAISE EXCEPTION
                'Пользователь akmaral@gmail.com не найден. Сначала зарегистрируйте его в Supabase Auth, затем запустите seed_demo_calendar.sql.';
        END IF;

        INSERT INTO public.users (id, email, role, full_name, notification_email)
        SELECT id, email, 'accountant', 'Акмарал (демо)', email
        FROM auth.users
        WHERE id = demo_user_id
        ON CONFLICT (id) DO NOTHING;
    END IF;

    SELECT id INTO simplified_tax_id
    FROM public.tax_types
    WHERE name = 'Единый налог';

    SELECT id INTO general_tax_id
    FROM public.tax_types
    WHERE name = 'Общий режим';

    INSERT INTO public.companies (owner_id, name, inn, client_type, tax_type_id, notes)
    SELECT demo_user_id, sample.name, sample.inn, sample.client_type, sample.tax_type_id, sample.notes
    FROM (
        VALUES
            ('ОсОО «Ала-Тоо Маркет»', '999000000001', 'ОсОО', general_tax_id, 'Демо-компания для проверки панели задач и календаря'),
            ('ИП Акмарал — кофейня', '999000000002', 'ИП', simplified_tax_id, 'Демо-компания на едином налоге'),
            ('ОсОО «Тянь-Шань Логистик»', '999000000003', 'ОсОО', general_tax_id, 'Демо-компания с отчетами по нескольким срокам'),
            ('ИП «Зеленый двор»', '999000000004', 'ИП', simplified_tax_id, 'Демо-компания для проверки цветовых статусов')
    ) AS sample(name, inn, client_type, tax_type_id, notes)
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.companies existing
        WHERE existing.owner_id = demo_user_id
          AND existing.inn = sample.inn
    );

    INSERT INTO public.tasks (company_id, doc_type, due_date, status, wait_until, notes)
    SELECT
        company.id,
        sample.doc_type,
        CURRENT_DATE + sample.due_in_days,
        sample.status,
        CASE
            WHEN sample.wait_in_days IS NULL THEN NULL
            ELSE CURRENT_DATE + sample.wait_in_days
        END,
        sample.notes
    FROM (
        VALUES
            ('999000000001', 'Срочный отчет — просрочен', -2, 'in_progress', NULL::INTEGER, '[ДЕМО КАЛЕНДАРЯ] Красный: просроченная задача'),
            ('999000000001', 'Срочный отчет — срок сегодня', 0, 'in_progress', NULL::INTEGER, '[ДЕМО КАЛЕНДАРЯ] Красный: выполнить сегодня'),
            ('999000000002', 'Отчет на этой неделе', 3, 'in_progress', NULL::INTEGER, '[ДЕМО КАЛЕНДАРЯ] Оранжевый: срок в течение 7 дней'),
            ('999000000003', 'Отчет с дальним сроком', 20, 'in_progress', NULL::INTEGER, '[ДЕМО КАЛЕНДАРЯ] Желтый: срок позже недели'),
            ('999000000003', 'Ожидаем ответ налоговой', 4, 'waiting', 2, '[ДЕМО КАЛЕНДАРЯ] Зеленый: задача ожидает ответа'),
            ('999000000004', 'Отчет уже отправлен', 5, 'submitted', NULL::INTEGER, '[ДЕМО КАЛЕНДАРЯ] Зеленый: отчет отправлен'),
            ('999000000004', 'Завершенная задача', -1, 'done', NULL::INTEGER, '[ДЕМО КАЛЕНДАРЯ] Зеленый: задача выполнена')
    ) AS sample(inn, doc_type, due_in_days, status, wait_in_days, notes)
    JOIN public.companies company
      ON company.owner_id = demo_user_id
     AND company.inn = sample.inn
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.tasks existing
        WHERE existing.company_id = company.id
          AND existing.doc_type = sample.doc_type
          AND existing.notes = sample.notes
    );
END
$$;

COMMIT;
