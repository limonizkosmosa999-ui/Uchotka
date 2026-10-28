import { ReminderRecord, Task, Company, UserProfile } from '../types';
import { logActivity } from './activityLog';
import { formatDateRu } from './dateUtils';

const LS_REMINDERS = 'uchotka_reminders_history';

/**
 * Очищает номер телефона для WhatsApp (+996...)
 */
export function cleanPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  // Если начинается с 0 (например 0555123456), заменяем на 996555123456
  if (digits.startsWith('0') && digits.length === 10) {
    return '996' + digits.slice(1);
  }
  // Если 9 цифр (например 555123456)
  if (digits.length === 9) {
    return '996' + digits;
  }
  return digits;
}

/**
 * Формирует прямую ссылку для открытия чата WhatsApp с предзаполненным текстом
 */
export function formatWhatsAppUrl(phone: string, message: string): string {
  const cleaned = cleanPhoneNumber(phone);
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}

/**
 * Формирует ссылку для Telegram (прямой чат по нику или поделиться текстом)
 */
export function formatTelegramUrl(handleOrPhone: string, message: string): string {
  let handle = handleOrPhone.trim();
  if (handle.startsWith('@')) handle = handle.slice(1);

  if (handle && !handle.match(/^\+?\d+$/)) {
    // Это username (@username)
    return `https://t.me/${handle}`;
  }

  // Общий диалог шаринга текста в Telegram
  return `https://t.me/share/url?text=${encodeURIComponent(message)}`;
}

/**
 * Формирует профессиональный текст напоминания для клиентов в Кыргызстане
 */
export function generateTaxReminderMessage(options: {
  company: Company;
  task: Task;
  senderName?: string;
  agencyName?: string;
}): string {
  const { company, task, senderName, agencyName = 'Бухгалтерское агентство «Учётка»' } = options;
  const dueDateFormatted = formatDateRu(task.due_date, 'd MMMM yyyy г.');

  return `Здравствуйте! 🇰🇬\n` +
    `Напоминание от ${agencyName}.\n\n` +
    `📋 Компания: ${company.name} (ИНН: ${company.inn})\n` +
    `📑 Отчётность / Документ: ${task.doc_type}\n` +
    `⏰ Срок сдачи в ГНС КР: ${dueDateFormatted}\n` +
    (task.notes ? `💬 Примечание: ${task.notes}\n` : '') +
    `\nПожалуйста, своевременно подтвердите сдачу либо предоставьте недостающие первичные документы/выписки.\n\n` +
    `С уважением, ${senderName || 'Ваш бухгалтер'}`;
}

/**
 * Сохраняет историю отправленных напоминаний
 */
export async function saveReminderRecord(
  reminder: Omit<ReminderRecord, 'id' | 'created_at'>,
  user: UserProfile
): Promise<ReminderRecord> {
  const newRecord: ReminderRecord = {
    ...reminder,
    id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    created_at: new Date().toISOString(),
  };

  try {
    const raw = localStorage.getItem(LS_REMINDERS);
    const list: ReminderRecord[] = raw ? JSON.parse(raw) : [];
    list.unshift(newRecord);
    localStorage.setItem(LS_REMINDERS, JSON.stringify(list));
  } catch (e) {
    console.warn('Failed to save reminder in localStorage', e);
  }

  // Записываем в общий аудит-лог
  await logActivity({
    userId: user.id,
    userName: user.full_name,
    actionType: 'send_reminder',
    description: `Отправлено напоминание через ${reminder.channel.toUpperCase()} для ${reminder.recipient_name} по задаче "${reminder.phone_or_handle}"`,
    companyId: reminder.company_id,
    taskId: reminder.task_id,
    meta: {
      channel: reminder.channel,
      phone_or_handle: reminder.phone_or_handle,
    },
  });

  return newRecord;
}

/**
 * Получает историю напоминаний
 */
export function getRemindersHistory(taskId?: string): ReminderRecord[] {
  try {
    const raw = localStorage.getItem(LS_REMINDERS);
    let list: ReminderRecord[] = raw ? JSON.parse(raw) : [];
    if (taskId) {
      list = list.filter((r) => r.task_id === taskId);
    }
    return list;
  } catch {
    return [];
  }
}
