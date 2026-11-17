-- ==============================================================================
-- МИГРАЦИЯ: УДАЛЕНИЕ АККАУНТА С ПЕРИОДОМ ОТСРОЧКИ 3 ДНЯ (GRACE PERIOD)
-- ==============================================================================

-- 1. Добавляем поля отсроченного удаления в таблицу пользователей
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS scheduled_for_deletion_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Индекс для быстрого поиска аккаунтов, готовых к удалению
CREATE INDEX IF NOT EXISTS idx_users_scheduled_deletion 
ON public.users (scheduled_for_deletion_at) 
WHERE scheduled_for_deletion_at IS NOT NULL;

-- 3. Функция для запроса на удаление аккаунта текущим пользователем
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    scheduled_date TIMESTAMPTZ;
    user_name TEXT;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    scheduled_date := timezone('utc'::text, now()) + INTERVAL '3 days';

    -- Обновляем статус пользователя
    UPDATE public.users
    SET deletion_requested_at = timezone('utc'::text, now()),
        scheduled_for_deletion_at = scheduled_date
    WHERE id = current_user_id
    RETURNING full_name INTO user_name;

    -- Логируем действие в журнал аудита
    INSERT INTO public.activity_logs (
        user_id,
        user_name,
        action_type,
        description,
        meta
    )
    VALUES (
        current_user_id,
        COALESCE(user_name, 'Пользователь'),
        'update_task',
        format('Запрошено удаление аккаунта %s. Окончательное удаление данных запланировано на %s.', COALESCE(user_name, ''), to_char(scheduled_date, 'DD.MM.YYYY HH24:MI:SS')),
        jsonb_build_object('event', 'account_deletion_requested', 'scheduled_for', scheduled_date)
    );

    RETURN jsonb_build_object(
        'success', true,
        'deletion_requested_at', timezone('utc'::text, now()),
        'scheduled_for_deletion_at', scheduled_date
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

-- 4. Функция для отмены запроса на удаление аккаунта (если пользователь вернулся до истечения 3 дней)
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Пользователь не авторизован';
    END IF;

    UPDATE public.users
    SET deletion_requested_at = NULL,
        scheduled_for_deletion_at = NULL
    WHERE id = current_user_id;

    RETURN jsonb_build_object('success', true, 'message', 'Запрос на удаление аккаунта успешно отменён');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

-- 5. Процедура окончательной очистки данных аккаунтов, у которых истек 3-дневный срок
CREATE OR REPLACE FUNCTION public.purge_scheduled_deleted_accounts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user RECORD;
    fallback_manager_id UUID;
BEGIN
    -- Находим резервного менеджера для передачи закрепленных компаний
    SELECT id INTO fallback_manager_id
    FROM public.users
    WHERE role = 'manager'
      AND scheduled_for_deletion_at IS NULL
    ORDER BY created_at ASC
    LIMIT 1;

    -- Перебираем всех пользователей, чей 3-дневный срок истёк
    FOR target_user IN
        SELECT id, email, full_name
        FROM public.users
        WHERE scheduled_for_deletion_at IS NOT NULL
          AND scheduled_for_deletion_at <= timezone('utc'::text, now())
    LOOP
        -- А. Переназначаем компании или открепляем
        IF fallback_manager_id IS NOT NULL AND fallback_manager_id <> target_user.id THEN
            UPDATE public.companies
            SET owner_id = fallback_manager_id
            WHERE owner_id = target_user.id;
        END IF;

        UPDATE public.companies
        SET curator_id = NULL
        WHERE curator_id = target_user.id;

        -- Б. Удаляем назначения на задачи
        DELETE FROM public.task_assignees
        WHERE user_id = target_user.id;

        -- В. Удаляем личные уведомления
        DELETE FROM public.notifications
        WHERE user_id = target_user.id;

        -- Г. Отвязываем задачи и документы (чтобы не нарушать целостность истории)
        UPDATE public.tasks
        SET created_by = NULL
        WHERE created_by = target_user.id;

        UPDATE public.company_documents
        SET created_by = NULL
        WHERE created_by = target_user.id;

        -- Д. Фиксируем окончательное удаление в журнале действий
        INSERT INTO public.activity_logs (
            user_name,
            action_type,
            description,
            meta
        )
        VALUES (
            'Система',
            'delete_task',
            format('Все персональные данные аккаунта %s (%s) окончательно удалены после истечения 3 дней отсрочки.', target_user.full_name, target_user.email),
            jsonb_build_object('event', 'account_purged', 'purged_user_id', target_user.id, 'email', target_user.email)
        );

        -- Е. Удаляем профиль пользователя из public.users
        DELETE FROM public.users
        WHERE id = target_user.id;

        -- Ж. Удаляем пользователя из auth.users (полное удаление учётных данных Supabase Auth)
        DELETE FROM auth.users
        WHERE id = target_user.id;
    END LOOP;
END;
$$;

-- 6. Планирование автоматического ежедневного удаления через pg_cron (каждую ночь в 03:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Удаляем предыдущую задачу cron с таким именем, если она существовала
        PERFORM cron.unschedule('purge-deleted-accounts-daily')
        WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-accounts-daily'
        );

        PERFORM cron.schedule(
            'purge-deleted-accounts-daily',
            '0 3 * * *',
            'SELECT public.purge_scheduled_deleted_accounts();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron не настроен или нет прав суперпользователя. Запуск purge_scheduled_deleted_accounts может выполняться внешней функцией.';
END;
$$;
