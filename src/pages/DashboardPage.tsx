import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  PlusCircle, 
  Calendar, 
  AlertTriangle, 
  Clock, 
  Hourglass, 
  CheckCircle2, 
  Filter, 
  X,
  Search,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getCompanies, getTasks, subscribeToTasks } from '../lib/api';
import { Company, Task } from '../types';
import { CompanySidebar } from '../components/CompanySidebar';
import { TaskCard } from '../components/TaskCard';
import { getTaskUrgency } from '../lib/dateUtils';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    searchParams.get('company') || null
  );
  const [loading, setLoading] = useState(true);
  const [taskSearch, setTaskSearch] = useState('');
  const [showDone, setShowDone] = useState(false);

  const isManager = user?.role === 'manager';

  const loadData = async () => {
    try {
      setLoading(true);
      // If manager, load all companies/tasks; if accountant, load only own
      const ownerId = isManager ? undefined : user?.id;
      const [comps, tks] = await Promise.all([
        getCompanies(ownerId),
        getTasks({ ownerId }),
      ]);
      setCompanies(comps);
      setTasks(tks);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Realtime subscription for tasks updates
  useEffect(() => {
    const unsubscribe = subscribeToTasks(() => {
      // Reload on change
      const ownerId = isManager ? undefined : user?.id;
      getTasks({ ownerId }).then(setTasks);
      getCompanies(ownerId).then(setCompanies);
    });
    return () => unsubscribe();
  }, [user, isManager]);

  const handleSelectCompany = (id: string | null) => {
    setSelectedCompanyId(id);
    if (id) {
      setSearchParams({ company: id });
    } else {
      setSearchParams({});
    }
  };

  const handleTaskUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleTaskDeleted = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (selectedCompanyId && t.company_id !== selectedCompanyId) return false;
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchDoc = t.doc_type.toLowerCase().includes(q);
      const matchComp = t.company?.name.toLowerCase().includes(q) || false;
      const matchNotes = t.notes?.toLowerCase().includes(q) || false;
      if (!matchDoc && !matchComp && !matchNotes) return false;
    }
    return true;
  });

  // Group tasks by urgency
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Welcome & Summary Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#2B2A25] tracking-tight">
              {isManager ? 'Задачи всех бухгалтеров' : 'Мой рабочий стол'}
            </h1>
            {isManager && (
              <span className="text-xs bg-[#FBEBD9] text-[#DB8A3C] font-semibold px-2.5 py-0.5 rounded-[6px]">
                Режим руководителя
              </span>
            )}
          </div>
          <p className="text-xs text-[#8C8577] mt-1">
            Контроль дедлайнов сдачи налоговой и статистической отчётности клиентов
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-[10px] border border-[#EAE3D6] text-[#8C8577] hover:text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
            title="Обновить список"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#5FA07A]' : ''}`} />
          </button>
          <Link
            to={selectedCompanyId ? `/tasks/new?company_id=${selectedCompanyId}` : '/tasks/new'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-xs font-semibold text-white bg-[#5FA07A] hover:bg-[#528E6B] transition shadow-none"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Новая задача</span>
          </Link>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Company Sidebar */}
        <CompanySidebar
          companies={companies}
          tasks={tasks}
          selectedCompanyId={selectedCompanyId}
          onSelectCompany={handleSelectCompany}
          loading={loading}
        />

        {/* Right Column: Task Groups by Urgency */}
        <main className="flex-1 w-full min-w-0">
          {/* Active Company Filter Banner if selected */}
          {selectedCompany && (
            <div className="mb-5 p-3.5 bg-white border border-[#5FA07A]/40 rounded-[10px] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-[4px] bg-[#E7F3EB] text-[#5FA07A] uppercase">
                  {selectedCompany.client_type}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#2B2A25]">
                    {selectedCompany.name}
                  </h3>
                  <p className="text-[11px] text-[#8C8577]">
                    ИНН: {selectedCompany.inn} • {selectedCompany.tax_type?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/companies/${selectedCompany.id}`}
                  className="text-xs font-medium text-[#5FA07A] hover:underline"
                >
                  Карточка компании →
                </Link>
                <button
                  onClick={() => handleSelectCompany(null)}
                  className="p-1 rounded-[6px] text-[#8C8577] hover:text-[#DD6B60] hover:bg-[#FCE6E3]"
                  title="Показать все компании"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Search bar & completed filter */}
          <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 border border-[#EAE3D6] rounded-[10px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8577]" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Поиск по названию документа или примечанию..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowDone(!showDone)}
                className={`px-3 py-1.5 rounded-[8px] text-xs font-medium border transition ${
                  showDone
                    ? 'bg-[#E7F3EB] border-[#5FA07A] text-[#5FA07A]'
                    : 'bg-white border-[#EAE3D6] text-[#8C8577] hover:text-[#2B2A25]'
                }`}
              >
                {showDone ? 'Скрыть архив сданных' : `Архив сданных (${doneTasks.length})`}
              </button>
            </div>
          </div>

          {/* 4 Urgency Sections */}
          <div className="space-y-6">
            {/* 1. СЕГОДНЯ / ПРОСРОЧЕНО (#DD6B60, bg #FCE6E3) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#DD6B60]" />
                  <h2 className="text-sm font-bold text-[#2B2A25] tracking-tight">
                    Сегодня и горящие дедлайны
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[#FCE6E3] text-[#DD6B60]">
                    {todayTasks.length}
                  </span>
                </div>
                {todayTasks.length > 0 && (
                  <span className="text-[11px] text-[#DD6B60] font-medium">
                    Требуют срочного внимания
                  </span>
                )}
              </div>

              {todayTasks.length === 0 ? (
                <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6 text-center text-xs text-[#8C8577]">
                  <CheckCircle2 className="w-6 h-6 text-[#5FA07A] mx-auto mb-1.5 opacity-80" />
                  На сегодня горящих дедлайнов нет. Отличная работа!
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
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 2. НА ЭТОЙ НЕДЕЛЕ (#DB8A3C, bg #FBEBD9) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#DB8A3C]" />
                  <h2 className="text-sm font-bold text-[#2B2A25] tracking-tight">
                    На этой неделе (до 7 дней)
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[#FBEBD9] text-[#DB8A3C]">
                    {thisWeekTasks.length}
                  </span>
                </div>
              </div>

              {thisWeekTasks.length === 0 ? (
                <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5 text-center text-xs text-[#8C8577]">
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
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 3. ОЖИДАЕТ ОТВЕТА (#5FA07A, bg #E7F3EB) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#5FA07A]" />
                  <h2 className="text-sm font-bold text-[#2B2A25] tracking-tight">
                    Ожидает ответа (ведомства / клиента)
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[#E7F3EB] text-[#5FA07A]">
                    {waitingTasks.length}
                  </span>
                </div>
              </div>

              {waitingTasks.length === 0 ? (
                <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5 text-center text-xs text-[#8C8577]">
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
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 4. ПОЗЖЕ (#C7A96E, bg #F6EFDE) */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#C7A96E]" />
                  <h2 className="text-sm font-bold text-[#2B2A25] tracking-tight">
                    Позже
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[#F6EFDE] text-[#C7A96E]">
                    {laterTasks.length}
                  </span>
                </div>
              </div>

              {laterTasks.length === 0 ? (
                <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5 text-center text-xs text-[#8C8577]">
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
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 5. АРХИВ СДАННЫХ (IF TOGGLED) */}
            {showDone && (
              <section className="pt-4 border-t border-[#EAE3D6]">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-[#5FA07A]" />
                  <h2 className="text-sm font-bold text-[#2B2A25]">
                    Сданные и подтвержденные отчеты
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-[6px] bg-[#E7F3EB] text-[#5FA07A]">
                    {doneTasks.length}
                  </span>
                </div>

                {doneTasks.length === 0 ? (
                  <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5 text-center text-xs text-[#8C8577]">
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
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
