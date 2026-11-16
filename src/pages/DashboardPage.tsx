import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Plus, 
  X,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  CheckCircle2,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCompanies, getTasks, subscribeToTasks, getAllUsers } from '../lib/api';
import { Company, Task, UserProfile } from '../types';
import { CompanySidebar } from '../components/CompanySidebar';
import { TaskCard } from '../components/TaskCard';
import { getTaskUrgency } from '../lib/dateUtils';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    searchParams.get('company') || null
  );
  const [accountantFilter, setAccountantFilter] = useState<string | null>(
    searchParams.get('accountant') || null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [taskSearch, setTaskSearch] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  const isManager = user?.role === 'manager';

  const loadData = async () => {
    try {
      setLoadError(null);
      setLoading(true);
      const ownerId = isManager ? undefined : user?.id;
      const [comps, tks, usrs] = await Promise.all([
        getCompanies(ownerId),
        getTasks({ ownerId }),
        getAllUsers(),
      ]);
      setCompanies(comps);
      setTasks(tks);
      setAllUsers(usrs);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    setSelectedCompanyId(searchParams.get('company') || null);
    setAccountantFilter(searchParams.get('accountant') || null);
  }, [searchParams]);

  useEffect(() => {
    const unsubscribe = subscribeToTasks(() => {
      const ownerId = isManager ? undefined : user?.id;
      getTasks({ ownerId }).then(setTasks);
      getCompanies(ownerId).then(setCompanies);
    });
    return () => unsubscribe();
  }, [user, isManager]);

  const handleSelectCompany = (id: string | null) => {
    setSelectedCompanyId(id);
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('company', id);
    } else {
      newParams.delete('company');
    }
    setSearchParams(newParams);
  };

  const handleClearAccountantFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('accountant');
    setSearchParams(newParams);
    setAccountantFilter(null);
  };

  const handleTaskUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const filteredAccountant = accountantFilter
    ? allUsers.find((u) => u.id === accountantFilter)
    : null;

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (selectedCompanyId && t.company_id !== selectedCompanyId) return false;

    // Filter by accountant if selected
    if (accountantFilter) {
      const matchAssignment = t.assignments?.some((a) => a.user_id === accountantFilter);
      const comp = companies.find((c) => c.id === t.company_id);
      const matchOwner = comp?.owner_id === accountantFilter || comp?.curator_id === accountantFilter;
      if (!matchAssignment && !matchOwner) return false;
    }

    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchDoc = t.doc_type.toLowerCase().includes(q);
      const comp = companies.find((c) => c.id === t.company_id);
      const matchComp = comp?.name.toLowerCase().includes(q) || false;
      const matchNotes = t.notes?.toLowerCase().includes(q) || false;
      if (!matchDoc && !matchComp && !matchNotes) return false;
    }
    return true;
  });

  const todayTasks = filteredTasks.filter((t) => {
    if (t.status === 'done' || t.status === 'submitted' || t.status === 'waiting') return false;
    const u = getTaskUrgency(t);
    return u === 'today' || u === 'overdue';
  });

  const thisWeekTasks = filteredTasks.filter((t) => {
    if (t.status === 'done' || t.status === 'submitted' || t.status === 'waiting') return false;
    return getTaskUrgency(t) === 'this_week';
  });

  const laterTasks = filteredTasks.filter((t) => {
    if (t.status === 'done' || t.status === 'submitted' || t.status === 'waiting') return false;
    return getTaskUrgency(t) === 'later';
  });

  const waitingTasks = filteredTasks.filter((t) => t.status === 'waiting');

  const doneTasks = filteredTasks.filter(
    (t) => t.status === 'done' || t.status === 'submitted'
  );

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  return (
    <div className="w-full min-h-screen bg-[#F4EFEA] px-8 py-7">
      {loadError && (
        <div className="mb-5 p-3 rounded-xl bg-[#FCE8E6] text-xs font-semibold text-[#D9483B]">
          {loadError}
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-[#1A1916] tracking-tight">
              {isManager ? 'Все задачи агентства' : 'Мои задачи'}
            </h1>
          </div>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Контроль дедлайнов сдачи налоговой и статистической отчётности клиентов
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="p-2 rounded-lg border border-[#D4CDBF] text-gray-600 hover:text-black bg-white hover:bg-[#F9F7F3] transition shadow-2xs"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1E4D3B]' : ''}`} />
          </button>
          <Link
            to="/companies/new"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#D4CDBF] bg-white text-xs font-semibold text-[#1A1916] hover:bg-[#F9F7F3] transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Клиент</span>
          </Link>
          <Link
            to={selectedCompanyId ? `/tasks/new?company_id=${selectedCompanyId}` : '/tasks/new'}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Новая задача</span>
          </Link>
        </div>
      </div>

      {/* Active Accountant Filter Banner */}
      {filteredAccountant && (
        <div className="mb-5 p-3 bg-white border border-[#1E4D3B]/40 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#E2EFE7] text-[#1E4D3B] flex items-center justify-center font-bold text-xs">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-[#1A1916]">
              Фильтр по сотруднику: <span className="font-extrabold">{filteredAccountant.full_name}</span> ({filteredAccountant.email})
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearAccountantFilter}
            className="text-xs text-gray-400 hover:text-black flex items-center gap-1 p-1"
          >
            <X className="w-4 h-4" />
            <span>Сбросить</span>
          </button>
        </div>
      )}

      {/* Active Company Filter Banner if selected */}
      {selectedCompany && (
        <div className="mb-5 p-3.5 bg-white border border-[#1E4D3B]/40 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[#E2EFE7] text-[#1E4D3B] uppercase">
              {selectedCompany.client_type}
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#1A1916]">
                {selectedCompany.name}
              </h3>
              <p className="text-[11px] text-gray-500">
                ИНН: {selectedCompany.inn} • {selectedCompany.tax_type?.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/companies/${selectedCompany.id}`}
              className="text-xs font-semibold text-[#1E4D3B] hover:underline"
            >
              Карточка клиента →
            </Link>
            <button
              onClick={() => handleSelectCompany(null)}
              className="p-1 rounded-lg text-gray-400 hover:text-[#D9483B] hover:bg-[#FCE8E6]"
              title="Показать все компании"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search bar & view toggle */}
      <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-[#EAE5DD] rounded-2xl shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={taskSearch}
            onChange={(e) => setTaskSearch(e.target.value)}
            placeholder="Поиск по названию документа или примечанию..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#D4CDBF] rounded-lg focus:outline-none focus:border-[#1E4D3B] text-[#1A1916]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-[#D4CDBF] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('board')}
              aria-label="Показать доску"
              className={`rounded-md p-1.5 ${viewMode === 'board' ? 'bg-[#E2EFE7] text-[#1E4D3B]' : 'text-gray-400 hover:text-black'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              aria-label="Показать список"
              className={`rounded-md p-1.5 ${viewMode === 'list' ? 'bg-[#E2EFE7] text-[#1E4D3B]' : 'text-gray-400 hover:text-black'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowDone(!showDone)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition shadow-2xs ${
              showDone
                ? 'bg-[#E2EFE7] border-[#1E4D3B] text-[#1E4D3B]'
                : 'bg-white border-[#D4CDBF] text-gray-600 hover:text-black'
            }`}
          >
            {showDone ? 'Скрыть архив сданных' : `Архив сданных (${doneTasks.length})`}
          </button>
        </div>
      </div>

      {/* Task Sections */}
      <div className="space-y-6">
        {/* 1. СЕГОДНЯ / ПРОСРОЧЕНО */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D9483B]" />
              <h2 className="text-sm font-bold text-[#1A1916]">
                Сегодня и горящие дедлайны
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FCE8E6] text-[#D9483B]">
                {todayTasks.length}
              </span>
            </div>
          </div>

          {todayTasks.length === 0 ? (
            <div className="bg-white border border-[#EAE5DD] rounded-2xl p-6 text-center text-xs text-gray-500 shadow-2xs">
              <CheckCircle2 className="w-6 h-6 text-[#1E4D3B] mx-auto mb-1.5 opacity-80" />
              Горящих дедлайнов нет.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTaskUpdated={handleTaskUpdated}
                  onTaskDeleted={handleTaskDeleted}
                  showAccountant={isManager}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </section>

        {/* 2. НА ЭТОЙ НЕДЕЛЕ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C47F2A]" />
              <h2 className="text-sm font-bold text-[#1A1916]">
                На этой неделе (до 7 дней)
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#FFF0D6] text-[#C47F2A]">
                {thisWeekTasks.length}
              </span>
            </div>
          </div>

          {thisWeekTasks.length === 0 ? (
            <div className="bg-white border border-[#EAE5DD] rounded-2xl p-5 text-center text-xs text-gray-500 shadow-2xs">
              На ближайшие 7 дней задач не запланировано
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {thisWeekTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTaskUpdated={handleTaskUpdated}
                  onTaskDeleted={handleTaskDeleted}
                  showAccountant={isManager}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </section>

        {/* 3. ОЖИДАЕТ ОТВЕТА */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1E4D3B]" />
              <h2 className="text-sm font-bold text-[#1A1916]">
                Ожидает ответа (ведомства / клиента)
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E2EFE7] text-[#1E4D3B]">
                {waitingTasks.length}
              </span>
            </div>
          </div>

          {waitingTasks.length === 0 ? (
            <div className="bg-white border border-[#EAE5DD] rounded-2xl p-5 text-center text-xs text-gray-500 shadow-2xs">
              Нет документов в режиме ожидания ответа
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {waitingTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTaskUpdated={handleTaskUpdated}
                  onTaskDeleted={handleTaskDeleted}
                  showAccountant={isManager}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </section>

        {/* 4. ПОЗЖЕ */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <h2 className="text-sm font-bold text-[#1A1916]">
                Позже
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {laterTasks.length}
              </span>
            </div>
          </div>

          {laterTasks.length === 0 ? (
            <div className="bg-white border border-[#EAE5DD] rounded-2xl p-5 text-center text-xs text-gray-500 shadow-2xs">
              Нет долгосрочных задач
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {laterTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTaskUpdated={handleTaskUpdated}
                  onTaskDeleted={handleTaskDeleted}
                  showAccountant={isManager}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )}
        </section>

        {/* 5. АРХИВ СДАННЫХ */}
        {showDone && (
          <section className="pt-4 border-t border-[#EAE5DD]">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-[#1E4D3B]" />
              <h2 className="text-sm font-bold text-[#1A1916]">
                Сданные и подтвержденные отчеты
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#E2EFE7] text-[#1E4D3B]">
                {doneTasks.length}
              </span>
            </div>

            {doneTasks.length === 0 ? (
              <div className="bg-white border border-[#EAE5DD] rounded-2xl p-5 text-center text-xs text-gray-500 shadow-2xs">
                Нет сданных отчетов
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {doneTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onTaskUpdated={handleTaskUpdated}
                    onTaskDeleted={handleTaskDeleted}
                    showAccountant={isManager}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
