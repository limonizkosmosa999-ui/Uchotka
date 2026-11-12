import { ActivityLog, ActivityActionType } from '../types';
import { supabase, isSupabaseConfigured } from './supabase';
import { emitMockRealtimeEvent } from './api';

const LS_ACTIVITY_LOGS = 'uchotka_activity_logs';

export const ACTIVITY_ACTION_LABELS: Record<ActivityActionType, string> = {
  create_task: 'Создание задачи',
  update_task: 'Изменение задачи',
  delete_task: 'Удаление задачи',
  assign_task: 'Назначение сотрудника',
  status_change: 'Смена статуса',
  escalate: 'Эскалация',
  resolve_escalation: 'Снятие эскалации',
  send_reminder: 'Напоминание клиенту',
  document_upload: 'Загрузка документа',
  company_create: 'Создание компании',
  company_update: 'Изменение компании',
  company_delete: 'Удаление компании',
  import_batch: 'Импорт',
  generate_year_calendar: 'Генерация календаря',
};

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

  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        user_id: newLog.user_id,
        user_name: newLog.user_name,
        action_type: newLog.action_type,
        description: newLog.description,
        company_id: newLog.company_id,
        company_name: newLog.company_name,
        task_id: newLog.task_id,
        doc_type: newLog.doc_type,
        meta: newLog.meta || {},
      })
      .select()
      .single();

    if (error) throw new Error(`Не удалось записать историю действий: ${error.message}`);
    return data as ActivityLog;
  }

  const raw = localStorage.getItem(LS_ACTIVITY_LOGS);
  const logs: ActivityLog[] = raw ? JSON.parse(raw) : [];
  logs.unshift(newLog);
  if (logs.length > 500) logs.length = 500;
  localStorage.setItem(LS_ACTIVITY_LOGS, JSON.stringify(logs));
  emitMockRealtimeEvent('activity_logs', 'INSERT', newLog);
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
    if (error) throw new Error(`Не удалось загрузить историю действий: ${error.message}`);
    return (data || []) as ActivityLog[];
  }

  const raw = localStorage.getItem(LS_ACTIVITY_LOGS);
  let logs: ActivityLog[] = raw ? JSON.parse(raw) : [];

  if (options?.companyId) {
    logs = logs.filter((l) => l.company_id === options.companyId);
  }
  if (options?.taskId) {
    logs = logs.filter((l) => l.task_id === options.taskId);
  }

  return logs.slice(0, limit);
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
