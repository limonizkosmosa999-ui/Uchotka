import { format, isToday, isPast, isFuture, parseISO, startOfDay, differenceInCalendarDays, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Task, TaskUrgencyCategory } from '../types';

export function parseDateSafe(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  try {
    return parseISO(dateStr);
  } catch {
    return null;
  }
}

export function formatDateRu(dateStr?: string | null, formatStr: string = 'd MMMM yyyy'): string {
  const d = parseDateSafe(dateStr);
  if (!d) return '—';
  return format(d, formatStr, { locale: ru });
}

export function formatShortDate(dateStr?: string | null): string {
  const d = parseDateSafe(dateStr);
  if (!d) return '—';
  return format(d, 'dd.MM.yyyy');
}

export function getTaskUrgency(task: Task): TaskUrgencyCategory {
  if (task.status === 'waiting') {
    return 'waiting';
  }

  const d = parseDateSafe(task.due_date);
  if (!d) return 'later';

  const today = startOfDay(new Date());
  const taskDate = startOfDay(d);
  const diffDays = differenceInCalendarDays(taskDate, today);

  if (diffDays < 0) {
    return 'overdue';
  }
  if (diffDays === 0) {
    return 'today';
  }
  if (diffDays > 0 && diffDays <= 7) {
    return 'this_week';
  }
  return 'later';
}

export function getUrgencyBadge(task: Task) {
  if (task.status === 'done') {
    return {
      label: 'Сдано / Готово',
      textColor: '#5FA07A',
      bgColor: '#E7F3EB',
      borderColor: '#5FA07A33',
      dotColor: '#5FA07A',
    };
  }

  if (task.status === 'submitted') {
    return {
      label: 'Отправлено',
      textColor: '#5FA07A',
      bgColor: '#E7F3EB',
      borderColor: '#5FA07A33',
      dotColor: '#5FA07A',
    };
  }

  if (task.status === 'waiting') {
    return {
      label: task.wait_until
        ? `Ожидает ответа (до ${formatDateRu(task.wait_until, 'd MMM')})`
        : 'Ожидает ответа',
      textColor: '#5FA07A',
      bgColor: '#E7F3EB',
      borderColor: '#5FA07A33',
      dotColor: '#5FA07A',
    };
  }

  const urgency = getTaskUrgency(task);

  switch (urgency) {
    case 'overdue':
      return {
        label: 'Просрочено!',
        textColor: '#DD6B60',
        bgColor: '#FCE6E3',
        borderColor: '#DD6B6044',
        dotColor: '#DD6B60',
      };
    case 'today':
      return {
        label: 'Срок сегодня',
        textColor: '#DD6B60',
        bgColor: '#FCE6E3',
        borderColor: '#DD6B6033',
        dotColor: '#DD6B60',
      };
    case 'this_week':
      return {
        label: 'На этой неделе',
        textColor: '#DB8A3C',
        bgColor: '#FBEBD9',
        borderColor: '#DB8A3C33',
        dotColor: '#DB8A3C',
      };
    case 'later':
    default:
      return {
        label: 'Позже',
        textColor: '#C7A96E',
        bgColor: '#F6EFDE',
        borderColor: '#C7A96E33',
        dotColor: '#C7A96E',
      };
  }
}

export function getDaysLeftText(dueDateStr: string): string {
  const d = parseDateSafe(dueDateStr);
  if (!d) return '';
  const today = startOfDay(new Date());
  const diff = differenceInCalendarDays(startOfDay(d), today);

  if (diff < 0) return `просрочено на ${Math.abs(diff)} дн.`;
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === 2) return 'послезавтра';
  if (diff > 2 && diff < 5) return `через ${diff} дня`;
  return `через ${diff} дней`;
}
