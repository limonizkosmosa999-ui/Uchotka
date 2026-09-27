import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  CheckSquare,
  ArrowLeft,
  Hourglass,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getCompanies, createTask } from '../lib/api';
import { Company } from '../types';
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
  const [companyId, setCompanyId] = useState(preselectedCompanyId);
  const [docs, setDocs] = useState<DocEntry[]>([newEntry(preselectedDueDate || undefined)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isManager = user?.role === 'manager';

  useEffect(() => {
    const ownerId = isManager ? undefined : user?.id;
    getCompanies(ownerId).then((comps) => {
      setCompanies(comps);
      if (!companyId && comps.length > 0) setCompanyId(comps[0].id);
    });
  }, [user, isManager, companyId]);

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

    if (!companyId) {
      setError('Выберите компанию');
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
        await createTask({
          company_id: companyId,
          doc_type: doc.docType.trim(),
          due_date: doc.dueDate,
          status: doc.isWaitingMode ? 'waiting' : 'in_progress',
          wait_until: doc.isWaitingMode ? doc.waitUntil : null,
          notes: doc.notes.trim() || null,
        });
      }
      navigate(`/dashboard${companyId ? `?company=${companyId}` : ''}`);
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
          {/* Company selector */}
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
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-4 py-3 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-white text-[#1E1D19]"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.client_type} (ИНН: {c.inn})
                  </option>
                ))}
              </select>
            )}
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
