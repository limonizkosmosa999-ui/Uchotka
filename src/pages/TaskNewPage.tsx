import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  CheckSquare,
  ArrowLeft,
  Hourglass,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { getCompanies, createCompanyTasks, getAllUsers } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';
import { ClientType, Company, TaskRecurrence, UserProfile } from '../types';
import { COMMON_DOC_TYPES } from '../lib/mockData';
import { useAuth } from '../context/AuthContext';

interface DocEntry {
  id: string;
  docType: string;
  dueDate: string;
  isWaitingMode: boolean;
  waitUntil: string;
  notes: string;
  showSuggestions: boolean;
}

const makeDueDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const newEntry = (dueDate?: string): DocEntry => ({
  id: Math.random().toString(36).slice(2),
  docType: '',
  dueDate: dueDate || makeDueDate(),
  isWaitingMode: false,
  waitUntil: '',
  notes: '',
  showSuggestions: false,
});

export const TaskNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const preselectedCompanyId = searchParams.get('company_id') || '';
  const preselectedDueDate = searchParams.get('due_date') || '';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>(
    preselectedCompanyId ? [preselectedCompanyId] : []
  );
  const [executorIds, setExecutorIds] = useState<string[]>(user?.role === 'accountant' ? [user.id] : []);
  const [controllerIds, setControllerIds] = useState<string[]>([]);
  const [recurrence, setRecurrence] = useState<TaskRecurrence | ''>('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterTaxType, setFilterTaxType] = useState('');
  const [filterCurator, setFilterCurator] = useState('');
  const [filterClientType, setFilterClientType] = useState<ClientType | ''>('');
  const [docs, setDocs] = useState<DocEntry[]>([newEntry(preselectedDueDate || undefined)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role === 'manager';

  useEffect(() => {
    const ownerId = isManager ? undefined : user?.id;
    getCompanies(ownerId).then((comps) => {
      setCompanies(comps);
      setSelectedCompanyIds((selected) => {
        const validSelected = selected.filter((id) => comps.some((company) => company.id === id));
        return validSelected.length ? validSelected : comps.slice(0, 1).map((company) => company.id);
      });
    });
    getAllUsers().then((allUsers) => {
      setUsers(allUsers);
      if (user?.role === 'accountant') {
        setExecutorIds([user.id]);
      }
    }).catch((err) => setError(err.message || 'Не удалось загрузить сотрудников'));
  }, [user, isManager]);

  const filteredCompanies = companies.filter((company) =>
    (!filterDistrict || company.tax_office_district === filterDistrict)
    && (!filterTaxType || company.tax_type_id === filterTaxType)
    && (!filterCurator || company.curator_id === filterCurator)
    && (!filterClientType || company.client_type === filterClientType)
  );

  const toggleId = (ids: string[], id: string, setter: (next: string[]) => void) => {
    setter(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  };

  const toggleFilteredCompanies = () => {
    const filteredIds = filteredCompanies.map((company) => company.id);
    const allSelected = filteredIds.every((id) => selectedCompanyIds.includes(id));
    setSelectedCompanyIds(allSelected
      ? selectedCompanyIds.filter((id) => !filteredIds.includes(id))
      : [...new Set([...selectedCompanyIds, ...filteredIds])]);
  };

  const updateDoc = (id: string, patch: Partial<DocEntry>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const addDoc = () => {
    setDocs((prev) => [
      ...prev,
      newEntry(prev[prev.length - 1]?.dueDate || undefined),
    ]);
  };

  const removeDoc = (id: string) => {
    if (docs.length === 1) return;
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCompanyIds.length) {
      setError('Выберите хотя бы одну компанию');
      return;
    }
    if (!executorIds.length) {
      setError('Выберите хотя бы одного исполнителя');
      return;
    }

    for (const doc of docs) {
      if (!doc.docType.trim()) {
        setError('Заполните тип документа во всех строках');
        return;
      }
      if (!doc.dueDate) {
        setError('Укажите срок сдачи во всех строках');
        return;
      }
      if (doc.isWaitingMode && !doc.waitUntil) {
        setError('Укажите дату ожидания ответа или отключите режим ожидания');
        return;
      }
    }

    setLoading(true);
    try {
      for (const doc of docs) {
        await createCompanyTasks({
          companyIds: selectedCompanyIds,
          task: {
            company_id: selectedCompanyIds[0],
            doc_type: doc.docType.trim(),
            due_date: doc.dueDate,
            status: doc.isWaitingMode ? 'waiting' : 'in_progress',
            wait_until: doc.isWaitingMode ? doc.waitUntil : null,
            notes: doc.notes.trim() || null,
            recurrence_rule: recurrence || null,
          },
          executorIds,
          controllerIds,
        });
      }
      navigate(`/dashboard${selectedCompanyIds.length === 1 ? `?company=${selectedCompanyIds[0]}` : ''}`);
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании задач');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#8C8577] hover:text-[#2B2A25] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="bg-white border border-[#D4C9B0] rounded-2xl p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-7 pb-5 border-b border-[#EAE3D6]">
          <div className="w-12 h-12 rounded-xl bg-[#E7F3EB] text-[#4A8C68] flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1E1D19]">
              Новые задачи по документам
            </h1>
            <p className="text-sm text-[#6B6558]">
              Добавьте один или несколько отчётов/документов за раз
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[#FCE6E3] border border-[#DD6B60]/30 text-sm text-[#C0392B] flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company selectors and grouping filters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-[#1E1D19]">
                Компания / Клиент *
              </label>
              <Link to="/companies/new" className="text-sm text-[#4A8C68] hover:underline font-medium">
                + Создать
              </Link>
            </div>
            {companies.length === 0 ? (
              <div className="p-4 bg-[#FAF8F4] border border-[#D4C9B0] rounded-xl text-sm text-[#6B6558]">
                Нет компаний.{' '}
                <Link to="/companies/new" className="text-[#4A8C68] underline">Создать компанию</Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select value={filterDistrict} onChange={(e) => setFilterDistrict(e.target.value)} className="px-2 py-2 text-xs border border-[#D4C9B0] rounded-lg">
                    <option value="">Все районы</option>
                    {[...new Set(companies.map((company) => company.tax_office_district).filter(Boolean))].map((district) => <option key={district} value={district!}>{district}</option>)}
                  </select>
                  <select value={filterTaxType} onChange={(e) => setFilterTaxType(e.target.value)} className="px-2 py-2 text-xs border border-[#D4C9B0] rounded-lg">
                    <option value="">Все режимы</option>
                    {[...new Map(companies.filter((company) => company.tax_type).map((company) => [company.tax_type_id, company.tax_type!])).values()].map((tax) => <option key={tax.id} value={tax.id}>{tax.name}</option>)}
                  </select>
                  <select value={filterCurator} onChange={(e) => setFilterCurator(e.target.value)} className="px-2 py-2 text-xs border border-[#D4C9B0] rounded-lg">
                    <option value="">Все кураторы</option>
                    {users.filter((candidate) => candidate.role === 'accountant').map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.full_name}</option>)}
                  </select>
                  <select value={filterClientType} onChange={(e) => setFilterClientType(e.target.value as ClientType | '')} className="px-2 py-2 text-xs border border-[#D4C9B0] rounded-lg">
                    <option value="">Все формы</option>
                    {(['ИП', 'ОсОО', 'ОО', 'ОФ'] as ClientType[]).map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B6558]">Выбрано компаний: {selectedCompanyIds.length}</span>
                  <button type="button" onClick={toggleFilteredCompanies} className="font-semibold text-[#4A8C68] hover:underline">
                    {filteredCompanies.length > 0 && filteredCompanies.every((company) => selectedCompanyIds.includes(company.id))
                      ? 'Снять выбор'
                      : 'Выбрать все подходящие'}
                  </button>
                </div>
                <div className="max-h-52 overflow-auto rounded-xl border border-[#D4C9B0] divide-y divide-[#EAE3D6]">
                  {filteredCompanies.map((company) => (
                    <label key={company.id} className="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer hover:bg-[#FAF8F4]">
                      <input
                        type="checkbox"
                        checked={selectedCompanyIds.includes(company.id)}
                        onChange={() => toggleId(selectedCompanyIds, company.id, setSelectedCompanyIds)}
                      />
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{company.name}</span>
                        <span className="text-xs text-[#8C8577]">{company.client_type} · ИНН {company.inn}</span>
                      </span>
                    </label>
                  ))}
                  {filteredCompanies.length === 0 && <p className="p-3 text-xs text-[#8C8577]">Нет компаний по выбранным фильтрам.</p>}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset className="border border-[#D4C9B0] rounded-xl p-3">
              <legend className="px-1 text-sm font-bold text-[#1E1D19]">Исполнители *</legend>
              <div className="max-h-36 overflow-auto space-y-2">
                {users.filter((candidate) => candidate.role === 'accountant').map((candidate) => (
                  <label key={candidate.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={executorIds.includes(candidate.id)} onChange={() => toggleId(executorIds, candidate.id, setExecutorIds)} />
                    {candidate.full_name}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="border border-[#D4C9B0] rounded-xl p-3">
              <legend className="px-1 text-sm font-bold text-[#1E1D19]">Контролирующие</legend>
              <div className="max-h-36 overflow-auto space-y-2">
                {users.map((candidate) => (
                  <label key={candidate.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={controllerIds.includes(candidate.id)} onChange={() => toggleId(controllerIds, candidate.id, setControllerIds)} />
                    {candidate.full_name}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1E1D19] mb-2">Повтор задачи</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as TaskRecurrence | '')} className="w-full px-4 py-3 text-sm border border-[#D4C9B0] rounded-xl bg-white">
              <option value="">Без повтора</option>
              <option value="monthly">Каждый месяц</option>
              <option value="quarterly">Каждый квартал</option>
              <option value="yearly">Каждый год</option>
            </select>
            {recurrence && (
              <p className="mt-1 text-xs text-[#8C8577]">
                {isSupabaseConfigured
                  ? 'Следующие задачи будут автоматически создаваться по расписанию.'
                  : 'Автоматическое создание по расписанию работает после подключения Supabase и применения миграции повторяющихся задач.'}
              </p>
            )}
          </div>

          {/* Tax Templates Preset Applicator (Item 3 from prompt) */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#EAE3D6] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#2B2A25] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#5FA07A]" />
                <span>Заполнить по шаблону режима налогообложения КР</span>
              </span>
              <Link
                to="/tax-calendar?tab=generator"
                className="text-[11px] text-[#5FA07A] font-semibold hover:underline"
              >
                Генератор на год →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDocs([
                    { id: '1', docType: `FORM STI-091 (Единый налог) — I квартал ${year}`, dueDate: `${year}-04-20`, isWaitingMode: false, waitUntil: '', notes: 'Квартальный отчет', showSuggestions: false },
                    { id: '2', docType: `FORM STI-091 (Единый налог) — II квартал ${year}`, dueDate: `${year}-07-20`, isWaitingMode: false, waitUntil: '', notes: 'Квартальный отчет', showSuggestions: false },
                    { id: '3', docType: `FORM STI-091 (Единый налог) — III квартал ${year}`, dueDate: `${year}-10-20`, isWaitingMode: false, waitUntil: '', notes: 'Квартальный отчет', showSuggestions: false },
                    { id: '4', docType: `FORM STI-091 (Единый налог) — IV квартал ${year}`, dueDate: `${year + 1}-01-20`, isWaitingMode: false, waitUntil: '', notes: 'Квартальный отчет', showSuggestions: false },
                    { id: '5', docType: `FORM STI-102 (ЕНД ИП) — годовая за ${year} год`, dueDate: `${year + 1}-05-01`, isWaitingMode: false, waitUntil: '', notes: 'Годовая Единая налоговая декларация ИП до 1 мая', showSuggestions: false },
                  ]);
                }}
                className="p-2.5 rounded-lg border border-[#EAE3D6] bg-white hover:bg-[#E7F3EB] text-left text-xs transition"
              >
                <span className="font-semibold text-[#2B2A25] block">ИП на едином налоге</span>
                <span className="text-[10px] text-[#8C8577]">4 квартала STI-091 + годовая STI-102 (5 задач)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDocs([
                    { id: '1', docType: `FORM STI-062 (НДС 12%) — ежемесячный`, dueDate: `${year}-11-25`, isWaitingMode: false, waitUntil: '', notes: 'Срок до 25 числа следующего месяца', showSuggestions: false },
                    { id: '2', docType: `FORM STI-161 (Зарплатные налоги и ГСС) — ежемесячный`, dueDate: `${year}-11-20`, isWaitingMode: false, waitUntil: '', notes: 'Срок до 20 числа следующего месяца', showSuggestions: false },
                    { id: '3', docType: `FORM STI-129 (Налог с продаж) — ежемесячный`, dueDate: `${year}-11-20`, isWaitingMode: false, waitUntil: '', notes: 'Срок до 20 числа следующего месяца', showSuggestions: false },
                    { id: '4', docType: `FORM STI-107 (Аванс по налогу на прибыль) — квартальный`, dueDate: `${year}-10-20`, isWaitingMode: false, waitUntil: '', notes: 'Квартальный авансовый расчет', showSuggestions: false },
                    { id: '5', docType: `FORM STI-101 (ЕНД юрлица) — годовая за ${year} год`, dueDate: `${year + 1}-04-01`, isWaitingMode: false, waitUntil: '', notes: 'Годовая декларация организации до 1 апреля', showSuggestions: false },
                  ]);
                }}
                className="p-2.5 rounded-lg border border-[#EAE3D6] bg-white hover:bg-[#E7F3EB] text-left text-xs transition"
              >
                <span className="font-semibold text-[#2B2A25] block">ОсОО на общем режиме (с НДС)</span>
                <span className="text-[10px] text-[#8C8577]">НДС 25-го, подоходный, продажи, авансы и ЕНД</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDocs([
                    { id: '1', docType: `Налоговый патент КР — продление на месяц`, dueDate: `${year}-11-01`, isWaitingMode: false, waitUntil: '', notes: 'Уплата до 1 числа месяца', showSuggestions: false },
                    { id: '2', docType: `Страховой полис Соцфонда ГСС — продление`, dueDate: `${year}-11-01`, isWaitingMode: false, waitUntil: '', notes: 'Оплата полиса Соцфонда', showSuggestions: false },
                    { id: '3', docType: `FORM STI-102 (ЕНД ИП) — годовая за ${year} год`, dueDate: `${year + 1}-05-01`, isWaitingMode: false, waitUntil: '', notes: 'Годовая ЕНД ИП до 1 мая', showSuggestions: false },
                  ]);
                }}
                className="p-2.5 rounded-lg border border-[#EAE3D6] bg-white hover:bg-[#E7F3EB] text-left text-xs transition"
              >
                <span className="font-semibold text-[#2B2A25] block">ИП на патенте</span>
                <span className="text-[10px] text-[#8C8577]">Патент + Полис Соцфонда + Годовая ЕНД</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const year = new Date().getFullYear();
                  setDocs([
                    { id: '1', docType: `FORM STI-123 (Косвенные налоги ЕАЭС)`, dueDate: `${year}-11-20`, isWaitingMode: false, waitUntil: '', notes: 'Импорт из государств ЕАЭС до 20 числа', showSuggestions: false },
                    { id: '2', docType: `FORM STI-062 (НДС)`, dueDate: `${year}-11-25`, isWaitingMode: false, waitUntil: '', notes: 'Зачетный НДС до 25 числа', showSuggestions: false },
                  ]);
                }}
                className="p-2.5 rounded-lg border border-[#EAE3D6] bg-white hover:bg-[#E7F3EB] text-left text-xs transition"
              >
                <span className="font-semibold text-[#2B2A25] block">ВЭД / Импорт ЕАЭС</span>
                <span className="text-[10px] text-[#8C8577]">Косвенные налоги STI-123 + НДС STI-062</span>
              </button>
            </div>
          </div>

          {/* Documents List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[#1E1D19]">
                Документы / Отчёты *
              </label>
              <span className="text-xs text-[#8C8577] bg-[#FAF8F4] px-2.5 py-1 rounded-lg border border-[#EAE3D6]">
                {docs.length} {docs.length === 1 ? 'документ' : docs.length < 5 ? 'документа' : 'документов'}
              </span>
            </div>

            {docs.map((doc, idx) => (
              <div
                key={doc.id}
                className="border border-[#D4C9B0] rounded-xl p-4 bg-[#FDFCFA] space-y-3 relative"
              >
                {/* Document index label + remove */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#8C8577] uppercase tracking-wider">
                    Документ #{idx + 1}
                  </span>
                  {docs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDoc(doc.id)}
                      className="p-1 rounded-lg text-[#DD6B60] hover:bg-[#FCE6E3] transition"
                      title="Удалить этот документ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Doc type input */}
                <div>
                  <input
                    type="text"
                    required
                    value={doc.docType}
                    onChange={(e) => updateDoc(doc.id, { docType: e.target.value, showSuggestions: true })}
                    onBlur={() => setTimeout(() => updateDoc(doc.id, { showSuggestions: false }), 200)}
                    onFocus={() => updateDoc(doc.id, { showSuggestions: true })}
                    placeholder="Тип документа: Декларация по НДС (STI-062)..."
                    className="w-full px-4 py-3 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-white text-[#1E1D19]"
                  />

                  {/* Suggestions */}
                  {doc.showSuggestions && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COMMON_DOC_TYPES.filter(
                        (t) => t.toLowerCase().includes(doc.docType.toLowerCase()) || !doc.docType
                      ).slice(0, 6).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onMouseDown={() => updateDoc(doc.id, { docType: type, showSuggestions: false })}
                          className="px-2.5 py-1 rounded-lg text-xs bg-white border border-[#D4C9B0] text-[#6B6558] hover:border-[#4A8C68] hover:text-[#4A8C68] transition"
                        >
                          {type.split('(')[0].trim()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Due Date + Waiting mode row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#6B6558] mb-1">
                      Срок сдачи (due_date) *
                    </label>
                    <input
                      type="date"
                      required
                      value={doc.dueDate}
                      onChange={(e) => updateDoc(doc.id, { dueDate: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-white text-[#1E1D19]"
                    />
                  </div>

                  {/* Toggle waiting mode */}
                  <div className="flex items-end">
                    <label className="w-full p-3 rounded-xl border border-[#D4C9B0] cursor-pointer hover:bg-[#E7F3EB]/30 transition flex items-center justify-between gap-3 select-none">
                      <div className="flex items-center gap-2">
                        <Hourglass className="w-4 h-4 text-[#4A8C68]" />
                        <span className="text-sm text-[#1E1D19]">Режим ожидания</span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={doc.isWaitingMode}
                          onChange={(e) => updateDoc(doc.id, { isWaitingMode: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-[#D4C9B0] peer-checked:bg-[#4A8C68] rounded-full transition" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition peer-checked:translate-x-5" />
                      </div>
                    </label>
                  </div>
                </div>

                {/* Wait until date — shown when waiting mode is on */}
                {doc.isWaitingMode && (
                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-[#6B6558] mb-1">
                      Ожидать ответа до (wait_until) *
                    </label>
                    <input
                      type="date"
                      required={doc.isWaitingMode}
                      value={doc.waitUntil}
                      onChange={(e) => updateDoc(doc.id, { waitUntil: e.target.value })}
                      className="w-full px-3 py-2.5 text-sm border border-[#4A8C68]/40 rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-[#E7F3EB]/20 text-[#1E1D19]"
                    />
                  </div>
                )}

                {/* Notes */}
                <div>
                  <textarea
                    rows={2}
                    value={doc.notes}
                    onChange={(e) => updateDoc(doc.id, { notes: e.target.value })}
                    placeholder="Примечания: особенности, номер входящего документа, запросы к клиенту..."
                    className="w-full px-3 py-2.5 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] bg-white text-[#1E1D19] placeholder-[#A89F92]"
                  />
                </div>
              </div>
            ))}

            {/* Add Document Button */}
            <button
              type="button"
              onClick={addDoc}
              className="w-full py-3.5 rounded-xl border-2 border-dashed border-[#4A8C68]/40 text-sm font-semibold text-[#4A8C68] hover:border-[#4A8C68] hover:bg-[#E7F3EB]/30 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              <span>+ Добавить ещё один документ</span>
            </button>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-[#EAE3D6] flex items-center justify-end gap-3">
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-[#8C8577] hover:bg-[#FAF8F4] transition"
            >
              Отмена
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#4A8C68] text-white text-sm font-bold hover:bg-[#3D7557] transition disabled:opacity-50"
            >
              {loading
                ? 'Создание...'
                : docs.length === 1
                ? 'Создать задачу'
                : `Создать ${docs.length} задачи`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
