import { Task, UserProfile } from '../types';
import { updateTask } from './api';
import { logActivity } from './activityLog';
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

        // Записываем в аудит-лог
        await logActivity({
          userId: currentUser?.id || 'system',
          userName: currentUser?.full_name || 'Система эскалации Учётки',
          actionType: 'escalate',
          description: `Автоматическая эскалация руководителю по задаче "${task.doc_type}": ${reason}`,
          companyId: task.company_id,
          companyName: task.company?.name,
          taskId: task.id,
          docType: task.doc_type,
          meta: { daysLeft, reason },
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

  await logActivity({
    userId: user.id,
    userName: user.full_name,
    actionType: 'escalate',
    description: `Сотрудник ${user.full_name} эскалировал задачу "${task.doc_type}" руководителю: "${reason}"`,
    companyId: task.company_id,
    companyName: task.company?.name,
    taskId: task.id,
    docType: task.doc_type,
    meta: { reason },
  });

  return updated;
}

/**
 * Снятие эскалации (решено руководителем или взято на контроль)
 */
export async function resolveTaskEscalation(
  task: Task,
  user: UserProfile,
  resolutionNote?: string
): Promise<Task> {
  const updated = await updateTask(task.id, {
    is_escalated: false,
    escalation_reason: null,
  });

  await logActivity({
    userId: user.id,
    userName: user.full_name,
    actionType: 'resolve_escalation',
    description: `Руководитель ${user.full_name} снял эскалацию с задачи "${task.doc_type}"${
      resolutionNote ? ` (комментарий: ${resolutionNote})` : ''
    }`,
    companyId: task.company_id,
    companyName: task.company?.name,
    taskId: task.id,
    docType: task.doc_type,
    meta: { resolutionNote },
  });

  return updated;
}
