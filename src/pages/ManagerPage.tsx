import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus,
  Flame,
  Check
} from 'lucide-react';
import { 
  getAllUsers, 
  getCompanies, 
  getTasks, 
  subscribeToTasks 
} from '../lib/api';
import { UserProfile, Company, Task, AccountantStat } from '../types';
import { getTaskUrgency, formatDateRu } from '../lib/dateUtils';
import { useAuth } from '../context/AuthContext';
import { evaluateTaskEscalations, resolveTaskEscalation } from '../lib/escalation';

export const ManagerPage: React.FC = () => {
  const { user } = useAuth();
  const [accountants, setAccountants] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checkingEscalations, setCheckingEscalations] = useState(false);

  const loadData = async () => {
    try {
      setLoadError(null);
      setLoading(true);
      const [u, c, t] = await Promise.all([
        getAllUsers(),
        getCompanies(),
        getTasks(),
      ]);
      setAccountants(u.filter((x) => x.role === 'accountant'));
      setCompanies(c);
      setTasks(t);
    } catch (err) {
      console.error('Error loading manager metrics:', err);
      setLoadError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEscalations = async () => {
    setCheckingEscalations(true);
    try {
      const res = await evaluateTaskEscalations(tasks, user);
      if (res.newlyEscalatedCount > 0) {
        alert(`Эскалировано ${res.newlyEscalatedCount} задач! Они вынесены на контроль.`);
        await loadData();
      } else {
        alert('Все задачи проверены. Новых критических дедлайнов не обнаружено.');
      }
    } catch (err) {
      console.error('Error checking escalations:', err);
    } finally {
      setCheckingEscalations(false);
    }
  };

  const handleResolveEscalation = async (task: Task) => {
    if (!user) return;
    try {
      await resolveTaskEscalation(task, user);
      await loadData();
    } catch (err) {
      console.error('Failed to resolve escalation:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = subscribeToTasks(() => {
      loadData();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Compute Metrics matching the design
  const totalAccountants = accountants.length;
  const totalCompanies = companies.length;

  const tasksToday = tasks.filter((t) => {
    if (t.status === 'done' || t.status === 'submitted') return false;
    return getTaskUrgency(t) === 'today';
  }).length;

  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'done' || t.status === 'submitted') return false;
    return getTaskUrgency(t) === 'overdue';
  });

  const totalOverdue = overdueTasks.length;

  // Escalated tasks (under manager's direct attention)
  const escalatedTasks = tasks.filter(
    (t) => t.is_escalated && t.status !== 'done' && t.status !== 'submitted'
  );

  // Compute stats per accountant
  const accountantStats: AccountantStat[] = accountants.map((acc) => {
    const accCompanies = companies.filter(
      (company) =>
        company.owner_id === acc.id ||
        company.curator_id === acc.id ||
        tasks.some(
          (task) =>
            task.company_id === company.id &&
            task.assignments?.some((assignment) => assignment.user_id === acc.id)
        )
    );
    const accCompanyIds = new Set(accCompanies.map((c) => c.id));
    const accTasks = tasks.filter((task) => {
      if (task.assignments?.length) {
        return task.assignments.some(
          (assignment) => assignment.assignment_role === 'executor' && assignment.user_id === acc.id
        );
      }
      return accCompanyIds.has(task.company_id);
    });

    const completedTasks = accTasks.filter(
      (task) => task.status === 'done' || task.status === 'submitted'
    ).length;
    const remainingTasks = accTasks.length - completedTasks;
    const pendingTasks = accTasks.filter(
      (task) => task.status !== 'done' && task.status !== 'submitted'
    );
    const todayCount = pendingTasks.filter((t) => getTaskUrgency(t) === 'today').length;
    const overdueCount = pendingTasks.filter((t) => getTaskUrgency(t) === 'overdue').length;
    const completionPercentage = accTasks.length
      ? Math.round((completedTasks / accTasks.length) * 100)
      : 0;

    return {
      accountant: acc,
      companiesCount: accCompanies.length,
      tasksTodayCount: todayCount,
      overdueCount,
      completedTasks,
      remainingTasks,
      totalTasks: accTasks.length,
      completionPercentage,
    };
  });

  const formatDaysOverdue = (dateStr: string) => {
    const diffTime = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    return `${diffDays} дн.`;
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'нояб', 'дек'];
    return `с ${d.getDate()} ${months[d.getMonth()]}`;
  };

  const getCompanyInfo = (companyId: string) => {
    return companies.find((c) => c.id === companyId);
  };

  const getAssigneeName = (task: Task) => {
    if (task.assignments?.length) {
      const exec = task.assignments.find((a) => a.assignment_role === 'executor');
      if (exec) {
        const found = accountants.find((a) => a.id === exec.user_id);
        if (found) return found.full_name;
      }
    }
    const comp = companies.find((c) => c.id === task.company_id);
    if (comp?.curator_id) {
      const found = accountants.find((a) => a.id === comp.curator_id);
      if (found) return found.full_name;
    }
    return 'Демо';
  };

  return (
    <div className="w-full min-h-screen bg-[#F4EFEA] px-8 py-7">
      {loadError && (
        <div className="mb-5 p-3 rounded-xl bg-[#FCE8E6] text-xs font-semibold text-[#D9483B]">
          {loadError}
        </div>
      )}

      {/* Realtime Live Indicator */}
      <div className="flex items-center gap-1.5 text-xs text-[#2E7D5A] font-medium mb-1">
        <span className="w-2 h-2 rounded-full bg-[#2E7D5A] animate-pulse" />
        <span>Данные обновляются в реальном времени</span>
      </div>

      {/* Page Header matching Image 1 */}
      <div className="flex items-center justify-between gap-4 mb-7">
        <h1 className="text-2xl font-extrabold text-[#1A1916] tracking-tight">
          Сводка руководителя
        </h1>

        <div className="flex items-center gap-2.5">
          <Link
            to="/companies/new"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#D4CDBF] bg-white text-xs font-semibold text-[#1A1916] hover:bg-[#F9F7F3] transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Клиент</span>
          </Link>
          <Link
            to="/tasks/new"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E4D3B] hover:bg-[#163B2D] text-white text-xs font-semibold transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Задача</span>
          </Link>
        </div>
      </div>

      {/* 4 Metric Stats Row with Vertical Dividers matching Image 1 */}
      <div className="flex items-center gap-6 sm:gap-10 mb-8 overflow-x-auto pb-2">
        {/* 1. Accountants */}
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-[#1A1916] leading-none mb-1.5">
            {totalAccountants}
          </span>
          <span className="text-xs text-gray-500 font-medium">бухгалтеров</span>
        </div>

        <div className="h-9 w-px bg-[#E2DBD0]" />

        {/* 2. Companies & IP */}
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-[#1A1916] leading-none mb-1.5">
            {totalCompanies}
          </span>
          <span className="text-xs text-gray-500 font-medium">компаний и ИП</span>
        </div>

        <div className="h-9 w-px bg-[#E2DBD0]" />

        {/* 3. Deadlines Today */}
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-[#1A1916] leading-none mb-1.5">
            {tasksToday}
          </span>
          <span className="text-xs text-gray-500 font-medium">дедлайнов сегодня</span>
        </div>

        <div className="h-9 w-px bg-[#E2DBD0]" />

        {/* 4. Overdue or Urgent */}
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-[#D9483B] leading-none mb-1.5">
            {totalOverdue}
          </span>
          <span className="text-xs text-gray-500 font-medium">просрочено или срочно</span>
        </div>
      </div>

      {/* Main 2-Column Grid Layout matching Image 1 */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column (Tables & Cards) */}
        <div className="flex-1 w-full space-y-6 min-w-0">
          {/* Card 1: Нагрузка сотрудников */}
          <div className="bg-white rounded-2xl border border-[#EAE5DD] p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#F2ECE3] mb-2">
              <h2 className="text-base font-bold text-[#1A1916]">
                Нагрузка сотрудников
              </h2>
              <Link
                to="/dashboard"
                className="text-xs font-semibold text-gray-700 hover:text-black flex items-center gap-1 transition"
              >
                <span>Все задачи агентства</span>
                <span>→</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="py-3 pr-4">СОТРУДНИК</th>
                    <th className="py-3 px-3 text-center">КОМП.</th>
                    <th className="py-3 px-3 text-center">ПРОСР.</th>
                    <th className="py-3 px-3 text-center">СДАНО</th>
                    <th className="py-3 px-3 text-center">ОСТ.</th>
                    <th className="py-3 pl-4">ПРОГРЕСС</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F6F2EC]">
                  {accountantStats.map((stat) => (
                    <tr key={stat.accountant.id} className="text-xs hover:bg-[#FAF8F5] transition">
                      {/* Сотрудник */}
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#E5DFD5] text-[#4A443B] font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {stat.accountant.full_name?.charAt(0) || 'А'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-[#1A1916] truncate">
                              {stat.accountant.full_name}
                            </div>
                            <div className="text-[11px] text-gray-400 truncate">
                              {stat.accountant.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Комп. */}
                      <td className="py-3.5 px-3 text-center font-semibold text-gray-800">
                        {stat.companiesCount}
                      </td>

                      {/* Проср. */}
                      <td className="py-3.5 px-3 text-center">
                        {stat.overdueCount > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-[#FCE8E6] text-[#D9483B]">
                            {stat.overdueCount}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">0</span>
                        )}
                      </td>

                      {/* Сдано */}
                      <td className="py-3.5 px-3 text-center font-semibold text-gray-800">
                        {stat.completedTasks}
                      </td>

                      {/* Ост. */}
                      <td className="py-3.5 px-3 text-center font-semibold text-gray-800">
                        {stat.remainingTasks}
                      </td>

                      {/* Прогресс */}
                      <td className="py-3.5 pl-4">
                        {stat.totalTasks === 0 ? (
                          <span className="text-xs text-gray-400 font-normal">нет задач</span>
                        ) : (
                          <div className="w-32">
                            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#1E4D3B] rounded-full transition-all duration-300"
                                style={{ width: `${stat.completionPercentage}%` }}
                              />
                            </div>
                            <div className="text-[11px] text-gray-500 font-medium mt-1 whitespace-nowrap">
                              {stat.completedTasks} из {stat.totalTasks} · {stat.completionPercentage}%
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Просроченные отчёты */}
          <div className="bg-white rounded-2xl border border-[#EAE5DD] p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#F2ECE3] mb-3">
              <div className="flex items-center gap-1.5">
                <h2 className="text-base font-bold text-[#1A1916]">
                  Просроченные отчёты
                </h2>
                <span className="text-base font-bold text-[#D9483B]">
                  {totalOverdue}
                </span>
              </div>
              <span className="text-xs text-gray-400 font-normal">
                нужно сдать, чтобы избежать штрафов
              </span>
            </div>

            <div className="divide-y divide-[#F6F2EC]">
              {overdueTasks.slice(0, 8).map((task) => {
                const comp = getCompanyInfo(task.company_id);
                return (
                  <div
                    key={task.id}
                    className="py-3.5 flex items-center justify-between gap-4 hover:bg-[#FAF8F5] transition pl-1 rounded-lg"
                  >
                    {/* Left vertical red accent */}
                    <div className="flex items-start gap-3 border-l-[3px] border-[#D9483B] pl-3 min-w-0">
                      <div>
                        <div className="font-semibold text-sm text-[#1A1916] leading-snug">
                          {task.doc_type}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {comp ? `${comp.name} · ИНН ${comp.inn}` : 'Клиент не указан'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Date, Assignee, Action */}
                    <div className="flex items-center gap-6 flex-shrink-0 text-xs">
                      <span className="font-medium text-[#D9483B]">
                        {formatShortDate(task.due_date)}
                      </span>
                      <span className="text-gray-600 min-w-14">
                        {getAssigneeName(task)}
                      </span>
                      <Link
                        to={comp ? `/companies/${comp.id}` : '/dashboard'}
                        className="font-medium text-gray-800 hover:text-black hover:underline"
                      >
                        Перейти
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Escalations Panel matching Image 1 */}
        <div className="w-full lg:w-[330px] flex-shrink-0 space-y-4">
          <div>
            <div className="text-[11px] font-bold text-[#D9483B] tracking-wider uppercase mb-1">
              ЭСКАЛАЦИИ {escalatedTasks.length}
            </div>
            <h2 className="text-base font-bold text-[#1A1916]">
              Нужно ваше решение
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed mt-1">
              Риск штрафа или клиент не выходит на связь. Задачи переданы руководителю.
            </p>
          </div>

          {/* Escalation Cards List */}
          <div className="space-y-3">
            {escalatedTasks.map((task) => {
              const comp = getCompanyInfo(task.company_id);
              return (
                <div
                  key={task.id}
                  className="bg-white rounded-xl border border-[#EAE5DD] p-4 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#D9483B]">
                      Дедлайн {new Date(task.due_date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {formatDaysOverdue(task.due_date)}
                    </span>
                  </div>

                  <div className="font-bold text-sm text-[#1A1916] leading-snug">
                    {task.doc_type}
                  </div>

                  <div className="text-xs text-gray-500">
                    {comp ? `${comp.name} · ИНН ${comp.inn}` : 'Компания не указана'}
                  </div>

                  <div className="text-xs text-gray-600 leading-relaxed">
                    {task.escalation_reason || 'Срок сдачи просрочен, отчётность не сдана.'}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-gray-400">
                      {comp?.phone ? comp.phone : 'Нет телефона'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleResolveEscalation(task)}
                      className="px-3 py-1 rounded-lg border border-[#D4CDBF] bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-2xs"
                    >
                      Снять контроль
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Button: Проверить риски эскалации */}
          <button
            type="button"
            onClick={handleCheckEscalations}
            disabled={checkingEscalations}
            className="w-full py-2.5 rounded-lg border border-[#D4CDBF] bg-white text-xs font-semibold text-[#D9483B] hover:bg-[#FDF6F5] transition shadow-2xs disabled:opacity-50"
          >
            {checkingEscalations ? 'Проверка...' : 'Проверить риски эскалации'}
          </button>
        </div>
      </div>
    </div>
  );
};
