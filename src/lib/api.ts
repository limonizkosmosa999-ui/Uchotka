import { supabase, isSupabaseConfigured } from './supabase';
import { Company, TaxType, Task, UserProfile, AppNotification } from '../types';
import { MOCK_USERS, MOCK_TAX_TYPES, MOCK_COMPANIES, MOCK_TASKS, MOCK_NOTIFICATIONS } from './mockData';

// Local storage keys for fallback/demo state
const LS_STORAGE_PREFIX = 'uchotka_';
const LS_USERS = LS_STORAGE_PREFIX + 'users';
const LS_COMPANIES = LS_STORAGE_PREFIX + 'companies';
const LS_TASKS = LS_STORAGE_PREFIX + 'tasks';
const LS_NOTIFICATIONS = LS_STORAGE_PREFIX + 'notifications';
const LS_CURRENT_USER = LS_STORAGE_PREFIX + 'current_user';

// Initialize mock database in localStorage if needed
function initMockStorage() {
  if (!localStorage.getItem(LS_USERS)) {
    localStorage.setItem(LS_USERS, JSON.stringify(MOCK_USERS));
  }
  if (!localStorage.getItem(LS_COMPANIES)) {
    localStorage.setItem(LS_COMPANIES, JSON.stringify(MOCK_COMPANIES));
  }
  if (!localStorage.getItem(LS_TASKS)) {
    localStorage.setItem(LS_TASKS, JSON.stringify(MOCK_TASKS));
  }
  if (!localStorage.getItem(LS_NOTIFICATIONS)) {
    localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(MOCK_NOTIFICATIONS));
  }
  if (!localStorage.getItem(LS_CURRENT_USER)) {
    // Default to the first accountant for instant preview
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(MOCK_USERS[1]));
  }
}

initMockStorage();

// Custom event emitter for mock realtime updates
const realtimeEmitter = new EventTarget();

export function emitMockRealtimeEvent(table: string, eventType: string, record: any) {
  realtimeEmitter.dispatchEvent(
    new CustomEvent('uchotka-realtime', {
      detail: { table, eventType, record },
    })
  );
}

// -------------------------------------------------------------
// AUTH & USERS
// -------------------------------------------------------------

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (isSupabaseConfigured) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      // Fallback if profile not created yet
      return {
        id: user.id,
        email: user.email || '',
        role: (user.user_metadata?.role as any) || 'accountant',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Пользователь',
        notification_email: user.email,
      };
    }
    return profile;
  }

  // Mock
  const userJson = localStorage.getItem(LS_CURRENT_USER);
  return userJson ? JSON.parse(userJson) : null;
}

export async function switchMockUser(userId: string): Promise<UserProfile | null> {
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  const found = users.find((u) => u.id === userId) || null;
  if (found) {
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(found));
    emitMockRealtimeEvent('auth', 'CHANGE_USER', found);
  }
  return found;
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Пользователь не найден');

    const profile = await getCurrentUser();
    if (!profile) throw new Error('Не удалось загрузить профиль');
    return profile;
  }

  // Mock login: match by email (password ignored in demo mode)
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

  if (!found) {
    throw new Error('Пользователь не найден. Проверьте email или зарегистрируйтесь.');
  }

  localStorage.setItem(LS_CURRENT_USER, JSON.stringify(found));
  emitMockRealtimeEvent('auth', 'LOGIN', found);
  return found;
}

export async function registerWithEmail(
  email: string,
  password: string,
  fullName: string,
  role: 'accountant' | 'manager' = 'accountant',
  inviteCode?: string
): Promise<UserProfile> {
  if (isSupabaseConfigured) {
    // Validate invite code for accountants
    let managerId: string | null = null;
    if (role === 'accountant') {
      if (!inviteCode?.trim()) {
        throw new Error('Для регистрации бухгалтера необходим код приглашения от руководителя');
      }
      // Find manager by invite_code in users table
      const { data: mgr, error: mgrErr } = await supabase
        .from('users')
        .select('id')
        .eq('invite_code', inviteCode.trim())
        .single();
      if (mgrErr || !mgr) {
        throw new Error('Неверный код приглашения. Запросите актуальный код у руководителя.');
      }
      managerId = mgr.id;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Ошибка регистрации');

    const profile: UserProfile = {
      id: data.user.id,
      email,
      role,
      full_name: fullName,
      notification_email: email,
      manager_id: managerId,
      created_at: new Date().toISOString(),
    };
    await supabase.from('users').upsert(profile);
    return profile;
  }

  // ==== MOCK register ====
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Пользователь с таким email уже существует');
  }

  // Validate invite code for accountants in mock mode
  let managerId: string | null = null;
  if (role === 'accountant') {
    if (!inviteCode?.trim()) {
      throw new Error('Для регистрации бухгалтера необходим код приглашения от руководителя');
    }
    const manager = users.find(
      (u) => u.role === 'manager' && u.invite_code?.toUpperCase() === inviteCode.trim().toUpperCase()
    );
    if (!manager) {
      throw new Error('Неверный код приглашения. Запросите код у вашего руководителя.');
    }
    managerId = manager.id;
  }

  const newUser: UserProfile = {
    id: `user-${Date.now()}`,
    email,
    role,
    full_name: fullName,
    notification_email: email,
    manager_id: managerId,
    invite_code: role === 'manager' ? `КОД-${Date.now().toString(36).toUpperCase()}` : null,
    created_at: new Date().toISOString(),
  };

  users.push(newUser);
  localStorage.setItem(LS_USERS, JSON.stringify(users));
  localStorage.setItem(LS_CURRENT_USER, JSON.stringify(newUser));
  emitMockRealtimeEvent('auth', 'REGISTER', newUser);
  return newUser;
}

export async function logoutUser(): Promise<void> {
  if (isSupabaseConfigured) {
    await supabase.auth.signOut();
  } else {
    localStorage.removeItem(LS_CURRENT_USER);
    emitMockRealtimeEvent('auth', 'LOGOUT', null);
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('users').select('*').order('full_name');
    if (error) throw error;
    return data || [];
  }
  return JSON.parse(localStorage.getItem(LS_USERS) || '[]');
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<UserProfile, 'full_name' | 'notification_email'>>
): Promise<UserProfile> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // Mock
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) throw new Error('Пользователь не найден');

  users[idx] = { ...users[idx], ...updates };
  localStorage.setItem(LS_USERS, JSON.stringify(users));

  const currentUser = JSON.parse(localStorage.getItem(LS_CURRENT_USER) || '{}');
  if (currentUser.id === userId) {
    const updated = { ...currentUser, ...updates };
    localStorage.setItem(LS_CURRENT_USER, JSON.stringify(updated));
  }

  return users[idx];
}

// -------------------------------------------------------------
// TAX TYPES
// -------------------------------------------------------------

export async function getTaxTypes(): Promise<TaxType[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('tax_types').select('*').order('name');
    if (error) throw error;
    return data || [];
  }
  return MOCK_TAX_TYPES;
}

// -------------------------------------------------------------
// COMPANIES
// -------------------------------------------------------------

export async function getCompanies(ownerId?: string): Promise<Company[]> {
  if (isSupabaseConfigured) {
    let query = supabase.from('companies').select(`
      *,
      tax_type:tax_types (*),
      owner:users (*)
    `).order('name');

    if (ownerId) {
      query = query.eq('owner_id', ownerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Mock
  const companies: Company[] = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]');
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');

  let filtered = companies;
  if (ownerId) {
    filtered = filtered.filter((c) => c.owner_id === ownerId);
  }

  return filtered.map((c) => ({
    ...c,
    tax_type: MOCK_TAX_TYPES.find((t) => t.id === c.tax_type_id),
    owner: users.find((u) => u.id === c.owner_id),
  }));
}

export async function getCompanyById(id: string): Promise<Company | null> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        tax_type:tax_types (*),
        owner:users (*)
      `)
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  const companies = await getCompanies();
  return companies.find((c) => c.id === id) || null;
}

export async function createCompany(
  company: Omit<Company, 'id' | 'created_at' | 'owner' | 'tax_type'>
): Promise<Company> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('companies')
      .insert(company)
      .select(`*, tax_type:tax_types (*), owner:users (*)`)
      .single();

    if (error) throw error;
    return data;
  }

  // Mock
  const companies: Company[] = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]');
  const newComp: Company = {
    ...company,
    id: `comp-${Date.now()}`,
    created_at: new Date().toISOString(),
  };

  companies.unshift(newComp);
  localStorage.setItem(LS_COMPANIES, JSON.stringify(companies));
  emitMockRealtimeEvent('companies', 'INSERT', newComp);

  const fullComp = await getCompanyById(newComp.id);
  return fullComp || newComp;
}

export async function updateCompany(
  id: string,
  updates: Partial<Omit<Company, 'id' | 'created_at' | 'owner' | 'tax_type'>>
): Promise<Company> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', id)
      .select(`*, tax_type:tax_types (*), owner:users (*)`)
      .single();

    if (error) throw error;
    return data;
  }

  // Mock
  const companies: Company[] = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]');
  const idx = companies.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Компания не найдена');

  companies[idx] = { ...companies[idx], ...updates };
  localStorage.setItem(LS_COMPANIES, JSON.stringify(companies));
  emitMockRealtimeEvent('companies', 'UPDATE', companies[idx]);

  const full = await getCompanyById(id);
  return full || companies[idx];
}

export async function deleteCompany(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  // Mock
  let companies: Company[] = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]');
  companies = companies.filter((c) => c.id !== id);
  localStorage.setItem(LS_COMPANIES, JSON.stringify(companies));

  // Also cascade delete tasks
  let tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  tasks = tasks.filter((t) => t.company_id !== id);
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));

  emitMockRealtimeEvent('companies', 'DELETE', { id });
}

// -------------------------------------------------------------
// TASKS
// -------------------------------------------------------------

export async function getTasks(options?: {
  companyId?: string;
  ownerId?: string;
}): Promise<Task[]> {
  if (isSupabaseConfigured) {
    let query = supabase.from('tasks').select(`
      *,
      company:companies (
        *,
        owner:users (*)
      )
    `).order('due_date', { ascending: true });

    if (options?.companyId) {
      query = query.eq('company_id', options.companyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    let result = (data || []) as Task[];
    if (options?.ownerId) {
      result = result.filter((t) => t.company?.owner_id === options.ownerId);
    }
    return result;
  }

  // Mock
  const rawTasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const rawCompanies: Company[] = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]');
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');

  let populated = rawTasks.map((t) => {
    const comp = rawCompanies.find((c) => c.id === t.company_id);
    const owner = comp ? users.find((u) => u.id === comp.owner_id) : undefined;
    return {
      ...t,
      company: comp ? { ...comp, owner } : undefined,
    };
  });

  if (options?.companyId) {
    populated = populated.filter((t) => t.company_id === options.companyId);
  }

  if (options?.ownerId) {
    populated = populated.filter((t) => t.company?.owner_id === options.ownerId);
  }

  // Sort by due_date ascending
  populated.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  return populated;
}

export async function createTask(
  task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'company'>
): Promise<Task> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        company_id: task.company_id,
        doc_type: task.doc_type,
        due_date: task.due_date,
        status: task.status || 'in_progress',
        wait_until: task.wait_until || null,
        notes: task.notes || null,
      })
      .select(`*, company:companies (*, owner:users (*))`)
      .single();

    if (error) throw error;
    return data;
  }

  // Mock
  const tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const newTask: Task = {
    ...task,
    id: `task-${Date.now()}`,
    status: task.status || 'in_progress',
    wait_until: task.wait_until || null,
    notes: task.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  tasks.unshift(newTask);
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  emitMockRealtimeEvent('tasks', 'INSERT', newTask);

  // Return populated
  const allPopulated = await getTasks();
  return allPopulated.find((t) => t.id === newTask.id) || newTask;
}

export async function updateTask(
  id: string,
  updates: Partial<Omit<Task, 'id' | 'created_at' | 'company'>>
): Promise<Task> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`*, company:companies (*, owner:users (*))`)
      .single();

    if (error) throw error;
    return data;
  }

  // Mock
  const tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Задача не найдена');

  tasks[idx] = {
    ...tasks[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  emitMockRealtimeEvent('tasks', 'UPDATE', tasks[idx]);

  const all = await getTasks();
  return all.find((t) => t.id === id) || tasks[idx];
}

export async function deleteTask(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  let tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  tasks = tasks.filter((t) => t.id !== id);
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  emitMockRealtimeEvent('tasks', 'DELETE', { id });
}

// -------------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------------

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('notifications')
      .select(`*, task:tasks (*)`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Mock
  const notifs: AppNotification[] = JSON.parse(localStorage.getItem(LS_NOTIFICATIONS) || '[]');
  return notifs
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function markNotificationRead(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) throw error;
    return;
  }

  const notifs: AppNotification[] = JSON.parse(localStorage.getItem(LS_NOTIFICATIONS) || '[]');
  const idx = notifs.findIndex((n) => n.id === id);
  if (idx !== -1) {
    notifs[idx].is_read = true;
    localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifs));
    emitMockRealtimeEvent('notifications', 'UPDATE', notifs[idx]);
  }
}

// -------------------------------------------------------------
// REALTIME SUBSCRIPTIONS
// -------------------------------------------------------------

export function subscribeToTasks(onUpdate: (payload: any) => void): () => void {
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload) => {
          onUpdate(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Mock listener
  const handler = (e: any) => {
    const custom = e as CustomEvent;
    if (custom.detail.table === 'tasks') {
      onUpdate(custom.detail);
    }
  };
  realtimeEmitter.addEventListener('uchotka-realtime', handler);
  return () => {
    realtimeEmitter.removeEventListener('uchotka-realtime', handler);
  };
}

export function subscribeToRealtimeAny(onUpdate: (table: string, eventType: string, record: any) => void): () => void {
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        onUpdate(payload.table, payload.eventType, payload.new || payload.old);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  // Mock listener
  const handler = (e: any) => {
    const custom = e as CustomEvent;
    onUpdate(custom.detail.table, custom.detail.eventType, custom.detail.record);
  };
  realtimeEmitter.addEventListener('uchotka-realtime', handler);
  return () => {
    realtimeEmitter.removeEventListener('uchotka-realtime', handler);
  };
}
