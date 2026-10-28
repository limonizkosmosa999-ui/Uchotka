import { ActivityLog, ActivityActionType } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';

const LS_ACTIVITY_LOGS = 'uchotka_activity_logs';

/**
 * Записывает действие в аудит-лог (историю действий)
 */
export async function logActivity(entry: {
  userId: string;
  userName: string;
  actionType: ActivityActionType;
  description: string;
  companyId?: string | null;
  companyName?: string | null;
  taskId?: string | null;
  docType?: string | null;
  meta?: Record<string, any>;
}): Promise<ActivityLog> {
  const newLog: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
    user_id: entry.userId,
    user_name: entry.userName,
    action_type: entry.actionType,
    description: entry.description,
    company_id: entry.companyId || null,
    company_name: entry.companyName || null,
    task_id: entry.taskId || null,
    doc_type: entry.docType || null,
    meta: entry.meta,
  };

  // Local storage cache
  try {
    const raw = localStorage.getItem(LS_ACTIVITY_LOGS);
    const logs: ActivityLog[] = raw ? JSON.parse(raw) : [];
    logs.unshift(newLog);
    // Keep last 500 entries locally
    if (logs.length > 500) logs.length = 500;
    localStorage.setItem(LS_ACTIVITY_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.warn('Failed to save activity log in localStorage', e);
  }

  // Supabase if table exists
  if (isSupabaseConfigured) {
    try {
      await supabase.from('activity_logs').insert({
        id: newLog.id,
        user_id: newLog.user_id,
        user_name: newLog.user_name,
        action_type: newLog.action_type,
        description: newLog.description,
        company_id: newLog.company_id,
        company_name: newLog.company_name,
        task_id: newLog.task_id,
        doc_type: newLog.doc_type,
        meta: newLog.meta,
      });
    } catch {
      // Ignore if table not yet created in supabase
    }
  }

  return newLog;
}

/**
 * Получает историю действий с фильтрацией по компании, задаче или лимиту
 */
export async function getActivityLogs(options?: {
  companyId?: string;
  taskId?: string;
  limit?: number;
}): Promise<ActivityLog[]> {
  const limit = options?.limit || 100;

  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (options?.companyId) {
        query = query.eq('company_id', options.companyId);
      }
      if (options?.taskId) {
        query = query.eq('task_id', options.taskId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data as ActivityLog[];
      }
    } catch {
      // Fallback to local
    }
  }

  // Local storage fallback
  try {
    const raw = localStorage.getItem(LS_ACTIVITY_LOGS);
    let logs: ActivityLog[] = raw ? JSON.parse(raw) : [];

    if (options?.companyId) {
      logs = logs.filter((l) => l.company_id === options.companyId);
    }
    if (options?.taskId) {
      logs = logs.filter((l) => l.task_id === options.taskId);
    }

    return logs.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Экспорт истории действий в формате CSV для доказательств при спорах с клиентами или налоговыми органами
 */
export function exportActivityLogsToCsv(logs: ActivityLog[]): string {
  const headers = ['Дата и время', 'Пользователь', 'Тип действия', 'Компания', 'Документ / Задача', 'Описание действия'];
  const rows = logs.map((log) => [
    new Date(log.created_at).toLocaleString('ru-RU'),
    `"${(log.user_name || '').replace(/"/g, '""')}"`,
    `"${log.action_type}"`,
    `"${(log.company_name || '').replace(/"/g, '""')}"`,
    `"${(log.doc_type || '').replace(/"/g, '""')}"`,
    `"${(log.description || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Скачать файл CSV в браузере
 */
export function downloadCsvFile(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
