import { Task, UserProfile } from '../types';
import { updateTask } from './api';
import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns';

/**
 * Проверяет список задач на критерии автоматической эскалации:
 * 1) Срок сдачи через <= 2 дня или уже просрочен
 * 2) Статус всё ещё "В работе" (in_progress) или "Ожидает" (waiting)
 * 3) Задача ещё не была эскалирована
 */
export async function evaluateTaskEscalations(
  tasks: Task[],
  currentUser?: UserProfile | null
): Promise<{ escalatedTasks: Task[]; newlyEscalatedCount: number }> {
  const today = startOfDay(new Date());
  const newlyEscalated: Task[] = [];

  for (const task of tasks) {
    // Пропускаем завершенные и отправленные задачи
    if (task.status === 'done' || task.status === 'submitted') continue;

    // Если уже эскалирована, пропускаем повторную
    if (task.is_escalated) continue;

    try {
      const dueDate = startOfDay(parseISO(task.due_date));
      const daysLeft = differenceInCalendarDays(dueDate, today);

      // Критерий риска: срок горит (осталось 1-2 дня или уже просрочено)
      if (daysLeft <= 1) {
        const reason = daysLeft < 0
          ? `Срок сдачи просрочен на ${Math.abs(daysLeft)} дн., отчётность не сдана!`
          : daysLeft === 0
          ? 'Дедлайн сегодня! Задача требует срочного вмешательства.'
          : 'До дедлайна остался 1 день! Высокий риск срыва сроков ГНС.';

        const updated = await updateTask(task.id, {
          is_escalated: true,
          escalated_at: new Date().toISOString(),
          escalation_reason: reason,
          escalated_by: currentUser?.full_name || 'Автоматическая система контроля сроков',
        });

        newlyEscalated.push(updated);
      }
    } catch (e) {
      console.warn('Error evaluating task escalation for task', task.id, e);
    }
  }

  return {
    escalatedTasks: newlyEscalated,
    newlyEscalatedCount: newlyEscalated.length,
  };
}

/**
 * Ручная эскалация задачи сотрудником руководителю
 */
export async function escalateTaskManually(
  task: Task,
  reason: string,
  user: UserProfile
): Promise<Task> {
  const updated = await updateTask(task.id, {
    is_escalated: true,
    escalated_at: new Date().toISOString(),
    escalation_reason: reason.trim() || 'Срочный вопрос, требуется решение руководителя',
    escalated_by: user.full_name,
  });

  return updated;
}

/**
 * Снятие эскалации (решено руководителем или взято на контроль)
 */
export async function resolveTaskEscalation(
  task: Task,
  user: UserProfile
): Promise<Task> {
  const updated = await updateTask(task.id, {
    is_escalated: false,
    escalation_reason: null,
  });

  return updated;
}
