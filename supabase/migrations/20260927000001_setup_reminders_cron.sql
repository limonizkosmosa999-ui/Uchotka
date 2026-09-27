-- ==============================================================================
-- НАСТРОЙКА PG_CRON И РАСПИСАНИЯ НАПОМИНАНИЙ
-- ==============================================================================

-- Включаем расширение pg_cron (доступно в Supabase Dashboard -> Database -> Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Опция 1: Вызов Supabase Edge Function через pg_net ежедневно в 08:00 утра UTC (14:00 местное время)
-- Замените YOUR_PROJECT_REF и YOUR_ANON_KEY на значения из настроек проекта
/*
SELECT cron.schedule(
    'daily-deadline-reminders-edge-function',
    '0 8 * * *',
    $$
    SELECT net.http_post(
        url:='https://YOUR_PROJECT_REF.functions.supabase.co/send-reminders',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_OR_ANON_KEY"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
    $$
);
*/

-- Опция 2: Встроенная в базу данных функция генерации уведомлений (работает автономно прямо в Postgres)
CREATE OR REPLACE FUNCTION public.check_upcoming_deadlines_and_notify()
RETURNS VOID AS $$
DECLARE
    r RECORD;
    msg TEXT;
BEGIN
    -- Находим задачи за 3 дня и за 1 день до сдачи
    FOR r IN
        SELECT
            t.id AS task_id,
            t.doc_type,
            t.due_date,
            c.name AS company_name,
            c.owner_id AS user_id,
            (t.due_date - CURRENT_DATE) AS days_left
        FROM public.tasks t
        JOIN public.companies c ON c.id = t.company_id
        WHERE t.status NOT IN ('done', 'submitted')
          AND t.due_date IN (CURRENT_DATE + INTERVAL '1 day', CURRENT_DATE + INTERVAL '3 days')
    LOOP
        msg := format(
            'Напоминание: Срок сдачи "%s" по компании "%s" истекает через %s дн. (%s)',
            r.doc_type,
            r.company_name,
            r.days_left,
            r.due_date
        );

        -- Проверяем, чтобы за последние 24 часа не создавалось дублирующее уведомление для этой задачи
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications n
            WHERE n.task_id = r.task_id
              AND n.created_at >= (now() - INTERVAL '24 hours')
        ) THEN
            INSERT INTO public.notifications (user_id, task_id, message, is_read)
            VALUES (r.user_id, r.task_id, msg, false);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Запуск локальной процедуры каждый день в 08:00
SELECT cron.schedule(
    'daily-deadline-notifications-db',
    '0 8 * * *',
    'SELECT public.check_upcoming_deadlines_and_notify();'
);
