CREATE OR REPLACE FUNCTION public.notify_task_assignee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    task_document_type TEXT;
    task_due_date DATE;
    notification_message TEXT;
BEGIN
    SELECT task.doc_type, task.due_date
      INTO task_document_type, task_due_date
    FROM public.tasks task
    WHERE task.id = NEW.task_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cannot notify assignee: task % was not found', NEW.task_id;
    END IF;

    notification_message := CASE NEW.assignment_role
        WHEN 'executor' THEN format(
            'Вам назначена задача «%s» как исполнитель. Срок: %s.',
            task_document_type,
            to_char(task_due_date, 'DD.MM.YYYY')
        )
        WHEN 'controller' THEN format(
            'Вас назначили контролирующим по задаче «%s». Срок: %s.',
            task_document_type,
            to_char(task_due_date, 'DD.MM.YYYY')
        )
    END;

    INSERT INTO public.notifications (user_id, task_id, message)
    VALUES (NEW.user_id, NEW.task_id, notification_message);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_task_assignee_after_insert ON public.task_assignees;
CREATE TRIGGER notify_task_assignee_after_insert
AFTER INSERT ON public.task_assignees
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assignee();

INSERT INTO public.notifications (user_id, task_id, message)
SELECT
    assignment.user_id,
    task.id,
    CASE assignment.assignment_role
        WHEN 'executor' THEN format(
            'Вам назначена задача «%s» как исполнитель. Срок: %s.',
            task.doc_type,
            to_char(task.due_date, 'DD.MM.YYYY')
        )
        WHEN 'controller' THEN format(
            'Вас назначили контролирующим по задаче «%s». Срок: %s.',
            task.doc_type,
            to_char(task.due_date, 'DD.MM.YYYY')
        )
    END
FROM public.task_assignees assignment
JOIN public.tasks task ON task.id = assignment.task_id
WHERE NOT EXISTS (
    SELECT 1
    FROM public.notifications existing
    WHERE existing.user_id = assignment.user_id
      AND existing.task_id = task.id
      AND existing.message = CASE assignment.assignment_role
          WHEN 'executor' THEN format(
              'Вам назначена задача «%s» как исполнитель. Срок: %s.',
              task.doc_type,
              to_char(task.due_date, 'DD.MM.YYYY')
          )
          WHEN 'controller' THEN format(
              'Вас назначили контролирующим по задаче «%s». Срок: %s.',
              task.doc_type,
              to_char(task.due_date, 'DD.MM.YYYY')
          )
      END
);
