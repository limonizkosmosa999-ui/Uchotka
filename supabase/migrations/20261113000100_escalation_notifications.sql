CREATE OR REPLACE FUNCTION public.notify_manager_on_task_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    actor_label TEXT;
    notification_message TEXT;
BEGIN
    IF NEW.is_escalated IS DISTINCT FROM TRUE
       OR OLD.is_escalated IS DISTINCT FROM FALSE THEN
        RETURN NEW;
    END IF;

    actor_label := COALESCE(
        NEW.escalated_by,
        (SELECT user_profile.full_name
         FROM public.users user_profile
         WHERE user_profile.id = auth.uid()),
        'Сотрудник'
    );

    notification_message := format(
        'Задача «%s» эскалирована сотрудником %s. Причина: %s',
        NEW.doc_type,
        actor_label,
        COALESCE(NEW.escalation_reason, 'требуется срочный контроль')
    );

    INSERT INTO public.notifications (user_id, task_id, message)
    SELECT manager.id, NEW.id, notification_message
    FROM public.users manager
    WHERE manager.role = 'manager';

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_manager_on_task_escalation_after_update ON public.tasks;
CREATE TRIGGER notify_manager_on_task_escalation_after_update
AFTER UPDATE OF is_escalated ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_manager_on_task_escalation();

INSERT INTO public.notifications (user_id, task_id, message)
SELECT
    manager.id,
    task.id,
    format(
        'Задача «%s» эскалирована сотрудником %s. Причина: %s',
        task.doc_type,
        COALESCE(task.escalated_by, 'Сотрудник'),
        COALESCE(task.escalation_reason, 'требуется срочный контроль')
    )
FROM public.tasks task
CROSS JOIN public.users manager
WHERE task.is_escalated IS TRUE
  AND manager.role = 'manager'
  AND NOT EXISTS (
      SELECT 1
      FROM public.notifications notification
      WHERE notification.user_id = manager.id
        AND notification.task_id = task.id
        AND notification.message = format(
            'Задача «%s» эскалирована сотрудником %s. Причина: %s',
            task.doc_type,
            COALESCE(task.escalated_by, 'Сотрудник'),
            COALESCE(task.escalation_reason, 'требуется срочный контроль')
        )
  );
