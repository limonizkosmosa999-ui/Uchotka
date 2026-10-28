import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Sparkles,
  BookOpen,
  Search,
  Check,
  Building,
  Calendar,
  AlertCircle,
  FileText,
  Clock,
  ArrowRight,
  Filter,
  CheckCircle2,
  ChevronDown,
  Layers,
  HelpCircle,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCompanies, createCompanyTasks, getAllUsers } from '../lib/api';
import { Company, UserProfile } from '../types';
import {
  KYRGYZ_TAX_RULES,
  KYRGYZ_TAX_TEMPLATES,
  generateAnnualTasksFromTemplate,
  generateAnnualTasksForForm,
  GeneratedTaskPreview
} from '../lib/kyrgyzTaxCalendar';
import { logActivity } from '../lib/activityLog';

export const TaxCalendarPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab: 'generator' | 'monthly' | 'directory'
  const initialTab = (searchParams.get('tab') as any) || 'generator';
  const [activeTab, setActiveTab] = useState<'generator' | 'monthly' | 'directory'>(initialTab);

  const preselectedCompanyId = searchParams.get('company_id') || '';

  // Data states
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(preselectedCompanyId);

  // Generator states
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    KYRGYZ_TAX_TEMPLATES[0].id
  );
  const [reportingYear, setReportingYear] = useState<number>(new Date().getFullYear());
  const [includeEmployees, setIncludeEmployees] = useState(false);
  const [includeVat, setIncludeVat] = useState(false);
  const [includeImportEaes, setIncludeImportEaes] = useState(false);
  const [previewTasks, setPreviewTasks] = useState<GeneratedTaskPreview[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState<{ count: number; companyName: string } | null>(null);

  // Directory filter states
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryCategory, setDirectoryCategory] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1-12

  const isManager = user?.role === 'manager';

  useEffect(() => {
    const ownerId = isManager ? undefined : user?.id;
    getCompanies(ownerId).then((comps) => {
      setCompanies(comps);
      if (!selectedCompanyId && comps.length > 0) {
        setSelectedCompanyId(comps[0].id);
      }
    });
    getAllUsers().then(setUsers);
  }, [user, isManager]);

  // Sync selected company regime preset if present
  useEffect(() => {
    if (selectedCompanyId) {
      const comp = companies.find((c) => c.id === selectedCompanyId);
      if (comp) {
        // Auto-detect template based on company client_type and tax_type
        if (comp.client_type === 'ИП' && comp.tax_type_id === 'tax-3') {
          setSelectedTemplateId('ip_patent');
        } else if (comp.client_type === 'ИП') {
          setSelectedTemplateId('ip_single_tax_small');
        } else if (comp.tax_type_id === 'tax-2') {
          setSelectedTemplateId('osoo_general_vat');
        } else {
          setSelectedTemplateId('osoo_single_tax');
        }
      }
    }
  }, [selectedCompanyId, companies]);

  // Recalculate preview tasks when template, year, or options change
  useEffect(() => {
    const template = KYRGYZ_TAX_TEMPLATES.find((t) => t.id === selectedTemplateId);
    if (!template) return;

    let tasks = generateAnnualTasksFromTemplate(template, reportingYear);

    // Добавляем сотрудников (STI-161) если включено и в шаблоне ещё нет
    if (includeEmployees && !template.form_codes.includes('FORM STI-161')) {
      const sti161Rule = KYRGYZ_TAX_RULES.find((r) => r.id === 'sti-161');
      if (sti161Rule) {
        const empTasks = generateAnnualTasksForForm(sti161Rule, reportingYear);
        tasks = [...tasks, ...empTasks];
      }
    }

    // Добавляем НДС (STI-062) если включено и нет в шаблоне
    if (includeVat && !template.form_codes.includes('FORM STI-062')) {
      const vatRule = KYRGYZ_TAX_RULES.find((r) => r.id === 'sti-062');
      if (vatRule) {
        const vatTasks = generateAnnualTasksForForm(vatRule, reportingYear);
        tasks = [...tasks, ...vatTasks];
      }
    }

    // Добавляем импорт ЕАЭС (STI-123)
    if (includeImportEaes && !template.form_codes.includes('FORM STI-123')) {
      const eaesRule = KYRGYZ_TAX_RULES.find((r) => r.id === 'sti-123');
      if (eaesRule) {
        const eaesTasks = generateAnnualTasksForForm(eaesRule, reportingYear);
        tasks = [...tasks, ...eaesTasks];
      }
    }

    // Сортировка по дедлайну
    tasks.sort((a, b) => a.due_date.localeCompare(b.due_date));
    setPreviewTasks(tasks);
  }, [selectedTemplateId, reportingYear, includeEmployees, includeVat, includeImportEaes]);

  const handleTabChange = (tab: 'generator' | 'monthly' | 'directory') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const toggleTaskSelection = (taskId: string) => {
    setPreviewTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, is_selected: !t.is_selected } : t))
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setPreviewTasks((prev) => prev.map((t) => ({ ...t, is_selected: select })));
  };

  const handleGenerateTasks = async () => {
    if (!selectedCompanyId) {
      alert('Пожалуйста, выберите компанию для генерации задач');
      return;
    }

    const selectedTasks = previewTasks.filter((t) => t.is_selected);
    if (selectedTasks.length === 0) {
      alert('Выберите хотя бы одну задачу для добавления');
      return;
    }

    const targetCompany = companies.find((c) => c.id === selectedCompanyId);
    if (!targetCompany) return;

    setGenerating(true);
    try {
      const defaultAccountant =
        targetCompany.curator_id ||
        users.find((u) => u.role === 'accountant')?.id ||
        user?.id ||
        '';

      // Создаем каждую задачу
      for (const t of selectedTasks) {
        await createCompanyTasks({
          companyIds: [selectedCompanyId],
          task: {
            company_id: selectedCompanyId,
            doc_type: t.doc_type,
            due_date: t.due_date,
            status: 'in_progress',
            notes: `${t.period_label}. ${t.notes}`,
          },
          executorIds: defaultAccountant ? [defaultAccountant] : [],
          controllerIds: isManager && user ? [user.id] : [],
        });
      }

      await logActivity({
        userId: user?.id || 'system',
        userName: user?.full_name || 'Бухгалтер',
        actionType: 'generate_year_calendar',
        description: `Сгенерировано ${selectedTasks.length} задач на ${reportingYear} год для компании "${targetCompany.name}" по режиму "${selectedTemplate?.name}"`,
        companyId: targetCompany.id,
        companyName: targetCompany.name,
        meta: { year: reportingYear, count: selectedTasks.length },
      });

      setGenerationSuccess({
        count: selectedTasks.length,
        companyName: targetCompany.name,
      });
    } catch (err: any) {
      console.error('Failed to generate annual tasks:', err);
      alert(err.message || 'Ошибка генерации задач');
    } finally {
      setGenerating(false);
    }
  };

  const selectedTemplate = KYRGYZ_TAX_TEMPLATES.find((t) => t.id === selectedTemplateId);
  const selectedCount = previewTasks.filter((t) => t.is_selected).length;

  // Directory filter
  const filteredRules = KYRGYZ_TAX_RULES.filter((rule) => {
    if (directoryCategory !== 'all' && rule.category !== directoryCategory) return false;
    if (directorySearch.trim()) {
      const q = directorySearch.toLowerCase();
      const matchCode = rule.form_code.toLowerCase().includes(q);
      const matchTax = rule.tax_code.toLowerCase().includes(q);
      const matchName = rule.name.toLowerCase().includes(q);
      const matchRef = (rule.legal_reference || '').toLowerCase().includes(q);
      if (!matchCode && !matchTax && !matchName && !matchRef) return false;
    }
    return true;
  });

  // Monthly deadlines filter (20-е / 25-е / 1-е число)
  const monthNamesRu = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#5FA07A] text-[11px] font-bold">
              Кыргызстан • НК КР
            </span>
            <span className="text-xs text-[#8C8577]">28+ официальных форм ГНС</span>
          </div>
          <h1 className="text-2xl font-bold text-[#2B2A25] tracking-tight">
            Налоговый календарь Кыргызстана
          </h1>
          <p className="text-xs text-[#8C8577] mt-1 max-w-2xl">
            Автоматическое формирование задач по срокам сдачи отчётности ГНС на год вперёд с учётом режима налогообложения, формы собственности и штата.
          </p>
        </div>

        {/* Tab navigation pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#EAE3D6]/40 border border-[#EAE3D6] self-start lg:self-auto">
          <button
            type="button"
            onClick={() => handleTabChange('generator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'generator'
                ? 'bg-white text-[#5FA07A] shadow-sm'
                : 'text-[#8C8577] hover:text-[#2B2A25]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Генератор задач на год</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('monthly')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'monthly'
                ? 'bg-white text-[#5FA07A] shadow-sm'
                : 'text-[#8C8577] hover:text-[#2B2A25]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Сроки по месяцам</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('directory')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'directory'
                ? 'bg-white text-[#5FA07A] shadow-sm'
                : 'text-[#8C8577] hover:text-[#2B2A25]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>База форм ГНС</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: АВТОГЕНЕРАТОР ЗАДАЧ НА ГОД ВПЕРЁД */}
      {/* ========================================================================= */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          {/* Success banner */}
          {generationSuccess && (
            <div className="p-4 rounded-xl bg-[#E7F3EB] border border-[#5FA07A]/30 flex items-start justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-[#5FA07A] flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-[#2B2A25]">
                    Успешно сформировано {generationSuccess.count} задач!
                  </h4>
                  <p className="text-[11px] text-[#5FA07A] mt-0.5">
                    Задачи на {reportingYear} год добавлены в план для компании «{generationSuccess.companyName}». Они уже отображаются на рабочем столе и в календаре.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/companies/${selectedCompanyId}`}
                  className="px-3 py-1.5 rounded-lg bg-white border border-[#5FA07A]/40 text-xs font-semibold text-[#5FA07A] hover:bg-[#FAF8F5]"
                >
                  Карточка компании
                </Link>
                <Link
                  to="/dashboard"
                  className="px-3 py-1.5 rounded-lg bg-[#5FA07A] text-white text-xs font-semibold hover:bg-[#528E6B]"
                >
                  К задачам
                </Link>
              </div>
            </div>
          )}

          {/* Configuration Card */}
          <div className="bg-white border border-[#EAE3D6] rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-[#2B2A25] mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#5FA07A]" />
              <span>Параметры генерации календаря</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {/* Company Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-[#8C8577] mb-1.5">
                  1. Выберите компанию
                </label>
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] bg-white focus:outline-none focus:border-[#5FA07A]"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.client_type}, ИНН: {c.inn})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preset Template Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-[#8C8577] mb-1.5">
                  2. Режим налогообложения / Шаблон
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] bg-white focus:outline-none focus:border-[#5FA07A]"
                >
                  {KYRGYZ_TAX_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Year */}
              <div>
                <label className="block text-[11px] font-semibold text-[#8C8577] mb-1.5">
                  3. Отчётный год
                </label>
                <div className="flex items-center gap-2">
                  {[2026, 2027].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setReportingYear(yr)}
                      className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition ${
                        reportingYear === yr
                          ? 'border-[#5FA07A] bg-[#E7F3EB] text-[#5FA07A]'
                          : 'border-[#EAE3D6] bg-white text-[#8C8577] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      {yr} год
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Template description badge */}
            {selectedTemplate && (
              <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE3D6] mb-5 text-xs">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-full bg-[#E7F3EB] text-[#5FA07A] font-bold text-[10px]">
                    {selectedTemplate.badge}
                  </span>
                  <span className="font-semibold text-[#2B2A25]">{selectedTemplate.name}</span>
                </div>
                <p className="text-[11px] text-[#8C8577] leading-relaxed">
                  {selectedTemplate.description}
                </p>
                <div className="mt-2 text-[10px] text-[#5FA07A] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>Включает формы: {selectedTemplate.form_codes.join(', ')}</span>
                </div>
              </div>
            )}

            {/* Optional additions */}
            <div className="pt-4 border-t border-[#EAE3D6]">
              <span className="text-[11px] font-semibold text-[#8C8577] block mb-2">
                Дополнительные обязательства компании:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#EAE3D6] bg-white hover:bg-[#FAF8F5] cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={includeEmployees}
                    onChange={(e) => setIncludeEmployees(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5FA07A] focus:ring-[#5FA07A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#2B2A25] block">
                      Сотрудники в штате
                    </span>
                    <span className="text-[10px] text-[#8C8577]">
                      +12 задач STI-161 (зарплата, ГСС)
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#EAE3D6] bg-white hover:bg-[#FAF8F5] cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={includeVat}
                    onChange={(e) => setIncludeVat(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5FA07A] focus:ring-[#5FA07A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#2B2A25] block">
                      Плательщик НДС
                    </span>
                    <span className="text-[10px] text-[#8C8577]">
                      +12 задач STI-062 (до 25-го числа)
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-[#EAE3D6] bg-white hover:bg-[#FAF8F5] cursor-pointer transition">
                  <input
                    type="checkbox"
                    checked={includeImportEaes}
                    onChange={(e) => setIncludeImportEaes(e.target.checked)}
                    className="w-4 h-4 rounded text-[#5FA07A] focus:ring-[#5FA07A]"
                  />
                  <div>
                    <span className="text-xs font-semibold text-[#2B2A25] block">
                      Импорт из ЕАЭС (ВЭД)
                    </span>
                    <span className="text-[10px] text-[#8C8577]">
                      +12 задач STI-123 (косвенные налоги)
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Generated Schedule Preview Table */}
          <div className="bg-white border border-[#EAE3D6] rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 sm:p-6 border-b border-[#EAE3D6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#FAF8F5]">
              <div>
                <h3 className="text-sm font-bold text-[#2B2A25]">
                  Предпросмотр графика задач на год ({previewTasks.length} дедлайнов)
                </h3>
                <p className="text-[11px] text-[#8C8577]">
                  Выбрано к созданию: <strong className="text-[#5FA07A]">{selectedCount}</strong> из {previewTasks.length} задач
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleSelectAll(selectedCount !== previewTasks.length)}
                  className="px-3 py-1.5 rounded-lg border border-[#EAE3D6] bg-white text-xs font-medium text-[#2B2A25] hover:bg-[#FAF8F5] transition"
                >
                  {selectedCount === previewTasks.length ? 'Снять выделение' : 'Выбрать все'}
                </button>

                <button
                  type="button"
                  onClick={handleGenerateTasks}
                  disabled={generating || selectedCount === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#5FA07A] hover:bg-[#528E6B] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {generating ? 'Создание задач...' : `Создать ${selectedCount} задач в план`}
                  </span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#EAE3D6] max-h-[600px] overflow-y-auto">
              {previewTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTaskSelection(t.id)}
                  className={`p-3.5 sm:px-6 flex items-center justify-between gap-3 text-xs transition cursor-pointer ${
                    t.is_selected ? 'bg-white hover:bg-[#FAF8F5]' : 'bg-[#FAF8F5]/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={t.is_selected}
                      onChange={() => toggleTaskSelection(t.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded text-[#5FA07A] focus:ring-[#5FA07A]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2B2A25]">{t.doc_type}</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#FAF8F5] border border-[#EAE3D6] text-[10px] text-[#8C8577]">
                          {t.period_label}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8C8577] mt-0.5">{t.notes}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-[#8C8577] block">Дедлайн сдачи:</span>
                      <span className="font-bold text-[#2B2A25] font-mono">
                        {t.due_date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: СРОКИ СДАЧИ ПО МЕСЯЦАМ */}
      {/* ========================================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Month selector buttons */}
          <div className="bg-white border border-[#EAE3D6] rounded-2xl p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-[#8C8577] block mb-2">
              Выберите отчётный месяц:
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
              {monthNamesRu.map((mName, idx) => {
                const monthNum = idx + 1;
                const isCurrent = selectedMonth === monthNum;
                return (
                  <button
                    key={monthNum}
                    type="button"
                    onClick={() => setSelectedMonth(monthNum)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold transition ${
                      isCurrent
                        ? 'bg-[#5FA07A] text-white shadow-sm'
                        : 'border border-[#EAE3D6] bg-white text-[#2B2A25] hover:bg-[#FAF8F5]'
                    }`}
                  >
                    {mName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Month Deadlines Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 20-е число */}
            <div className="bg-white border border-[#EAE3D6] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#EAE3D6] mb-3">
                <span className="w-8 h-8 rounded-xl bg-[#FCE6E3] text-[#DD6B60] font-bold text-sm flex items-center justify-center">
                  20
                </span>
                <div>
                  <h4 className="text-xs font-bold text-[#2B2A25]">
                    Основной дедлайн месяца
                  </h4>
                  <p className="text-[10px] text-[#8C8577]">До 20-го числа включительно</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-161</span>
                  <span className="text-[11px] text-[#8C8577]">
                    Подоходный налог и Соцфонд (работодатели)
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-129</span>
                  <span className="text-[11px] text-[#8C8577]">
                    Налог с продаж (организации и ИП)
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-123</span>
                  <span className="text-[11px] text-[#8C8577]">
                    Косвенные налоги при импорте из ЕАЭС
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-070</span>
                  <span className="text-[11px] text-[#8C8577]">Акцизный налог</span>
                </li>
                {[1, 4, 7, 10].includes(selectedMonth) && (
                  <li className="p-2 rounded-lg bg-[#FBEBD9] border border-[#DB8A3C]/30">
                    <span className="font-semibold text-[#DB8A3C] block">
                      FORM STI-091 (Квартал)
                    </span>
                    <span className="text-[11px] text-[#2B2A25]">
                      Единый налог субъектов малого бизнеса
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* 25-е число */}
            <div className="bg-white border border-[#EAE3D6] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#EAE3D6] mb-3">
                <span className="w-8 h-8 rounded-xl bg-[#E7F3EB] text-[#5FA07A] font-bold text-sm flex items-center justify-center">
                  25
                </span>
                <div>
                  <h4 className="text-xs font-bold text-[#2B2A25]">
                    Специальный дедлайн: НДС
                  </h4>
                  <p className="text-[10px] text-[#8C8577]">До 25-го числа следующего месяца</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-062</span>
                  <span className="text-[11px] text-[#8C8577]">
                    Налог на добавленную стоимость (НДС 12%)
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-165</span>
                  <span className="text-[11px] text-[#8C8577]">
                    НДС на электронные услуги иностранных компаний
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">FORM STI-077</span>
                  <span className="text-[11px] text-[#8C8577]">
                    Земельный налог (ежемесячный платеж)
                  </span>
                </li>
              </ul>
            </div>

            {/* Годовые дедлайны (ЕНД) */}
            <div className="bg-white border border-[#EAE3D6] rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[#EAE3D6] mb-3">
                <span className="w-8 h-8 rounded-xl bg-[#FBEBD9] text-[#DB8A3C] font-bold text-sm flex items-center justify-center">
                  ЕНД
                </span>
                <div>
                  <h4 className="text-xs font-bold text-[#2B2A25]">
                    Годовые декларации (ЕНД)
                  </h4>
                  <p className="text-[10px] text-[#8C8577]">1 апреля и 1 мая</p>
                </div>
              </div>
              <ul className="space-y-2 text-xs">
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">
                    До 1 апреля: FORM STI-101
                  </span>
                  <span className="text-[11px] text-[#8C8577]">
                    ЕНД юридических лиц (ОсОО, ЗАО, ОАО)
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">
                    До 1 мая: FORM STI-102
                  </span>
                  <span className="text-[11px] text-[#8C8577]">
                    ЕНД индивидуальных предпринимателей (ИП)
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">
                    До 1 мая: FORM STI-100
                  </span>
                  <span className="text-[11px] text-[#8C8577]">
                    ЕНД граждан и физических лиц
                  </span>
                </li>
                <li className="p-2 rounded-lg bg-[#FAF8F5]">
                  <span className="font-semibold text-[#2B2A25] block">
                    До 1 апреля: FORM STI-087
                  </span>
                  <span className="text-[11px] text-[#8C8577]">
                    Информационный расчёт налога на имущество
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: СПРАВОЧНИК ФОРМ ГНС КР (28 ФОРМ) */}
      {/* ========================================================================= */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Search & Category Filter */}
          <div className="bg-white border border-[#EAE3D6] rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-96">
              <input
                type="text"
                value={directorySearch}
                onChange={(e) => setDirectorySearch(e.target.value)}
                placeholder="Поиск по коду (STI-062), названию налога или статье..."
                className="w-full pl-9 pr-3 py-2 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] focus:outline-none focus:border-[#5FA07A]"
              />
              <Search className="w-4 h-4 text-[#8C8577] absolute left-3 top-2.5" />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
              {[
                { id: 'all', label: 'Все формы' },
                { id: 'payroll', label: 'Зарплатные' },
                { id: 'vat', label: 'НДС' },
                { id: 'single_tax', label: 'Единый налог' },
                { id: 'profit', label: 'Прибыль' },
                { id: 'annual', label: 'ЕНД (Годовые)' },
                { id: 'property', label: 'Имущество' },
                { id: 'special', label: 'Спецналоги' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setDirectoryCategory(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    directoryCategory === c.id
                      ? 'bg-[#5FA07A] text-white shadow-sm'
                      : 'border border-[#EAE3D6] bg-white text-[#8C8577] hover:bg-[#FAF8F5]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rules Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="bg-white border border-[#EAE3D6] rounded-2xl p-5 shadow-sm hover:border-[#5FA07A]/50 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#E7F3EB] text-[#5FA07A] font-bold text-xs font-mono">
                      {rule.form_code}
                    </span>
                    <span className="text-[10px] text-[#8C8577] capitalize">
                      {rule.period === 'month'
                        ? 'Ежемесячно'
                        : rule.period === 'quarter'
                        ? 'Ежеквартально'
                        : rule.period === 'year'
                        ? 'Ежегодно'
                        : 'Инфо-расчёт'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#2B2A25] mb-1 leading-snug">
                    {rule.tax_code}
                  </h4>
                  <p className="text-[11px] text-[#8C8577] line-clamp-2 mb-3">
                    {rule.name}
                  </p>

                  <div className="space-y-1.5 pt-2 border-t border-[#EAE3D6] text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#5FA07A] flex-shrink-0 mt-0.5" />
                      <span className="text-[#2B2A25]">
                        <strong>Срок:</strong> {rule.deadline_rule}
                      </span>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#8C8577] flex-shrink-0 mt-0.5" />
                      <span className="text-[#8C8577]">
                        Кто сдаёт:{' '}
                        {rule.payer_types
                          .map((p) =>
                            p === 'organization'
                              ? 'Организации'
                              : p === 'individual_entrepreneur'
                              ? 'ИП'
                              : p === 'tax_agent'
                              ? 'Налоговые агенты'
                              : 'Физлица'
                          )
                          .join(', ')}
                      </span>
                    </div>

                    {rule.legal_reference && (
                      <span className="text-[10px] text-[#5FA07A] block mt-1">
                        Основание: {rule.legal_reference}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#EAE3D6] flex items-center justify-between">
                  <span className="text-[10px] text-[#8C8577]">
                    {rule.payment_deadline_rule ? `Уплата: ${rule.payment_deadline_rule}` : 'Срок уплаты совпадает'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(
                        KYRGYZ_TAX_TEMPLATES.find((t) => t.form_codes.includes(rule.form_code))?.id ||
                          'ip_single_tax_small'
                      );
                      handleTabChange('generator');
                    }}
                    className="text-[11px] text-[#5FA07A] font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>В генератор</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
