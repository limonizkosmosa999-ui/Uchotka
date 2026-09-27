export type UserRole = 'accountant' | 'manager';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  notification_email?: string | null;
  manager_id?: string | null;   // для бухгалтера: ссылка на руководителя
  invite_code?: string | null;  // для руководителя: уникальный код приглашения
  created_at?: string;
}

export interface TaxType {
  id: string;
  name: string;
  rate_description: string;
  created_at?: string;
}

export type ClientType = 'ИП' | 'ОсОО';

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  inn: string;
  client_type: ClientType;
  tax_type_id: string;
  notes?: string | null;
  created_at?: string;
  // Joined fields
  owner?: UserProfile;
  tax_type?: TaxType;
}

export type TaskStatus = 'in_progress' | 'submitted' | 'waiting' | 'done';

export interface Task {
  id: string;
  company_id: string;
  doc_type: string;
  due_date: string; // YYYY-MM-DD
  status: TaskStatus;
  wait_until?: string | null; // YYYY-MM-DD
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // Joined fields
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
  totalActiveTasks: number;
  workloadPercentage: number;
  status: 'optimal' | 'high' | 'overloaded';
}
