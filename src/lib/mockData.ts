import { Company, TaxType, Task, UserProfile, AppNotification } from '../types';

// ДЕМО-КОДЫ ДЛЯ ВХОДА:
// Руководитель: manager@uchotka.agency / demo1234  (код приглашения для бухгалтеров: УЧЁТКА-2026)
// Бухгалтер 1:  bakyt@uchotka.agency  / demo1234
// Бухгалтер 2:  elena@uchotka.agency  / demo1234
// Бухгалтер 3:  ulan@uchotka.agency   / demo1234
export const MOCK_USERS: UserProfile[] = [
  {
    id: 'user-manager-1',
    email: 'manager@uchotka.agency',
    role: 'manager',
    full_name: 'Асель Токтогулова',
    notification_email: 'manager@uchotka.agency',
    invite_code: 'УЧЁТКА-2026',
    created_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 'user-acc-1',
    email: 'bakyt@uchotka.agency',
    role: 'accountant',
    full_name: 'Бакыт Муратов',
    notification_email: 'bakyt@uchotka.agency',
    manager_id: 'user-manager-1',
    created_at: '2026-01-15T09:00:00Z',
  },
  {
    id: 'user-acc-2',
    email: 'elena@uchotka.agency',
    role: 'accountant',
    full_name: 'Елена Ким',
    notification_email: 'elena@uchotka.agency',
    manager_id: 'user-manager-1',
    created_at: '2026-02-01T10:00:00Z',
  },
  {
    id: 'user-acc-3',
    email: 'ulan@uchotka.agency',
    role: 'accountant',
    full_name: 'Улан Джумабеков',
    notification_email: 'ulan@uchotka.agency',
    manager_id: 'user-manager-1',
    created_at: '2026-03-01T09:30:00Z',
  },
];

export const MOCK_TAX_TYPES: TaxType[] = [
  {
    id: 'tax-1',
    name: 'Единый налог',
    rate_description: 'Ставка 4% при безналичных расчетах (6% при наличных), освобождение от НДС и налога с продаж',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tax-2',
    name: 'Общий режим',
    rate_description: 'НДС 12%, налог на прибыль 10%, подоходный налог 10%, отчисления в Соцфонд 17.25%',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'tax-3',
    name: 'Патентная система / Специальный режим',
    rate_description: 'Фиксированная базовая ставка по виду деятельности + страховой полис Соцфонда',
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const MOCK_COMPANIES: Company[] = [
  {
    id: 'comp-1',
    owner_id: 'user-acc-1',
    name: 'ОсОО «Ала-Тоо Дистрибьюшн»',
    inn: '02503202110192',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2', // Общий
    notes: 'Оптовая торговля, импорт продуктов питания. Ежемесячный НДС и Соцфонд.',
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 'comp-2',
    owner_id: 'user-acc-1',
    name: 'ИП Смирнов А. В.',
    inn: '21508198900451',
    client_type: 'ИП',
    tax_type_id: 'tax-1', // Единый
    notes: 'Разработка ПО и IT-консалтинг. Клиенты на зарубеж, безналичные валютные поступления.',
    created_at: '2026-02-05T11:00:00Z',
  },
  {
    id: 'comp-3',
    owner_id: 'user-acc-1',
    name: 'ОсОО «Бишкек Логистик»',
    inn: '01204201910087',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2', // Общий
    notes: 'Транспортно-экспедиторские услуги, таможенное оформление.',
    created_at: '2026-02-14T09:00:00Z',
  },
  {
    id: 'comp-4',
    owner_id: 'user-acc-2',
    name: 'ОсОО «МедФарм Плюс»',
    inn: '00311201810432',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2', // Общий
    notes: 'Аптечная сеть, поставки медикаментов.',
    created_at: '2026-02-18T14:30:00Z',
  },
  {
    id: 'comp-5',
    owner_id: 'user-acc-2',
    name: 'ИП Садыкова Ж. Б.',
    inn: '10904199200388',
    client_type: 'ИП',
    tax_type_id: 'tax-1', // Единый
    notes: 'Сеть кофеен, кассовые аппараты ККМ онлайн.',
    created_at: '2026-02-22T12:00:00Z',
  },
  {
    id: 'comp-6',
    owner_id: 'user-acc-3',
    name: 'ИП Касымов Э. Н.',
    inn: '20101198500219',
    client_type: 'ИП',
    tax_type_id: 'tax-1', // Единый
    notes: 'Дизайн студия, интерьеры.',
    created_at: '2026-03-05T10:00:00Z',
  },
  {
    id: 'comp-7',
    owner_id: 'user-acc-3',
    name: 'ОсОО «Silk Road Build»',
    inn: '01809202010543',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2', // Общий
    notes: 'Строительные подрядные работы.',
    created_at: '2026-03-10T16:00:00Z',
  },
];

// Helper to format date offset
const getOffsetDate = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const MOCK_TASKS: Task[] = [
  // СЕГОДНЯ
  {
    id: 'task-1',
    company_id: 'comp-1',
    doc_type: 'Отчёт по подоходному налогу и Соцфонду (STI-161)',
    due_date: getOffsetDate(0),
    status: 'in_progress',
    notes: 'Собрать табель за прошлый месяц, проверить больничный лист бухгалтера.',
    created_at: '2026-09-20T08:00:00Z',
  },
  {
    id: 'task-2',
    company_id: 'comp-2',
    doc_type: 'Ежемесячный отчёт по Единому налогу',
    due_date: getOffsetDate(0),
    status: 'in_progress',
    notes: 'Сверить выписку по валютному счёту за месяц.',
    created_at: '2026-09-21T09:00:00Z',
  },
  // НА ЭТОЙ НЕДЕЛЕ
  {
    id: 'task-3',
    company_id: 'comp-1',
    doc_type: 'Декларация по НДС (STI-062)',
    due_date: getOffsetDate(3),
    status: 'in_progress',
    notes: 'Сверить входящие электронные счета-фактуры (ЭСФ) от поставщиков.',
    created_at: '2026-09-18T10:00:00Z',
  },
  {
    id: 'task-4',
    company_id: 'comp-4',
    doc_type: 'Расчётная ведомость по заработной плате',
    due_date: getOffsetDate(2),
    status: 'in_progress',
    notes: 'Проверить премиальный фонд фармацевтов.',
    created_at: '2026-09-19T11:00:00Z',
  },
  {
    id: 'task-5',
    company_id: 'comp-6',
    doc_type: 'Квитанция об оплате страхового полиса',
    due_date: getOffsetDate(4),
    status: 'in_progress',
    notes: 'Отправить клиенту QR-код для оплаты через мобильный банкинг.',
    created_at: '2026-09-22T08:30:00Z',
  },
  // ПОЗЖЕ
  {
    id: 'task-6',
    company_id: 'comp-3',
    doc_type: 'Статистический отчёт 1-Инвест (Квартал)',
    due_date: getOffsetDate(12),
    status: 'in_progress',
    notes: 'Сформировать данные по капвложениям в автопарк.',
    created_at: '2026-09-15T09:00:00Z',
  },
  {
    id: 'task-7',
    company_id: 'comp-7',
    doc_type: 'Налог на имущество и землю',
    due_date: getOffsetDate(18),
    status: 'in_progress',
    notes: 'Сверить кадастровую стоимость новых складских помещений.',
    created_at: '2026-09-14T14:00:00Z',
  },
  // ОЖИДАЕТ ОТВЕТА (waiting)
  {
    id: 'task-8',
    company_id: 'comp-1',
    doc_type: 'Уточненный расчет по налогу на прибыль',
    due_date: getOffsetDate(-1),
    status: 'waiting',
    wait_until: getOffsetDate(5),
    notes: 'Отправлен запрос в УГНС по зачёту переплаты за 2025 год. Ждём акт сверки.',
    created_at: '2026-09-10T12:00:00Z',
  },
  {
    id: 'task-9',
    company_id: 'comp-5',
    doc_type: 'Сверка по фискальным чекам ККМ онлайн',
    due_date: getOffsetDate(1),
    status: 'waiting',
    wait_until: getOffsetDate(3),
    notes: 'Запрошены Z-отчеты у директора точки за 12-14 числа.',
    created_at: '2026-09-23T15:00:00Z',
  },
  // СДАНО / ВЫПОЛНЕНО (submitted / done)
  {
    id: 'task-10',
    company_id: 'comp-2',
    doc_type: 'Квартальный баланс (Форма 1 и 2)',
    due_date: getOffsetDate(-5),
    status: 'done',
    notes: 'Принят без замечаний. Квитанция о принятии в личном кабинете Салык.',
    created_at: '2026-09-01T10:00:00Z',
  },
  {
    id: 'task-11',
    company_id: 'comp-3',
    doc_type: 'Декларация по налогу на нерезидентов',
    due_date: getOffsetDate(-2),
    status: 'submitted',
    notes: 'Отправлено через кабинет налогоплательщика, статус "На обработке".',
    created_at: '2026-09-05T11:00:00Z',
  },
  // ПРОСРОЧЕНО
  {
    id: 'task-12',
    company_id: 'comp-7',
    doc_type: 'Справка о неимении задолженности по Соцфонду',
    due_date: getOffsetDate(-3),
    status: 'in_progress',
    notes: 'Клиент не предоставил копию квитанции за прошлый месяц!',
    created_at: '2026-09-12T16:00:00Z',
  },
];

export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    user_id: 'user-acc-1',
    task_id: 'task-1',
    message: 'Дедлайн сегодня: Отчёт по подоходному налогу и Соцфонду (STI-161) по компании «Ала-Тоо Дистрибьюшн»',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'notif-2',
    user_id: 'user-acc-1',
    task_id: 'task-3',
    message: 'Напоминание (через 3 дня): Декларация по НДС (STI-062) по компании «Ала-Тоо Дистрибьюшн»',
    is_read: false,
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'notif-3',
    user_id: 'user-acc-1',
    task_id: 'task-10',
    message: 'Задача «Квартальный баланс (Форма 1 и 2)» успешно сдана и подтверждена',
    is_read: true,
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
];

export const COMMON_DOC_TYPES = [
  'Отчёт по подоходному налогу и Соцфонду (STI-161)',
  'Ежемесячный отчёт по Единому налогу',
  'Декларация по НДС (STI-062)',
  'Налог на прибыль (годовой/авансовый STI-102)',
  'Налог с продаж (STI-063)',
  'Статистический отчёт 1-Инвест',
  'Статистический отчёт 1-ТП',
  'Квитанция и расчет страховых взносов (СФ)',
  'Акт сверки расчетов с бюджетом (Салык)',
  'Квартальная финансовая отчетность',
];
