import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building, Plus, Search, ChevronRight, FileSpreadsheet, Building2, CheckCircle2 } from 'lucide-react';
import { Company, Task } from '../types';

interface CompanySidebarProps {
  companies: Company[];
  tasks: Task[];
  selectedCompanyId: string | null;
  onSelectCompany: (id: string | null) => void;
  loading?: boolean;
}

export const CompanySidebar: React.FC<CompanySidebarProps> = ({
  companies,
  tasks,
  selectedCompanyId,
  onSelectCompany,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCompanies = companies.filter((c) => {
    const q = searchTerm.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(q) ||
      c.inn.includes(q) ||
      c.client_type.toLowerCase().includes(q)
    );
  });

  const getCompanyActiveTaskCount = (companyId: string) => {
    return tasks.filter(
      (t) => t.company_id === companyId && t.status !== 'done'
    ).length;
  };

  const totalActiveTasks = tasks.filter((t) => t.status !== 'done').length;

  return (
    <aside className="w-full lg:w-80 flex-shrink-0 bg-white border border-[#EAE3D6] rounded-[10px] p-4 flex flex-col h-[calc(100vh-6rem)] sticky top-20">
      {/* Header and Add Button */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-base font-semibold text-[#2B2A25]">Мои компании</h2>
          <p className="text-[11px] text-[#8C8577]">
            {companies.length} {companies.length === 1 ? 'клиент' : 'клиентов'} на обслуживании
          </p>
        </div>
        <Link
          to="/companies/new"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] text-xs font-medium text-white bg-[#5FA07A] hover:bg-[#528E6B] transition"
          title="Добавить компанию"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Клиент</span>
        </Link>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8577]" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Поиск по названию или ИНН..."
          className="w-full pl-8 pr-3 py-2 text-xs bg-[#FAF8F5] border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25] placeholder-[#8C8577]"
        />
      </div>

      {/* Company List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {/* All Companies option */}
        <button
          type="button"
          onClick={() => onSelectCompany(null)}
          className={`w-full text-left p-2.5 rounded-[8px] transition flex items-center justify-between border ${
            selectedCompanyId === null
              ? 'bg-[#E7F3EB] border-[#5FA07A]/40 text-[#2B2A25]'
              : 'bg-white border-transparent hover:bg-[#FAF8F5] text-[#2B2A25]'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-[6px] flex items-center justify-center ${
              selectedCompanyId === null ? 'bg-[#5FA07A] text-white' : 'bg-[#FAF8F5] text-[#8C8577]'
            }`}>
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-semibold block">Все компании</span>
              <span className="text-[10px] text-[#8C8577]">Сводка по всем задачам</span>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[#FAF8F5] border border-[#EAE3D6] text-[#2B2A25]">
            {totalActiveTasks}
          </span>
        </button>

        {loading ? (
          <div className="py-8 text-center text-xs text-[#8C8577]">Загрузка компаний...</div>
        ) : filteredCompanies.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8C8577]">
            {searchTerm ? 'Компании не найдены' : 'Список компаний пуст'}
          </div>
        ) : (
          filteredCompanies.map((c) => {
            const isSelected = selectedCompanyId === c.id;
            const activeCount = getCompanyActiveTaskCount(c.id);

            return (
              <div
                key={c.id}
                className={`group p-2.5 rounded-[8px] transition border cursor-pointer ${
                  isSelected
                    ? 'bg-[#E7F3EB] border-[#5FA07A]/50'
                    : 'bg-white border-[#EAE3D6] hover:border-[#C7A96E]'
                }`}
                onClick={() => onSelectCompany(c.id)}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase ${
                        c.client_type === 'ОсОО'
                          ? 'bg-[#FBEBD9] text-[#DB8A3C]'
                          : 'bg-[#F6EFDE] text-[#C7A96E]'
                      }`}>
                        {c.client_type}
                      </span>
                      <h3 className="text-xs font-semibold text-[#2B2A25] truncate">
                        {c.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-[#8C8577]">
                      <span>ИНН {c.inn}</span>
                      <span>•</span>
                      <span className="truncate">{c.tax_type?.name || 'Налог'}</span>
                    </div>
                  </div>

                  {/* Tasks count badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-[6px] ${
                        activeCount > 0
                          ? 'bg-[#FAF8F5] text-[#2B2A25] border border-[#EAE3D6]'
                          : 'text-[#8C8577] bg-transparent'
                      }`}
                    >
                      {activeCount} {activeCount === 1 ? 'зад.' : 'зад.'}
                    </span>
                    <Link
                      to={`/companies/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] text-[#5FA07A] hover:underline opacity-0 group-hover:opacity-100 transition"
                      title="Открыть карточку компании"
                    >
                      карточка →
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="pt-3 mt-2 border-t border-[#EAE3D6] flex items-center justify-between text-[11px] text-[#8C8577]">
        <span>Всего: {companies.length}</span>
        <Link
          to="/companies/new"
          className="text-[#5FA07A] hover:underline font-medium"
        >
          + Создать компанию
        </Link>
      </div>
    </aside>
  );
};
