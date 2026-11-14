import { supabase, isSupabaseConfigured, supabaseConfigError } from './supabase';
import { ActivityActionType, ActivityLog, Company, CompanyDocument, TaxType, Task, TaskStatus, UserProfile, AppNotification } from '../types';
import { MOCK_USERS, MOCK_TAX_TYPES, MOCK_COMPANIES, MOCK_TASKS, MOCK_NOTIFICATIONS } from './mockData';

// Local storage keys for fallback/demo state
const LS_STORAGE_PREFIX = 'uchotka_';
const LS_USERS = LS_STORAGE_PREFIX + 'users';
const LS_COMPANIES = LS_STORAGE_PREFIX + 'companies';
const LS_TASKS = LS_STORAGE_PREFIX + 'tasks';
const LS_NOTIFICATIONS = LS_STORAGE_PREFIX + 'notifications';
const LS_COMPANY_DOCUMENTS = LS_STORAGE_PREFIX + 'company_documents';
const LS_CURRENT_USER = LS_STORAGE_PREFIX + 'current_user';
const COMPANY_DOCUMENT_BUCKET = 'company-documents';
const MAX_COMPANY_DOCUMENT_SIZE = 10 * 1024 * 1024;
const MAX_MOCK_DOCUMENT_SIZE = 2 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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
  if (!localStorage.getItem(LS_COMPANY_DOCUMENTS)) {
    localStorage.setItem(LS_COMPANY_DOCUMENTS, JSON.stringify([]));
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

function recordMockActivity(
  actionType: ActivityActionType,
  description: string,
  details: Partial<Pick<ActivityLog, 'company_id' | 'company_name' | 'task_id' | 'doc_type' | 'meta'>> = {}
) {
  const user: UserProfile | null = JSON.parse(localStorage.getItem(LS_CURRENT_USER) || 'null');
  const log: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
    user_id: user?.id || null,
    user_name: user?.full_name || 'Система',
    action_type: actionType,
    description,
    ...details,
  };
  const logs: ActivityLog[] = JSON.parse(localStorage.getItem('uchotka_activity_logs') || '[]');
  logs.unshift(log);
  if (logs.length > 500) logs.length = 500;
  localStorage.setItem('uchotka_activity_logs', JSON.stringify(logs));
  emitMockRealtimeEvent('activity_logs', 'INSERT', log);
}

// -------------------------------------------------------------
// AUTH & USERS
// -------------------------------------------------------------

export async function getCurrentUser(): Promise<UserProfile | null> {
  if (supabaseConfigError) throw new Error(supabaseConfigError);

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
  if (supabaseConfigError) throw new Error(supabaseConfigError);

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
  requestedRole: 'accountant' | 'manager' = 'accountant'
): Promise<UserProfile> {
  if (supabaseConfigError) throw new Error(supabaseConfigError);

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: requestedRole },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Ошибка регистрации');
    if (!data.session) {
      throw new Error(
        'Регистрация не завершила вход: Supabase ожидает подтверждение email. Для тестового приложения отключите Confirm email в настройках Authentication → Providers → Email проекта Supabase, затем повторите регистрацию.'
      );
    }

    const { data: savedProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();
    if (!profileError && savedProfile) return savedProfile;

    const profile: UserProfile = {
      id: data.user.id,
      email,
      role: 'accountant',
      full_name: fullName,
      notification_email: email,
      created_at: new Date().toISOString(),
    };
    return profile;
  }

  // ==== MOCK register ====
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Пользователь с таким email уже существует');
  }

  const newUser: UserProfile = {
    id: `user-${Date.now()}`,
    email,
    role: requestedRole === 'manager'
      && ['limon.iz.kosmosa.999@gmail.com', 'ashymova.aiperi@gmail.com'].includes(email.trim().toLowerCase())
      ? 'manager'
      : 'accountant',
    full_name: fullName,
    notification_email: email,
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

export function getCompanyDocumentSizeLimit(): number {
  return isSupabaseConfigured ? MAX_COMPANY_DOCUMENT_SIZE : MAX_MOCK_DOCUMENT_SIZE;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Не удалось прочитать файл документа'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Не удалось прочитать файл документа'));
    reader.readAsDataURL(file);
  });
}

function getDocumentMimeType(file: File): string {
  if (ALLOWED_DOCUMENT_TYPES.has(file.type)) return file.type;

  const extension = file.name.split('.').pop()?.toLowerCase();
  const mimeByExtension: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };
  return mimeByExtension[extension || ''] || '';
}

export async function getCompanyDocuments(companyId: string): Promise<CompanyDocument[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', companyId)
      .order('received_at', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as CompanyDocument[];
  }

  const documents: CompanyDocument[] = JSON.parse(
    localStorage.getItem(LS_COMPANY_DOCUMENTS) || '[]'
  );
  return documents
    .filter((document) => document.company_id === companyId)
    .sort((a, b) => b.received_at.localeCompare(a.received_at));
}

export async function getAllCompanyDocuments(): Promise<CompanyDocument[]> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('company_documents')
      .select('*, company:companies(*)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as CompanyDocument[];
  }

  const documents: CompanyDocument[] = JSON.parse(
    localStorage.getItem(LS_COMPANY_DOCUMENTS) || '[]'
  );
  const companies = await getCompanies();
  return documents
    .map((document) => ({
      ...document,
      company: companies.find((company) => company.id === document.company_id),
    }))
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
}

export async function getCompanyDocumentUrl(document: CompanyDocument): Promise<string> {
  if (document.file_data_url) return document.file_data_url;

  if (!isSupabaseConfigured) {
    throw new Error('Файл документа недоступен в демо-хранилище');
  }

  const { data, error } = await supabase.storage
    .from(COMPANY_DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function createCompanyDocument(input: {
  companyId: string;
  createdBy: string;
  title: string;
  receivedAddress: string;
  receivedAt: string;
  notes?: string;
  file: File;
}): Promise<CompanyDocument> {
  const mimeType = getDocumentMimeType(input.file);
  if (!mimeType) {
    throw new Error('Можно загрузить только PDF, JPEG, PNG или WebP');
  }

  const maxFileSize = getCompanyDocumentSizeLimit();
  if (input.file.size <= 0 || input.file.size > maxFileSize) {
    throw new Error(`Размер файла должен быть не больше ${Math.floor(maxFileSize / (1024 * 1024))} МБ`);
  }

  const fileName = input.file.name.trim() || 'document';
  const title = input.title.trim();
  const receivedAddress = input.receivedAddress.trim();
  if (!title || !receivedAddress || !input.receivedAt) {
    throw new Error('Укажите название документа, адрес и дату получения');
  }

  if (!isSupabaseConfigured) {
    const documents: CompanyDocument[] = JSON.parse(
      localStorage.getItem(LS_COMPANY_DOCUMENTS) || '[]'
    );
    const newDocument: CompanyDocument = {
      id: `document-${crypto.randomUUID()}`,
      company_id: input.companyId,
      created_by: input.createdBy,
      title,
      file_name: fileName,
      storage_path: `mock/${input.companyId}/${crypto.randomUUID()}-${fileName}`,
      mime_type: mimeType,
      file_size: input.file.size,
      received_address: receivedAddress,
      received_at: input.receivedAt,
      notes: input.notes?.trim() || null,
      created_at: new Date().toISOString(),
      file_data_url: await readFileAsDataUrl(input.file),
    };
    documents.push(newDocument);
    localStorage.setItem(LS_COMPANY_DOCUMENTS, JSON.stringify(documents));
    emitMockRealtimeEvent('company_documents', 'INSERT', newDocument);
    return newDocument;
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${input.companyId}/${crypto.randomUUID()}-${safeFileName}`;
  const { error: uploadError } = await supabase.storage
    .from(COMPANY_DOCUMENT_BUCKET)
    .upload(storagePath, input.file, {
      contentType: mimeType,
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: insertError } = await supabase
    .from('company_documents')
    .insert({
      company_id: input.companyId,
      created_by: input.createdBy,
      title,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: input.file.size,
      received_address: receivedAddress,
      received_at: input.receivedAt,
      notes: input.notes?.trim() || null,
    })
    .select('*')
    .single();

  if (insertError) {
    const { error: cleanupError } = await supabase.storage
      .from(COMPANY_DOCUMENT_BUCKET)
      .remove([storagePath]);
    if (cleanupError) {
      throw new Error(
        `Не удалось сохранить сведения о документе: ${insertError.message}. Не удалось удалить загруженный файл: ${cleanupError.message}`
      );
    }
    throw insertError;
  }

  return data as CompanyDocument;
}

export async function getCompanies(ownerId?: string): Promise<Company[]> {
  if (isSupabaseConfigured) {
    const query = supabase.from('companies').select(`
      *,
      tax_type:tax_types (*),
      owner:users!companies_owner_id_fkey (*),
      curator:users!companies_curator_id_fkey (*)
    `).order('name');

    // RLS already restricts rows. Keep assigned companies visible even when
    // the signed-in accountant is not the company owner.
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // Mock
  const companies: Company[] = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]');
  const tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');

  let filtered = companies;
  if (ownerId) {
    filtered = filtered.filter((company) =>
      company.owner_id === ownerId
      || tasks.some((task) =>
        task.company_id === company.id
        && task.assignments?.some((assignment) => assignment.user_id === ownerId)
      )
    );
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
        owner:users!companies_owner_id_fkey (*),
        curator:users!companies_curator_id_fkey (*)
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
      .select(`
        *,
        tax_type:tax_types (*),
        owner:users!companies_owner_id_fkey (*),
        curator:users!companies_curator_id_fkey (*)
      `)
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
  recordMockActivity('company_create', `Добавлена компания «${newComp.name}».`, {
    company_id: newComp.id,
    company_name: newComp.name,
  });

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
      .select(`
        *,
        tax_type:tax_types (*),
        owner:users!companies_owner_id_fkey (*),
        curator:users!companies_curator_id_fkey (*)
      `)
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
  recordMockActivity('company_update', `Изменены данные компании «${companies[idx].name}».`, {
    company_id: companies[idx].id,
    company_name: companies[idx].name,
  });

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
  const deletedCompany = companies.find((company) => company.id === id);
  companies = companies.filter((c) => c.id !== id);
  localStorage.setItem(LS_COMPANIES, JSON.stringify(companies));

  // Also cascade delete tasks
  let tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  tasks = tasks.filter((t) => t.company_id !== id);
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));

  emitMockRealtimeEvent('companies', 'DELETE', { id });
  if (deletedCompany) {
    recordMockActivity('company_delete', `Удалена компания «${deletedCompany.name}».`, {
      company_name: deletedCompany.name,
      meta: { company_id: id },
    });
  }
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
      assignments:task_assignees (
        user_id,
        assignment_role,
        user:users!task_assignees_user_id_fkey (*)
      ),
      creator:users!tasks_created_by_fkey (*),
      company:companies!tasks_company_id_fkey (
        *,
        owner:users!companies_owner_id_fkey (*),
        curator:users!companies_curator_id_fkey (*)
      )
    `).order('due_date', { ascending: true });

    if (options?.companyId) {
      query = query.eq('company_id', options.companyId);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Supabase RLS already limits this result to tasks visible to the signed-in user.
    // Avoid re-filtering on nested relations, which may be omitted by relation-level RLS.
    return (data || []) as Task[];
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
    populated = populated.filter((task) =>
      task.company?.owner_id === options.ownerId
      || task.assignments?.some((assignment) => assignment.user_id === options.ownerId)
    );
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
      .select(`
        *,
        creator:users!tasks_created_by_fkey (*),
        company:companies!tasks_company_id_fkey (
          *,
          owner:users!companies_owner_id_fkey (*),
          curator:users!companies_curator_id_fkey (*)
        )
      `)
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

export async function createCompanyTasks(input: {
  companyIds: string[];
  task: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'company' | 'assignments'>;
  executorIds: string[];
  controllerIds: string[];
}): Promise<Task[]> {
  const { companyIds, task, executorIds, controllerIds } = input;
  if (!companyIds.length) throw new Error('Выберите хотя бы одну компанию');

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('create_company_tasks', {
      p_company_ids: companyIds,
      p_doc_type: task.doc_type,
      p_due_date: task.due_date,
      p_status: task.status || 'in_progress',
      p_wait_until: task.wait_until || null,
      p_notes: task.notes || null,
      p_executor_ids: executorIds,
      p_controller_ids: controllerIds,
      p_recurrence_rule: task.recurrence_rule || null,
    });
    if (error) throw error;
    return (data || []) as Task[];
  }

  const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
  const tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const notifications: AppNotification[] = JSON.parse(localStorage.getItem(LS_NOTIFICATIONS) || '[]');
  const idPrefix = `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const created: Task[] = companyIds.map((companyId, index) => ({
    ...task,
    company_id: companyId,
    id: `${idPrefix}-${index}`,
    status: task.status || 'in_progress',
    wait_until: task.wait_until || null,
    notes: task.notes || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    assignments: [
      ...executorIds.map((user_id) => ({
        user_id,
        assignment_role: 'executor' as const,
        user: users.find((user) => user.id === user_id),
      })),
      ...controllerIds.map((user_id) => ({
        user_id,
        assignment_role: 'controller' as const,
        user: users.find((user) => user.id === user_id),
      })),
    ],
  }));

  tasks.unshift(...created);
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  const assignmentNotifications: AppNotification[] = created.flatMap((createdTask) => [
    ...executorIds.map((user_id) => ({
      id: `notification-${createdTask.id}-${user_id}-executor`,
      user_id,
      task_id: createdTask.id,
      message: `Вам назначена задача «${createdTask.doc_type}» как исполнитель. Срок: ${createdTask.due_date}.`,
      is_read: false,
      created_at: new Date().toISOString(),
    })),
    ...controllerIds.map((user_id) => ({
      id: `notification-${createdTask.id}-${user_id}-controller`,
      user_id,
      task_id: createdTask.id,
      message: `Вас назначили контролирующим по задаче «${createdTask.doc_type}». Срок: ${createdTask.due_date}.`,
      is_read: false,
      created_at: new Date().toISOString(),
    })),
  ]);
  notifications.unshift(...assignmentNotifications);
  localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications));
  created.forEach((createdTask) => {
    emitMockRealtimeEvent('tasks', 'INSERT', createdTask);
    const company = JSON.parse(localStorage.getItem(LS_COMPANIES) || '[]')
      .find((item: Company) => item.id === createdTask.company_id) as Company | undefined;
    recordMockActivity('create_task', `Создана задача «${createdTask.doc_type}».`, {
      company_id: createdTask.company_id,
      company_name: company?.name,
      task_id: createdTask.id,
      doc_type: createdTask.doc_type,
    });
    createdTask.assignments?.forEach((assignment) => {
      const assignee = users.find((candidate) => candidate.id === assignment.user_id);
      recordMockActivity('assign_task', `${assignee?.full_name || 'Сотрудник'} назначен(а) ${
        assignment.assignment_role === 'executor' ? 'исполнителем' : 'контролирующим'
      } по задаче «${createdTask.doc_type}».`, {
        company_id: createdTask.company_id,
        company_name: company?.name,
        task_id: createdTask.id,
        doc_type: createdTask.doc_type,
        meta: { assigned_user_id: assignment.user_id, assignment_role: assignment.assignment_role },
      });
    });
  });
  assignmentNotifications.forEach((notification) =>
    emitMockRealtimeEvent('notifications', 'INSERT', notification)
  );
  return created;
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
      .select(`
        *,
        creator:users!tasks_created_by_fkey (*),
        company:companies!tasks_company_id_fkey (
          *,
          owner:users!companies_owner_id_fkey (*),
          curator:users!companies_curator_id_fkey (*)
        )
      `)
      .single();

    if (error) throw error;
    return data;
  }

  // Mock
  const tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) throw new Error('Задача не найдена');

  const previousTask = tasks[idx];
  tasks[idx] = {
    ...tasks[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  emitMockRealtimeEvent('tasks', 'UPDATE', tasks[idx]);
  const escalationChanged = updates.is_escalated !== undefined
    && updates.is_escalated !== previousTask.is_escalated;
  const statusChanged = updates.status !== undefined && updates.status !== previousTask.status;
  if (updates.is_escalated === true && !previousTask.is_escalated) {
    const users: UserProfile[] = JSON.parse(localStorage.getItem(LS_USERS) || '[]');
    const notifications: AppNotification[] = JSON.parse(localStorage.getItem(LS_NOTIFICATIONS) || '[]');
    const escalatedBy = updates.escalated_by || 'Сотрудник';
    const message = `Задача «${tasks[idx].doc_type}» эскалирована сотрудником ${escalatedBy}. Причина: ${
      updates.escalation_reason || 'требуется срочный контроль'
    }`;
    const escalationNotifications = users
      .filter((candidate) => candidate.role === 'manager')
      .map((manager) => ({
        id: `notification-escalation-${tasks[idx].id}-${manager.id}-${Date.now()}`,
        user_id: manager.id,
        task_id: tasks[idx].id,
        message,
        is_read: false,
        created_at: new Date().toISOString(),
      }));
    notifications.unshift(...escalationNotifications);
    localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications));
    escalationNotifications.forEach((notification) =>
      emitMockRealtimeEvent('notifications', 'INSERT', notification)
    );
  }

  recordMockActivity(
    escalationChanged
      ? updates.is_escalated ? 'escalate' : 'resolve_escalation'
      : statusChanged ? 'status_change' : 'update_task',
    escalationChanged
      ? updates.is_escalated
        ? `Задача «${tasks[idx].doc_type}» эскалирована: ${updates.escalation_reason || 'требуется контроль'}.`
        : `С задачи «${tasks[idx].doc_type}» снята эскалация.`
      : statusChanged
        ? `Изменён статус задачи «${tasks[idx].doc_type}»: ${previousTask.status} → ${tasks[idx].status}.`
        : `Изменены данные задачи «${tasks[idx].doc_type}».`,
    {
      company_id: tasks[idx].company_id,
      task_id: tasks[idx].id,
      doc_type: tasks[idx].doc_type,
    }
  );

  const all = await getTasks();
  return all.find((t) => t.id === id) || tasks[idx];
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
  waitUntil: string | null
): Promise<Task> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.rpc('update_task_status', {
      p_task_id: id,
      p_status: status,
      p_wait_until: waitUntil,
    });

    if (!error) {
      if (!data) throw new Error('Сервер не вернул обновлённую задачу');
      return data as Task;
    }

    if (error.code !== 'PGRST202' && error.code !== '42883') throw error;

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update({ status, wait_until: waitUntil, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    return updatedTask as Task;
  }

  return updateTask(id, { status, wait_until: waitUntil });
}

export async function deleteTask(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      throw new Error('Задача не удалена: нет прав или задача уже удалена');
    }
    return;
  }

  let tasks: Task[] = JSON.parse(localStorage.getItem(LS_TASKS) || '[]');
  const deletedTask = tasks.find((task) => task.id === id);
  tasks = tasks.filter((t) => t.id !== id);
  localStorage.setItem(LS_TASKS, JSON.stringify(tasks));
  emitMockRealtimeEvent('tasks', 'DELETE', { id });
  if (deletedTask) {
    recordMockActivity('delete_task', `Удалена задача «${deletedTask.doc_type}».`, {
      company_id: deletedTask.company_id,
      task_id: deletedTask.id,
      doc_type: deletedTask.doc_type,
    });
  }
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

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return;
  }

  const notifications: AppNotification[] = JSON.parse(
    localStorage.getItem(LS_NOTIFICATIONS) || '[]'
  );
  let changed = false;
  notifications.forEach((notification) => {
    if (notification.user_id === userId && !notification.is_read) {
      notification.is_read = true;
      changed = true;
      emitMockRealtimeEvent('notifications', 'UPDATE', notification);
    }
  });

  if (changed) {
    localStorage.setItem(LS_NOTIFICATIONS, JSON.stringify(notifications));
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

export function subscribeToNotifications(userId: string, onUpdate: () => void): () => void {
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        onUpdate
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom.detail.table === 'notifications' && custom.detail.record.user_id === userId) {
      onUpdate();
    }
  };
  realtimeEmitter.addEventListener('uchotka-realtime', handler);
  return () => {
    realtimeEmitter.removeEventListener('uchotka-realtime', handler);
  };
}

export function subscribeToActivityLogs(onUpdate: () => void, companyId?: string): () => void {
  if (isSupabaseConfigured) {
    const channel = supabase
      .channel(companyId ? `activity-logs:${companyId}` : 'activity-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
          ...(companyId ? { filter: `company_id=eq.${companyId}` } : {}),
        },
        onUpdate
      );
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    if (
      custom.detail.table === 'activity_logs'
      && (!companyId || custom.detail.record.company_id === companyId)
    ) {
      onUpdate();
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
