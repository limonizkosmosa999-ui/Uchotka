export type UserRole = 'accountant' | 'manager';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  notification_email?: string | null;
  phone?: string | null;
  telegram_handle?: string | null;
  created_at?: string;
}

export interface TaxType {
  id: string;
  name: string;
  rate_description: string;
  created_at?: string;
}

export type ClientType = 'ИП' | 'ОсОО' | 'ОО' | 'ОФ';

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  inn: string;
  client_type: ClientType;
  tax_type_id: string;
  tax_office_district?: string | null;
  curator_id?: string | null;
  notes?: string | null;
  phone?: string | null; // For WhatsApp notifications
  telegram_contact?: string | null; // For Telegram @handle or phone
  contact_person?: string | null;
  tax_regime_preset?: string | null; // Preset template ID (e.g. 'ip_single_tax_small')
  created_at?: string;
  // Joined fields
  owner?: UserProfile;
  tax_type?: TaxType;
}

export type TaskStatus = 'in_progress' | 'submitted' | 'waiting' | 'done';
export type TaskRecurrence = 'monthly' | 'quarterly' | 'yearly';
export type TaskAssignmentRole = 'executor' | 'controller';

export interface TaskAssignment {
  user_id: string;
  assignment_role: TaskAssignmentRole;
  user?: UserProfile;
}

export interface Task {
  id: string;
  company_id: string;
  doc_type: string;
  due_date: string; // YYYY-MM-DD
  status: TaskStatus;
  wait_until?: string | null; // YYYY-MM-DD
  notes?: string | null;
  recurrence_rule?: TaskRecurrence | null;
  recurrence_series_id?: string | null;
  // Escalation fields
  is_escalated?: boolean;
  escalated_at?: string | null;
  escalation_reason?: string | null;
  escalated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  assignments?: TaskAssignment[];
  // Joined fields
  company?: Company;
}

export type DocumentCategory =
  | 'tax_report'     // Отчётность ГНС (квитанции, протоколы STI)
  | 'socfund'        // Квитанции и полисы Соцфонда
  | 'primary'        // Первичка (счета-фактуры, акты, накладные)
  | 'corporate'      // Учредительные документы, Устав, Свидетельства
  | 'ecp'            // ЭЦП, доверенности, доступы в Салык
  | 'other';         // Прочие документы

export interface CompanyDocument {
  id: string;
  company_id: string;
  created_by: string;
  title: string;
  file_name: string;
  storage_path: string;
  mime_type: string;
  file_size: number;
  received_address: string;
  received_at: string;
  notes?: string | null;
  category?: DocumentCategory;
  task_id?: string | null;
  created_at?: string;
  file_data_url?: string;
  company?: Company;
}

export interface AppNotification {
  id: string;
  user_id: string;
  task_id?: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
  task?: Task;
}

export type TaskUrgencyCategory = 'today' | 'this_week' | 'later' | 'waiting' | 'overdue';

export interface AccountantStat {
  accountant: UserProfile;
  companiesCount: number;
  tasksTodayCount: number;
  overdueCount: number;
  completedTasks: number;
  remainingTasks: number;
  totalTasks: number;
  completionPercentage: number;
}

// ---------------------------------------------------------------------------
// Kyrgyz Republic Tax Code Reference and Calendar Types
// ---------------------------------------------------------------------------
export type TaxPeriod = 'month' | 'quarter' | 'year' | 'event' | 'info_calc';
export type PayerType = 'organization' | 'individual_entrepreneur' | 'physical_person' | 'tax_agent' | 'foreign_org' | 'mining' | 'ecommerce' | 'gambling' | 'diplomatic';

export interface TaxObligationRule {
  id: string;
  tax_code: string; // e.g. "НДС", "Подоходный налог", "Единый налог"
  form_code: string; // e.g. "FORM STI-062", "FORM STI-161", "FORM STI-091"
  name: string;
  payer_types: PayerType[];
  period: TaxPeriod;
  deadline_rule: string;
  payment_deadline_rule?: string;
  description: string;
  category: 'payroll' | 'vat' | 'single_tax' | 'profit' | 'property' | 'annual' | 'excise' | 'special';
  default_day_of_month?: number; // 20, 25 or last day
  annual_deadline_month?: number; // 4 (April) or 5 (May)
  annual_deadline_day?: number; // 1
  legal_reference?: string;
}

export interface TaxPackageTemplate {
  id: string;
  name: string;
  client_type: ClientType;
  tax_type_id: string;
  description: string;
  badge: string;
  form_codes: string[];
  has_employees_default?: boolean;
  default_tasks_count: number;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Audit Log / History of Actions
// ---------------------------------------------------------------------------
export type ActivityActionType =
  | 'create_task'
  | 'update_task'
  | 'status_change'
  | 'escalate'
  | 'resolve_escalation'
  | 'send_reminder'
  | 'document_upload'
  | 'company_create'
  | 'company_update'
  | 'import_batch'
  | 'generate_year_calendar';

export interface ActivityLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string;
  action_type: ActivityActionType;
  description: string;
  company_id?: string | null;
  company_name?: string | null;
  task_id?: string | null;
  doc_type?: string | null;
  meta?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Reminders via Telegram / WhatsApp / Email
// ---------------------------------------------------------------------------
export interface ReminderRecord {
  id: string;
  created_at: string;
  task_id: string;
  company_id: string;
  recipient_name: string;
  channel: 'whatsapp' | 'telegram' | 'email';
  phone_or_handle: string;
  message_text: string;
  sent_by_user_id: string;
  status: 'sent' | 'pending' | 'failed';
}

