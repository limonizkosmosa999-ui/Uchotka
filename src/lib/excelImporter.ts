import * as XLSX from 'xlsx';
import { ClientType, Company, Task, UserProfile } from '../types';
import { createCompany, createCompanyTasks, getCompanies, getAllUsers } from './api';
import { logActivity } from './activityLog';

export interface RawImportRow {
  name?: string;
  inn?: string;
  client_type?: string;
  tax_type?: string;
  tax_office_district?: string;
  curator?: string;
  phone?: string;
  telegram?: string;
  doc_type?: string;
  due_date?: string;
  notes?: string;
  [key: string]: any;
}

export interface ValidatedImportItem {
  id: string;
  name: string;
  inn: string;
  client_type: ClientType;
  tax_type_name: string;
  tax_office_district: string;
  phone: string;
  telegram: string;
  doc_type?: string;
  due_date?: string;
  notes?: string;
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Парсит файл Excel (.xlsx, .xls) или CSV в массив строк
 */
export async function parseExcelOrCsvFile(file: File): Promise<RawImportRow[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Преобразуем в массив объектов с заголовками
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return normalizeImportRows(rows);
}

/**
 * Парсит скопированный текст из буфера обмена (Google Sheets / Excel copy-paste TSV)
 */
export function parsePastedTableText(text: string): RawImportRow[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Разбиваем по строкам
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  // Определяем разделитель (табуляция или запятая / точка с запятой)
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const headers = firstLine.split(delimiter).map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const dataRows = lines.slice(1);

  const rawRows: any[] = [];
  for (const line of dataRows) {
    const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      obj[header] = cols[idx] || '';
    });
    rawRows.push(obj);
  }

  return normalizeImportRows(rawRows);
}

/**
 * Нормализует заголовки колонок, поддерживая русские и английские варианты названий
 */
function normalizeImportRows(rawRows: any[]): RawImportRow[] {
  return rawRows.map((row) => {
    const normalized: RawImportRow = {};

    for (const [key, value] of Object.entries(row)) {
      const lowerKey = key.toLowerCase().replace(/[\s_.-]/g, '');
      const strVal = String(value || '').trim();

      // Название компании
      if (
        lowerKey.includes('название') ||
        lowerKey.includes('компания') ||
        lowerKey.includes('организация') ||
        lowerKey.includes('клиент') ||
        lowerKey.includes('наименование') ||
        lowerKey === 'name' ||
        lowerKey === 'company'
      ) {
        normalized.name = strVal;
      }
      // ИНН
      else if (lowerKey.includes('инн') || lowerKey === 'inn') {
        normalized.inn = strVal.replace(/\D/g, '');
      }
      // Форма собственности / Тип
      else if (lowerKey.includes('тип') || lowerKey.includes('форма') || lowerKey === 'clienttype' || lowerKey === 'type') {
        normalized.client_type = strVal;
      }
      // Налоговый режим
      else if (
        lowerKey.includes('режим') ||
        lowerKey.includes('налог') ||
        lowerKey.includes('система') ||
        lowerKey === 'taxtype'
      ) {
        normalized.tax_type = strVal;
      }
      // Район УГНС
      else if (
        lowerKey.includes('район') ||
        lowerKey.includes('угнс') ||
        lowerKey.includes('налоговая') ||
        lowerKey === 'district'
      ) {
        normalized.tax_office_district = strVal;
      }
      // Куратор / Бухгалтер
      else if (
        lowerKey.includes('куратор') ||
        lowerKey.includes('бухгалтер') ||
        lowerKey.includes('ответственный') ||
        lowerKey === 'curator'
      ) {
        normalized.curator = strVal;
      }
      // Телефон / WhatsApp
      else if (
        lowerKey.includes('телефон') ||
        lowerKey.includes('phone') ||
        lowerKey.includes('whatsapp') ||
        lowerKey.includes('ватсап') ||
        lowerKey.includes('номер')
      ) {
        normalized.phone = strVal;
      }
      // Telegram
      else if (
        lowerKey.includes('телеграм') ||
        lowerKey.includes('telegram') ||
        lowerKey.includes('тг')
      ) {
        normalized.telegram = strVal;
      }
      // Задача / Документ
      else if (
        lowerKey.includes('задача') ||
        lowerKey.includes('документ') ||
        lowerKey.includes('формагнс') ||
        lowerKey === 'task' ||
        lowerKey === 'doctype'
      ) {
        normalized.doc_type = strVal;
      }
      // Срок / Дедлайн
      else if (
        lowerKey.includes('срок') ||
        lowerKey.includes('дедлайн') ||
        lowerKey.includes('дата') ||
        lowerKey === 'duedate' ||
        lowerKey === 'date'
      ) {
        normalized.due_date = strVal;
      }
      // Примечание
      else if (
        lowerKey.includes('замет') ||
        lowerKey.includes('примеч') ||
        lowerKey.includes('коммент') ||
        lowerKey === 'notes'
      ) {
        normalized.notes = strVal;
      }
      // Остальные поля
      normalized[key] = strVal;
    }

    return normalized;
  });
}

/**
 * Преобразует строковую дату в формат YYYY-MM-DD
 */
function parseDateToIso(dateStr?: string): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  // Если уже YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Если DD.MM.YYYY
  const ruMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (ruMatch) {
    const d = ruMatch[1].padStart(2, '0');
    const m = ruMatch[2].padStart(2, '0');
    const y = ruMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Пытаемся стандартный Date
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Валидирует спарсенные строки для импорта в систему Учётки
 */
export function validateImportRows(rawRows: RawImportRow[]): ValidatedImportItem[] {
  return rawRows.map((row, index) => {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Имя
    const name = row.name || '';
    if (!name) {
      errors.push('Не указано название компании');
    }

    // ИНН (в КР 14 цифр)
    let inn = row.inn || '';
    if (!inn) {
      warnings.push('ИНН не заполнен');
    } else {
      if (inn.length !== 14) {
        warnings.push(`ИНН содержит ${inn.length} цифр (обычно в КР 14 цифр)`);
      }
    }

    // Тип организации
    let clientType: ClientType = 'ОсОО';
    const rawType = (row.client_type || '').toUpperCase();
    if (rawType.includes('ИП')) {
      clientType = 'ИП';
    } else if (rawType.includes('ОСОО') || rawType.includes('ОСOO') || rawType.includes('ООО')) {
      clientType = 'ОсОО';
    } else if (rawType.includes('ОФ')) {
      clientType = 'ОФ';
    } else if (rawType.includes('ОО')) {
      clientType = 'ОО';
    }

    // Режим
    const taxTypeName = row.tax_type || 'Единый налог';

    // Район
    const taxDistrict = row.tax_office_district || 'Первомайский';

    // Дедлайн задачи если есть
    let validDueDate = undefined;
    if (row.due_date) {
      const parsedIso = parseDateToIso(row.due_date);
      if (parsedIso) {
        validDueDate = parsedIso;
      } else {
        warnings.push(`Не удалось распознать дату "${row.due_date}"`);
      }
    }

    const isValid = errors.length === 0;

    return {
      id: `imp-${index}-${Date.now()}`,
      name,
      inn,
      client_type: clientType,
      tax_type_name: taxTypeName,
      tax_office_district: taxDistrict,
      phone: row.phone || '',
      telegram: row.telegram || '',
      doc_type: row.doc_type || undefined,
      due_date: validDueDate,
      notes: row.notes || '',
      isValid,
      warnings,
      errors,
    };
  });
}

/**
 * Выполняет пакетный импорт проверенных компаний и задач в базу данных
 */
export async function executeBatchImport(
  items: ValidatedImportItem[],
  currentUser: UserProfile,
  taxTypeMapping: Record<string, string> // map name to tax_type_id
): Promise<{ companiesCreated: number; tasksCreated: number }> {
  let companiesCreated = 0;
  let tasksCreated = 0;

  const existingCompanies = await getCompanies();
  const allUsers = await getAllUsers();
  const defaultAccountant = allUsers.find((u) => u.role === 'accountant') || currentUser;

  for (const item of items) {
    if (!item.isValid) continue;

    // Проверяем, существует ли компания по ИНН
    let company = item.inn
      ? existingCompanies.find((c) => c.inn === item.inn)
      : null;

    if (!company) {
      // Ищем tax_type_id
      let taxTypeId = 'tax-1'; // default единый налог
      const lower = item.tax_type_name.toLowerCase();
      if (lower.includes('общ')) {
        taxTypeId = 'tax-2';
      } else if (lower.includes('патент')) {
        taxTypeId = 'tax-3';
      }

      // Создаём компанию
      company = await createCompany({
        name: item.name,
        inn: item.inn || '00000000000000',
        client_type: item.client_type,
        tax_type_id: taxTypeId,
        tax_office_district: item.tax_office_district,
        curator_id: defaultAccountant.id,
        owner_id: currentUser.id,
        phone: item.phone || null,
        telegram_contact: item.telegram || null,
        notes: item.notes || null,
      });
      companiesCreated++;
    }

    // Если указана задача, создаём её для этой компании
    if (item.doc_type && company) {
      const dueDate = item.due_date || new Date().toISOString().split('T')[0];
      await createCompanyTasks({
        companyIds: [company.id],
        task: {
          company_id: company.id,
          doc_type: item.doc_type,
          due_date: dueDate,
          status: 'in_progress',
          notes: item.notes || 'Импортировано из таблицы',
        },
        executorIds: [defaultAccountant.id],
        controllerIds: currentUser.role === 'manager' ? [currentUser.id] : [],
      });
      tasksCreated++;
    }
  }

  // Записываем в аудит-лог
  await logActivity({
    userId: currentUser.id,
    userName: currentUser.full_name,
    actionType: 'import_batch',
    description: `Импортировано ${companiesCreated} компаний и ${tasksCreated} задач из Excel/Google Таблицы`,
    meta: { companiesCreated, tasksCreated, totalRows: items.length },
  });

  return { companiesCreated, tasksCreated };
}

/**
 * Создаёт и скачивает типовой шаблон Excel для импорта данных
 */
export function downloadSampleImportExcel() {
  const sampleData = [
    {
      'Название компании': 'ОсОО «Ала-Тоо Трейд»',
      'ИНН (14 цифр)': '02503202110192',
      'Форма (ИП/ОсОО)': 'ОсОО',
      'Режим налогообложения': 'Общий режим (НДС)',
      'Район УГНС': 'Первомайский',
      'Телефон / WhatsApp': '+996555123456',
      'Telegram': '@alatoo_manager',
      'Задача (первичный отчёт)': 'FORM STI-062 (НДС)',
      'Срок сдачи': '2026-11-25',
      'Примечание': 'Импорт продуктов питания',
    },
    {
      'Название компании': 'ИП Смирнов Алексей',
      'ИНН (14 цифр)': '21508198900451',
      'Форма (ИП/ОсОО)': 'ИП',
      'Режим налогообложения': 'Единый налог (малый бизнес)',
      'Район УГНС': 'Ленинский',
      'Телефон / WhatsApp': '+996700987654',
      'Telegram': '@smirnov_dev',
      'Задача (первичный отчёт)': 'FORM STI-091 (Единый налог Q4)',
      'Срок сдачи': '2027-01-20',
      'Примечание': 'IT консалтинг',
    },
    {
      'Название компании': 'ОсОО «Бишкек Логистик»',
      'ИНН (14 цифр)': '01204201910087',
      'Форма (ИП/ОсОО)': 'ОсОО',
      'Режим налогообложения': 'Единый налог (с сотрудниками)',
      'Район УГНС': 'Свердловский',
      'Телефон / WhatsApp': '+996500112233',
      'Telegram': '@bishkek_logistics',
      'Задача (первичный отчёт)': 'FORM STI-161 (Зарплатные налоги)',
      'Срок сдачи': '2026-11-20',
      'Примечание': 'Экспедиторские услуги',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Шаблон импорта');

  // Устанавливаем ширину колонок
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 18 },
    { wch: 16 },
    { wch: 26 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 26 },
    { wch: 14 },
    { wch: 28 },
  ];

  XLSX.writeFile(workbook, 'uchotka_shablon_importa.xlsx');
}
