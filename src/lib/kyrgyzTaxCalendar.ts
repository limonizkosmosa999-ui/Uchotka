import { TaxObligationRule, TaxPackageTemplate, ClientType } from '../types';

/**
 * Справочник форм и налогов Налогового Кодекса Кыргызской Республики (НК КР)
 * Каждая запись содержит:
 * - tax_code: налог или режим
 * - form_code: код формы ГНС (STI)
 * - payer_types: плательщики (организация, ИП, физлицо, налоговый агент)
 * - period: месяц / квартал / год / событие / информационный расчет
 * - deadline_rule: правило дедлайна (НК КР: 20-е число следующего месяца, НДС - 25-е, ЕНД - 1 апр/1 мая)
 * - payment_deadline_rule: срок уплаты
 */
export const KYRGYZ_TAX_RULES: TaxObligationRule[] = [
  {
    id: 'sti-161',
    tax_code: 'Подоходный налог и взносы ГСС',
    form_code: 'FORM STI-161',
    name: 'Отчёт по подоходному налогу и взносам по государственному социальному страхованию',
    payer_types: ['organization', 'individual_entrepreneur', 'tax_agent'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    payment_deadline_rule: 'Не позднее 20 числа следующего месяца',
    description: 'Обязательный ежемесячный отчёт работодателя или налогового агента по начисленной заработной плате и страховым взносам сотрудников.',
    category: 'payroll',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 187, Закон о государственном социальном страховании',
  },
  {
    id: 'sti-062',
    tax_code: 'НДС (Налог на добавленную стоимость)',
    form_code: 'FORM STI-062',
    name: 'Отчёт по налогу на добавленную стоимость',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'month',
    deadline_rule: 'Обычно до 25 числа следующего месяца; для функционального подразделения ГНС — до последнего дня месяца',
    payment_deadline_rule: 'Не позднее 25 числа следующего месяца',
    description: 'Ежемесячный отчёт по облагаемым поставкам, импорту и зачёту НДС (12%).',
    category: 'vat',
    default_day_of_month: 25,
    legal_reference: 'НК КР ст. 256',
  },
  {
    id: 'sti-091-small',
    tax_code: 'Единый налог (малый бизнес)',
    form_code: 'FORM STI-091',
    name: 'Отчёт по единому налогу — субъект малого предпринимательства',
    payer_types: ['individual_entrepreneur', 'organization'],
    period: 'quarter',
    deadline_rule: 'Не позднее 20 числа месяца, следующего за кварталом (20 апреля, 20 июля, 20 октября, 20 января)',
    payment_deadline_rule: 'Не позднее 20 числа месяца, следующего за кварталом',
    description: 'Квартальная отчётность для малого бизнеса на упрощённой системе налогообложения по ставкам единого налога.',
    category: 'single_tax',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 367',
  },
  {
    id: 'sti-091-medium',
    tax_code: 'Единый налог (средний бизнес)',
    form_code: 'FORM STI-091',
    name: 'Отчёт по единому налогу — субъект среднего предпринимательства',
    payer_types: ['individual_entrepreneur', 'organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    payment_deadline_rule: 'Не позднее 20 числа следующего месяца',
    description: 'Ежемесячная отчётность субъектов среднего бизнеса на режиме единого налога.',
    category: 'single_tax',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 367',
  },
  {
    id: 'sti-129',
    tax_code: 'Налог с продаж',
    form_code: 'FORM STI-129',
    name: 'Отчёт по налогу с продаж',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    payment_deadline_rule: 'Не позднее 20 числа следующего месяца',
    description: 'Ежемесячный отчёт по реализации товаров, работ и услуг (ставка 1-3%).',
    category: 'special',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 317',
  },
  {
    id: 'sti-107',
    tax_code: 'Налог на прибыль — предварительные платежи',
    form_code: 'FORM STI-107',
    name: 'Расчёт предварительной суммы налога на прибыль',
    payer_types: ['organization'],
    period: 'quarter',
    deadline_rule: 'Не позднее 20 числа месяца, следующего за кварталом',
    payment_deadline_rule: 'Не позднее 20 числа месяца, следующего за кварталом',
    description: 'Квартальные авансовые платежи по налогу на прибыль для юридических лиц на общем режиме.',
    category: 'profit',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 219',
  },
  {
    id: 'sti-101',
    tax_code: 'ЕНД — Организация (Единая налоговая декларация)',
    form_code: 'FORM STI-101',
    name: 'Единая налоговая декларация юридического лица (ЕНД)',
    payer_types: ['organization'],
    period: 'year',
    deadline_rule: 'До 1 апреля года, следующего за отчётным',
    payment_deadline_rule: 'До 1 апреля года, следующего за отчётным',
    description: 'Главный годовой отчёт организации: финансовые результаты, активы, расчёт налога на прибыль за год.',
    category: 'annual',
    annual_deadline_month: 4, // Апрель
    annual_deadline_day: 1,
    legal_reference: 'НК КР ст. 98, 102',
  },
  {
    id: 'sti-102',
    tax_code: 'ЕНД — Индивидуальный предприниматель',
    form_code: 'FORM STI-102',
    name: 'Единая налоговая декларация индивидуального предпринимателя',
    payer_types: ['individual_entrepreneur'],
    period: 'year',
    deadline_rule: 'До 1 мая года, следующего за отчётным',
    payment_deadline_rule: 'До 1 мая года, следующего за отчётным',
    description: 'Годовая декларация доходов и имущества физического лица, зарегистрированного в качестве ИП.',
    category: 'annual',
    annual_deadline_month: 5, // Май
    annual_deadline_day: 1,
    legal_reference: 'НК КР ст. 98, 103',
  },
  {
    id: 'sti-100',
    tax_code: 'ЕНД — Физическое лицо',
    form_code: 'FORM STI-100',
    name: 'Единая налоговая декларация физического лица, не ведущего предприн. деятельность',
    payer_types: ['physical_person'],
    period: 'year',
    deadline_rule: 'До 1 мая года, следующего за отчётным',
    payment_deadline_rule: 'До 1 мая года, следующего за отчётным',
    description: 'Годовая декларация имущества и доходов граждан Кыргызской Республики.',
    category: 'annual',
    annual_deadline_month: 5,
    annual_deadline_day: 1,
    legal_reference: 'НК КР ст. 98, 104',
  },
  {
    id: 'sti-155',
    tax_code: 'ЕНД — Государственный и муниципальный служащий',
    form_code: 'FORM STI-155',
    name: 'Единая налоговая декларация лиц, замещающих государственные и муниципальные должности',
    payer_types: ['physical_person'],
    period: 'year',
    deadline_rule: 'По правилам декларирования для данной категории (до 1 апреля / 1 мая)',
    category: 'annual',
    annual_deadline_month: 4,
    annual_deadline_day: 1,
    description: 'Специальная форма декларации активов и доходов госслужащих.',
    legal_reference: 'НК КР ст. 105',
  },
  {
    id: 'sti-123',
    tax_code: 'Косвенные налоги при импорте/экспорте (ЕАЭС)',
    form_code: 'FORM STI-123',
    name: 'Отчёт по косвенным налогам при импорте товаров с территории государств-членов ЕАЭС',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца, если иной срок не установлен',
    payment_deadline_rule: 'Не позднее 20 числа месяца, следующего за принятием на учёт импортированных товаров',
    description: 'Отчётность участников ВЭД по импорту товаров из стран ЕАЭС (Россия, Казахстан, Беларусь, Армения). Заявление о ввозе товаров и уплате косвенных налогов.',
    category: 'vat',
    default_day_of_month: 20,
    legal_reference: 'Договор о ЕАЭС, НК КР гл. 37',
  },
  {
    id: 'sti-167',
    tax_code: 'НДС — налоговый агент',
    form_code: 'FORM STI-167',
    name: 'Отчёт налогового агента по налогу на добавленную стоимость',
    payer_types: ['tax_agent', 'organization', 'individual_entrepreneur'],
    period: 'event',
    deadline_rule: 'Не позднее 20 числа месяца, следующего за месяцем возникновения обязательства',
    payment_deadline_rule: 'Одновременно с выплатой нерезиденту или не позднее 20 числа следующего месяца',
    description: 'Отчётность при покупке работ/услуг у иностранных компаний без постоянного учреждения в КР.',
    category: 'vat',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 253',
  },
  {
    id: 'sti-165',
    tax_code: 'НДС на электронные услуги иностранной организации',
    form_code: 'FORM STI-165',
    name: 'Отчёт по НДС на электронные услуги (Google-налог в КР)',
    payer_types: ['foreign_org'],
    period: 'month',
    deadline_rule: 'По правилам отчётности по НДС (до 25 числа следующего месяца)',
    payment_deadline_rule: 'До 25 числа следующего месяца',
    description: 'Отчётность иностранных IT-корпораций и сервисов, предоставляющих услуги физлицам в Кыргызстане.',
    category: 'vat',
    default_day_of_month: 25,
    legal_reference: 'НК КР разд. XI-1',
  },
  {
    id: 'sti-070',
    tax_code: 'Акцизный налог',
    form_code: 'FORM STI-070',
    name: 'Отчёт по акцизному налогу',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    payment_deadline_rule: 'Не позднее 20 числа следующего месяца',
    description: 'Отчётность производителей и импортёров подакцизной продукции (ГСМ, табак, алкоголь).',
    category: 'excise',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 290',
  },
  {
    id: 'sti-106',
    tax_code: 'Налог на доходы иностранной организации',
    form_code: 'FORM STI-106',
    name: 'Отчёт по налогу на доходы иностранной организации у источника выплаты',
    payer_types: ['tax_agent', 'organization'],
    period: 'event',
    deadline_rule: 'Не позднее 20 числа месяца, следующего за месяцем выплаты дохода',
    payment_deadline_rule: 'В день выплаты дохода либо не позднее 20 числа следующего месяца',
    description: 'Удержание налога у источника при выплате дивидендов, процентов, роялти нерезидентам КР.',
    category: 'profit',
    default_day_of_month: 20,
    legal_reference: 'НК КР ст. 222',
  },
  {
    id: 'sti-138',
    tax_code: 'Роялти малого бизнеса',
    form_code: 'FORM STI-138',
    name: 'Отчёт по роялти субъекта малого предпринимательства',
    payer_types: ['individual_entrepreneur', 'organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Отчисления за право пользования недрами для малых предприятий.',
    legal_reference: 'НК КР ст. 343',
  },
  {
    id: 'sti-139',
    tax_code: 'Роялти среднего бизнеса',
    form_code: 'FORM STI-139',
    name: 'Отчёт по роялти субъекта среднего предпринимательства',
    payer_types: ['organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Отчисления за недропользование для средних компаний.',
    legal_reference: 'НК КР ст. 343',
  },
  {
    id: 'sti-140',
    tax_code: 'Роялти прочих налогоплательщиков',
    form_code: 'FORM STI-140',
    name: 'Отчёт по роялти не субъектов МСП/ССП',
    payer_types: ['organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Отчисления за недропользование для крупных недропользователей.',
    legal_reference: 'НК КР ст. 343',
  },
  {
    id: 'sti-163',
    tax_code: 'Налог на майнинг',
    form_code: 'FORM STI-163',
    name: 'Отчёт по налогу на деятельность по майнингу криптовалют',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    payment_deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Специальный налог на потребленную электроэнергию при майнинге виртуальных активов.',
    legal_reference: 'НК КР ст. 377',
  },
  {
    id: 'sti-168',
    tax_code: 'Налог на электронную торговлю',
    form_code: 'FORM STI-168',
    name: 'Отчёт по специальному налогу на деятельность в сфере электронной торговли',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Специальный режим для маркетплейсов и интернет-магазинов (ставка 2%).',
    legal_reference: 'НК КР ст. 385',
  },
  {
    id: 'sti-170',
    tax_code: 'Налог на игорную деятельность',
    form_code: 'FORM STI-170',
    name: 'Отчёт по налогу на игорную деятельность (казино, залы игровых автоматов)',
    payer_types: ['organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Налог с игорных столов, игровых автоматов и касс тотализатора.',
    legal_reference: 'НК КР ст. 353',
  },
  {
    id: 'sti-171',
    tax_code: 'Налог на онлайн-казино',
    form_code: 'FORM STI-171',
    name: 'Отчёт по налогу на деятельность виртуальных / онлайн-казино',
    payer_types: ['organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Отчётность лицензированных операторов онлайн-гемблинга.',
    legal_reference: 'НК КР ст. 353-1',
  },
  {
    id: 'sti-228',
    tax_code: 'Налог на транзакцию',
    form_code: 'FORM STI-228',
    name: 'Отчёт по налогу на финансовые транзакции',
    payer_types: ['organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Отчётность платёжных организаций и банков по облагаемым транзакциям.',
    legal_reference: 'НК КР ст. 392',
  },
  {
    id: 'doc-sti-157',
    tax_code: 'Отчисления на местную инфраструктуру',
    form_code: 'DOC STI-157',
    name: 'Расчёт отчислений на развитие и воспроизводство инфраструктуры местного значения',
    payer_types: ['organization'],
    period: 'month',
    deadline_rule: 'Не позднее 20 числа следующего месяца',
    category: 'special',
    default_day_of_month: 20,
    description: 'Отчисления недропользователей в фонды развития районов и айыл окмоту.',
    legal_reference: 'Закон КР о неналоговых доходах',
  },
  {
    id: 'sti-158',
    tax_code: 'Сбор за вывоз мусора',
    form_code: 'FORM STI-158',
    name: 'Расчёт сбора за вывоз мусора и твёрдых бытовых отходов',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'quarter',
    deadline_rule: 'Не позднее 20 числа месяца, следующего за отчётным кварталом',
    category: 'property',
    default_day_of_month: 20,
    description: 'Местный сбор предприятий и объектов торговли за утилизацию ТБО.',
    legal_reference: 'НК КР разд. XV',
  },
  {
    id: 'sti-087',
    tax_code: 'Налог на имущество — нежилые объекты',
    form_code: 'FORM STI-087',
    name: 'Информационный расчёт по налогу на имущество 2 группы (нежилые здания и помещения)',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'info_calc',
    deadline_rule: 'До 1 апреля года налогового периода (либо при возникновении права)',
    payment_deadline_rule: 'Поквартально равными долями до 20 числа второго месяца квартала',
    category: 'property',
    annual_deadline_month: 4,
    annual_deadline_day: 1,
    description: 'Расчёт налога на коммерческую недвижимость, склады, офисы и производственные здания.',
    legal_reference: 'НК КР ст. 331',
  },
  {
    id: 'sti-077',
    tax_code: 'Земельный налог',
    form_code: 'FORM STI-077',
    name: 'Информационный расчёт по земельному налогу (земли населенных пунктов и несельхоз назначения)',
    payer_types: ['organization', 'individual_entrepreneur'],
    period: 'info_calc',
    deadline_rule: 'До 1 апреля года налогового периода',
    payment_deadline_rule: 'Ежемесячно до 25 числа месяца',
    category: 'property',
    annual_deadline_month: 4,
    annual_deadline_day: 1,
    description: 'Расчёт земельного налога за участки в собственности или пользовании.',
    legal_reference: 'НК КР ст. 339',
  },
  {
    id: 'sti-068',
    tax_code: 'Возврат НДС диппредставительствам',
    form_code: 'FORM STI-068',
    name: 'Заявление и расчёт на возмещение НДС дипломатическим представительствам',
    payer_types: ['diplomatic'],
    period: 'event',
    deadline_rule: 'По факту обращения дипломатического ведомства',
    category: 'vat',
    description: 'Форма для дипломатических миссий и приравненных к ним международных организаций.',
    legal_reference: 'НК КР ст. 279',
  },
];

/**
 * Готовые шаблоны пакетов отчётности для типичных налоговых режимов Кыргызстана.
 * Позволяют в 1 клик сгенерировать все задачи на год вперёд!
 */
export const KYRGYZ_TAX_TEMPLATES: TaxPackageTemplate[] = [
  {
    id: 'ip_single_tax_small',
    name: 'ИП на едином налоге (малый бизнес без сотрудников)',
    client_type: 'ИП',
    tax_type_id: 'tax-1',
    badge: 'ИП • Единый налог 4-6%',
    description: 'Стандартный режим для малого бизнеса, IT, услуг, торговли без наёмных работников. 4 квартальных отчёта STI-091 + годовая ЕНД ИП STI-102.',
    form_codes: ['FORM STI-091', 'FORM STI-102'],
    has_employees_default: false,
    default_tasks_count: 5,
    notes: 'Q1-Q4 единый налог (до 20 апреля, июля, октября, января) и годовая ЕНД ИП до 1 мая.',
  },
  {
    id: 'ip_single_tax_employees',
    name: 'ИП на едином налоге (с наёмными сотрудниками)',
    client_type: 'ИП',
    tax_type_id: 'tax-1',
    badge: 'ИП • Единый налог + Штат',
    description: 'ИП с наёмными работниками: 4 квартальных STI-091 + 12 ежемесячных отчётов по подоходному налогу и Соцфонду STI-161 + годовая ЕНД ИП STI-102.',
    form_codes: ['FORM STI-091', 'FORM STI-161', 'FORM STI-102'],
    has_employees_default: true,
    default_tasks_count: 17,
    notes: 'Ежемесячно до 20 числа зарплатные налоги (STI-161), поквартально единый налог, 1 мая — ЕНД.',
  },
  {
    id: 'osoo_single_tax',
    name: 'ОсОО на едином налоге (малый бизнес)',
    client_type: 'ОсОО',
    tax_type_id: 'tax-1',
    badge: 'ОсОО • Единый налог',
    description: 'Организация на упрощённом режиме: 4 квартальных STI-091 + 12 ежемесячных STI-161 (зарплата руководителя/штата) + годовая ЕНД юрлица STI-101 (до 1 апреля).',
    form_codes: ['FORM STI-091', 'FORM STI-161', 'FORM STI-101'],
    has_employees_default: true,
    default_tasks_count: 17,
    notes: 'Ежемесячный отчёт STI-161, 4 квартальных STI-091, годовая ЕНД юридического лица до 1 апреля.',
  },
  {
    id: 'osoo_general_vat',
    name: 'ОсОО на общем режиме (с НДС и налогом с продаж)',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2',
    badge: 'ОсОО • Общий режим + НДС',
    description: 'Классический полный бухгалтерский пакет: ежемесячный НДС STI-062 (до 25 числа), ежемесячный налог с продаж STI-129, ежемесячный STI-161, 4 аванса по налогу на прибыль STI-107 + годовая ЕНД STI-101.',
    form_codes: ['FORM STI-062', 'FORM STI-161', 'FORM STI-129', 'FORM STI-107', 'FORM STI-101'],
    has_employees_default: true,
    default_tasks_count: 41,
    notes: 'Полный учёт: НДС до 25 числа, остальные ежемесячные до 20 числа, авансы прибыли по кварталам, ЕНД до 1 апреля.',
  },
  {
    id: 'osoo_general_no_vat',
    name: 'ОсОО на общем режиме (без НДС)',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2',
    badge: 'ОсОО • Общий без НДС',
    description: 'Организация на общем режиме без превышения порога НДС: ежемесячный налог с продаж STI-129, зарплатный STI-161, квартальные авансы прибыли STI-107, годовая ЕНД STI-101.',
    form_codes: ['FORM STI-161', 'FORM STI-129', 'FORM STI-107', 'FORM STI-101'],
    has_employees_default: true,
    default_tasks_count: 29,
    notes: 'Без НДС. Зарплата и продажи ежемесячно до 20 числа, авансы прибыли ежеквартально, ЕНД до 1 апреля.',
  },
  {
    id: 'ip_patent',
    name: 'ИП на патентной системе (патент + полис)',
    client_type: 'ИП',
    tax_type_id: 'tax-3',
    badge: 'ИП • Патент',
    description: 'Деятельность на основе добровольного или обязательного патента: ежемесячное продление патента и страхового полиса Соцфонда + годовая ЕНД ИП STI-102 (до 1 мая).',
    form_codes: ['Налоговый патент КР', 'Полис Соцфонда ГСС', 'FORM STI-102'],
    has_employees_default: false,
    default_tasks_count: 25,
    notes: 'Ежемесячная уплата патента и страхового полиса ГСС до начала налогового периода, годовая ЕНД до 1 мая.',
  },
  {
    id: 'ved_import_eaes',
    name: 'Участник ВЭД / Импорт из стран ЕАЭС',
    client_type: 'ОсОО',
    tax_type_id: 'tax-2',
    badge: 'ВЭД • Импорт ЕАЭС',
    description: 'Специальный пакет для импортеров товаров из РФ/РК/РБ: ежемесячный отчёт по косвенным налогам STI-123 (до 20 числа) + зачётный НДС STI-062 (до 25 числа).',
    form_codes: ['FORM STI-123', 'FORM STI-062'],
    has_employees_default: false,
    default_tasks_count: 24,
    notes: 'Косвенные налоги до 20 числа месяца следующего за ввозом товара, НДС до 25 числа.',
  },
];

export interface GeneratedTaskPreview {
  id: string;
  doc_type: string;
  form_code: string;
  due_date: string; // YYYY-MM-DD
  period_label: string; // "За январь 2026", "За I квартал 2026", "За 2026 год"
  notes: string;
  category: string;
  is_selected: boolean;
}

const MONTH_NAMES = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'
];

/**
 * Форматирует дату YYYY-MM-DD
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Создает дату в формате YYYY-MM-DD
 */
function formatISODate(year: number, month1Indexed: number, day: number): string {
  // Проверяем, сколько дней в этом месяце
  const lastDay = new Date(year, month1Indexed, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return `${year}-${pad2(month1Indexed)}-${pad2(safeDay)}`;
}

/**
 * Рассчитывает полный календарный список задач на указанный календарный год
 * для выбранных форм налоговой отчетности КР.
 *
 * Правила дедлайнов НК КР:
 * 1. Ежемесячные формы (STI-161, STI-129, STI-070, STI-123, STI-091 средний бизнес):
 *    Дедлайн = 20-е число СЛЕДУЮЩЕГО месяца (за январь -> до 20 февраля; за декабрь -> до 20 января след. года).
 * 2. НДС (STI-062):
 *    Дедлайн = 25-е число СЛЕДУЮЩЕГО месяца (за январь -> до 25 февраля).
 * 3. Квартальные формы (STI-091 малый бизнес, STI-107 авансы прибыли):
 *    Q1 -> 20 апреля
 *    Q2 -> 20 июля
 *    Q3 -> 20 октября
 *    Q4 -> 20 января СЛЕДУЮЩЕГО года
 * 4. ЕНД Организации (STI-101):
 *    За отчётный год -> фиксированно 1 апреля СЛЕДУЮЩЕГО года.
 * 5. ЕНД ИП и физлица (STI-102, STI-100):
 *    За отчётный год -> фиксированно 1 мая СЛЕДУЮЩЕГО года.
 * 6. Налог на имущество и землю (STI-087, STI-077):
 *    Информационный расчёт -> 1 апреля текущего года.
 */
export function generateAnnualTasksForForm(
  rule: TaxObligationRule,
  reportingYear: number
): GeneratedTaskPreview[] {
  const result: GeneratedTaskPreview[] = [];

  // ЕЖЕМЕСЯЧНЫЕ ФОРМЫ
  if (rule.period === 'month') {
    const day = rule.default_day_of_month || 20;

    for (let m = 0; m < 12; m++) {
      const reportingMonthName = MONTH_NAMES[m];
      // Дедлайн в следующем месяце
      let dueYear = reportingYear;
      let dueMonth = m + 2; // 1-indexed next month

      if (dueMonth > 12) {
        dueMonth = 1;
        dueYear = reportingYear + 1;
      }

      const dueDate = formatISODate(dueYear, dueMonth, day);
      const docType = `${rule.form_code} (${rule.tax_code}) — за ${reportingMonthName} ${reportingYear}`;

      result.push({
        id: `${rule.id}-${reportingYear}-m${m + 1}`,
        doc_type: docType,
        form_code: rule.form_code,
        due_date: dueDate,
        period_label: `За ${reportingMonthName} ${reportingYear} г.`,
        notes: `Срок сдачи по НК КР: до ${day} числа месяца, следующего за отчётным. ${rule.description}`,
        category: rule.category,
        is_selected: true,
      });
    }
  }

  // КВАРТАЛЬНЫЕ ФОРМЫ
  else if (rule.period === 'quarter') {
    const quarters = [
      { name: 'I квартал', dueMonth: 4, dueDay: 20, dueYear: reportingYear },
      { name: 'II квартал', dueMonth: 7, dueDay: 20, dueYear: reportingYear },
      { name: 'III квартал', dueMonth: 10, dueDay: 20, dueYear: reportingYear },
      { name: 'IV квартал', dueMonth: 1, dueDay: 20, dueYear: reportingYear + 1 },
    ];

    quarters.forEach((q, idx) => {
      const dueDate = formatISODate(q.dueYear, q.dueMonth, q.dueDay);
      const docType = `${rule.form_code} (${rule.tax_code}) — за ${q.name} ${reportingYear}`;

      result.push({
        id: `${rule.id}-${reportingYear}-q${idx + 1}`,
        doc_type: docType,
        form_code: rule.form_code,
        due_date: dueDate,
        period_label: `За ${q.name} ${reportingYear} г.`,
        notes: `Срок сдачи по НК КР: не позднее 20 числа месяца, следующего за отчётным кварталом. ${rule.description}`,
        category: rule.category,
        is_selected: true,
      });
    });
  }

  // ГОДОВЫЕ ФОРМЫ (ЕНД)
  else if (rule.period === 'year') {
    const dueYear = reportingYear + 1;
    const dueMonth = rule.annual_deadline_month || 4; // Апрель по умолчанию
    const dueDay = rule.annual_deadline_day || 1;
    const dueDate = formatISODate(dueYear, dueMonth, dueDay);

    const docType = `${rule.form_code} (${rule.tax_code}) — годовая за ${reportingYear} год`;

    result.push({
      id: `${rule.id}-${reportingYear}-annual`,
      doc_type: docType,
      form_code: rule.form_code,
      due_date: dueDate,
      period_label: `За ${reportingYear} год`,
      notes: `Срок сдачи по НК КР: до ${dueDay} ${dueMonth === 4 ? 'апреля' : 'мая'} ${dueYear} года. ${rule.description}`,
      category: rule.category,
      is_selected: true,
    });
  }

  // ИНФОРМАЦИОННЫЕ РАСЧЕТЫ (Имущество, земля)
  else if (rule.period === 'info_calc') {
    const dueMonth = rule.annual_deadline_month || 4;
    const dueDay = rule.annual_deadline_day || 1;
    const dueDate = formatISODate(reportingYear, dueMonth, dueDay);

    const docType = `${rule.form_code} (${rule.tax_code}) — расчет на ${reportingYear} год`;

    result.push({
      id: `${rule.id}-${reportingYear}-calc`,
      doc_type: docType,
      form_code: rule.form_code,
      due_date: dueDate,
      period_label: `На ${reportingYear} год`,
      notes: `Срок представления информационного расчета: до ${dueDay} апреля текущего года. ${rule.description}`,
      category: rule.category,
      is_selected: true,
    });
  }

  // СОБЫТИЙНЫЕ ФОРМЫ (по факту)
  else if (rule.period === 'event') {
    // Создаем образец на ближайший месяц
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const dueMonth = currentMonth + 2 > 12 ? 1 : currentMonth + 2;
    const dueYear = currentMonth + 2 > 12 ? currentYear + 1 : currentYear;
    const dueDate = formatISODate(dueYear, dueMonth, 20);

    result.push({
      id: `${rule.id}-${reportingYear}-event-1`,
      doc_type: `${rule.form_code} (${rule.tax_code}) — по факту возникновения обязательства`,
      form_code: rule.form_code,
      due_date: dueDate,
      period_label: `По факту обязательства (${reportingYear} г.)`,
      notes: `${rule.deadline_rule}. ${rule.description}`,
      category: rule.category,
      is_selected: true,
    });
  }

  return result;
}

/**
 * Генерирует полный набор задач на календарный год по выбранному готовому шаблону
 */
export function generateAnnualTasksFromTemplate(
  template: TaxPackageTemplate,
  reportingYear: number
): GeneratedTaskPreview[] {
  let allTasks: GeneratedTaskPreview[] = [];

  // Специальная обработка патента
  if (template.id === 'ip_patent') {
    // 12 месяцев патента
    for (let m = 0; m < 12; m++) {
      const monthName = MONTH_NAMES[m];
      const dueMonth = m + 1;
      const dueDate = formatISODate(reportingYear, dueMonth, 1); // До 1 числа месяца
      allTasks.push({
        id: `patent-tax-${reportingYear}-m${m + 1}`,
        doc_type: `Налоговый патент КР — за ${monthName} ${reportingYear}`,
        form_code: 'Патент ГНС',
        due_date: dueDate,
        period_label: `За ${monthName} ${reportingYear} г.`,
        notes: `Продление и оплата добровольного/обязательного патента до начала месяца.`,
        category: 'single_tax',
        is_selected: true,
      });
      allTasks.push({
        id: `patent-polis-${reportingYear}-m${m + 1}`,
        doc_type: `Страховой полис Соцфонда ГСС — за ${monthName} ${reportingYear}`,
        form_code: 'Полис Соцфонда',
        due_date: dueDate,
        period_label: `За ${monthName} ${reportingYear} г.`,
        notes: `Приобретение ежемесячного страхового полиса государственного социального страхования.`,
        category: 'payroll',
        is_selected: true,
      });
    }
    // Годовая ЕНД ИП
    const sti102Rule = KYRGYZ_TAX_RULES.find((r) => r.id === 'sti-102');
    if (sti102Rule) {
      allTasks.push(...generateAnnualTasksForForm(sti102Rule, reportingYear));
    }
    return allTasks;
  }

  // Для других шаблонов: собираем правила по кодам форм
  for (const formCode of template.form_codes) {
    // Находим соответствующее правило в базе НК КР
    const rules = KYRGYZ_TAX_RULES.filter((r) => r.form_code === formCode);

    // Если несколько (например STI-091 малый и средний бизнес), берем малый для ИП/малого ОсОО
    const matchingRule = rules.length > 1
      ? rules.find((r) => r.id.includes('small')) || rules[0]
      : rules[0];

    if (matchingRule) {
      const tasks = generateAnnualTasksForForm(matchingRule, reportingYear);
      allTasks = allTasks.concat(tasks);
    }
  }

  // Сортируем задачи по дате дедлайна
  allTasks.sort((a, b) => a.due_date.localeCompare(b.due_date));
  return allTasks;
}
