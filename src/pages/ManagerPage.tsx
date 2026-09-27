import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Building2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Radio, 
  ArrowRight, 
  UserCheck, 
  BarChart3, 
  Mail, 
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, getCompanies, getTasks, subscribeToTasks, subscribeToRealtimeAny } from '../lib/api';
import { UserProfile, Company, Task, AccountantStat } from '../types';
import { getTaskUrgency, formatDateRu } from '../lib/dateUtils';

export const ManagerPage: React.FC = () => {
  const { user } = useAuth();
  const [accountants, setAccountants] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, c, t] = await Promise.all([
        getAllUsers(),
        getCompanies(),
        getTasks(),
      ]);
      setAccountants(u.filter((x) => x.role === 'accountant' || x.role === 'manager'));
      setCompanies(c);
      setTasks(t);
    } catch (err) {
      console.error('Error loading manager metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to Realtime updates on tasks table
    const unsubscribe = subscribeToTasks((payload) => {
      console.log('Realtime event received in Manager view:', payload);
      setLastRealtimeEvent(new Date().toLocaleTimeString('ru-RU'));
      // Silently refresh metrics
      Promise.all([getAllUsers(), getCompanies(), getTasks()]).then(([u, c, t]) => {
        setAccountants(u.filter((x) => x.role === 'accountant' || x.role === 'manager'));
        setCompanies(c);
        setTasks(t);
      });
    });

    return () => unsubscribe();
  }, []);

  // Compute Agency Aggregate Metrics
  const totalAccountants = accountants.filter((a) => a.role === 'accountant').length;
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

  // Compute statistics per accountant
  const accountantStats: AccountantStat[] = accountants
    .filter((a) => a.role === 'accountant')
    .map((acc) => {
      const accCompanies = companies.filter((c) => c.owner_id === acc.id);
      const accCompanyIds = new Set(accCompanies.map((c) => c.id));
      const accTasks = tasks.filter((t) => accCompanyIds.has(t.company_id));

      const activeTasks = accTasks.filter((t) => t.status !== 'done');
      const todayCount = activeTasks.filter((t) => getTaskUrgency(t) === 'today').length;
      const overdueCount = activeTasks.filter((t) => getTaskUrgency(t) === 'overdue').length;

      // Workload calculation: weighted by companies and tasks (base 10 active tasks = 100%)
      const workloadPercentage = Math.min(
        100,
        Math.round((activeTasks.length / 8) * 100)
      );

      let status: 'optimal' | 'high' | 'overloaded' = 'optimal';
      if (overdueCount > 0 || workloadPercentage > 85) {
        status = 'overloaded';
      } else if (workloadPercentage > 60 || todayCount > 2) {
        status = 'high';
      }

      return {
        accountant: acc,
        companiesCount: accCompanies.length,
        tasksTodayCount: todayCount,
        overdueCount: overdueCount,
        totalActiveTasks: activeTasks.length,
        workloadPercentage,
        status,
      };
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header with Realtime Pulse Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[#2B2A25] tracking-tight">
              Панель руководителя агентства
            </h1>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#E7F3EB] border border-[#5FA07A]/30 text-xs font-medium text-[#5FA07A]">
              <span className="w-2 h-2 rounded-full bg-[#5FA07A] animate-pulse" />
              <span>Realtime онлайн</span>
              {lastRealtimeEvent && (
                <span className="text-[10px] text-[#8C8577]">
                  (обновлено {lastRealtimeEvent})
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-[#8C8577] mt-1">
            Оперативный контроль загрузки бухгалтеров, своевременности сдачи отчетности и клиентов
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#EAE3D6] text-xs font-semibold text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8C8577] ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
          <Link
            to="/companies/new"
            className="px-3.5 py-1.5 rounded-[8px] text-xs font-medium text-[#2B2A25] bg-white border border-[#EAE3D6] hover:bg-[#FAF8F5] transition"
          >
            + Клиент
          </Link>
          <Link
            to="/tasks/new"
            className="px-3.5 py-1.5 rounded-[8px] text-xs font-medium text-white bg-[#5FA07A] hover:bg-[#528E6B] transition"
          >
            + Задача
          </Link>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* 1. Accountants */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8577]">Бухгалтеров в штате</span>
            <div className="w-9 h-9 rounded-[8px] bg-[#F6EFDE] text-[#C7A96E] flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-[#2B2A25]">{totalAccountants}</span>
            <span className="text-xs text-[#8C8577] ml-2">сотрудников</span>
          </div>
        </div>

        {/* 2. Companies */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8577]">Компаний и ИП</span>
            <div className="w-9 h-9 rounded-[8px] bg-[#FBEBD9] text-[#DB8A3C] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-[#2B2A25]">{totalCompanies}</span>
            <span className="text-xs text-[#8C8577] ml-2">на сопровождении</span>
          </div>
        </div>

        {/* 3. Tasks Today */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8577]">Задач на сегодня</span>
            <div className="w-9 h-9 rounded-[8px] bg-[#E7F3EB] text-[#5FA07A] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-[#5FA07A]">{tasksToday}</span>
            <span className="text-xs text-[#8C8577] ml-2">дедлайнов сегодня</span>
          </div>
        </div>

        {/* 4. Overdue */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C8577]">Просрочек / Срочных</span>
            <div className="w-9 h-9 rounded-[8px] bg-[#FCE6E3] text-[#DD6B60] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-bold text-[#DD6B60]">{totalOverdue}</span>
            <span className="text-xs text-[#8C8577] ml-2">требуют контроля</span>
          </div>
        </div>
      </div>

      {/* Main Table: Accountants workload and real-time status */}
      <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6 mb-8">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#EAE3D6]">
          <div>
            <h2 className="text-base font-bold text-[#2B2A25]">
              Загрузка и показатели сотрудников
            </h2>
            <p className="text-xs text-[#8C8577]">
              Распределение компаний, задачи на сегодня и текущий статус загрузки
            </p>
          </div>
          <Link
            to="/dashboard"
            className="text-xs font-medium text-[#5FA07A] hover:underline"
          >
            Смотреть все задачи агентства →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#EAE3D6] text-[#8C8577] font-semibold">
                <th className="pb-3 pl-1">Сотрудник</th>
                <th className="pb-3 text-center">Компаний</th>
                <th className="pb-3 text-center">Задач сегодня</th>
                <th className="pb-3 text-center">Просрочек</th>
                <th className="pb-3 text-center">Всего активных</th>
                <th className="pb-3">Загрузка</th>
                <th className="pb-3">Статус</th>
                <th className="pb-3 text-right pr-1">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAE3D6]/70">
              {accountantStats.map((stat) => {
                const acc = stat.accountant;

                return (
                  <tr key={acc.id} className="hover:bg-[#FAF8F5]/60 transition">
                    {/* Name & Email */}
                    <td className="py-3.5 pl-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-[8px] bg-[#E7F3EB] text-[#5FA07A] font-bold flex items-center justify-center">
                          {acc.full_name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-[#2B2A25] block">
                            {acc.full_name}
                          </span>
                          <span className="text-[11px] text-[#8C8577]">{acc.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Companies */}
                    <td className="py-3.5 text-center">
                      <span className="font-bold text-sm text-[#2B2A25]">
                        {stat.companiesCount}
                      </span>
                    </td>

                    {/* Tasks today */}
                    <td className="py-3.5 text-center">
                      <span className={`font-bold text-sm px-2 py-0.5 rounded-[4px] ${
                        stat.tasksTodayCount > 0 ? 'bg-[#FBEBD9] text-[#DB8A3C]' : 'text-[#8C8577]'
                      }`}>
                        {stat.tasksTodayCount}
                      </span>
                    </td>

                    {/* Overdue */}
                    <td className="py-3.5 text-center">
                      <span className={`font-bold text-sm px-2 py-0.5 rounded-[4px] ${
                        stat.overdueCount > 0 ? 'bg-[#FCE6E3] text-[#DD6B60]' : 'text-[#8C8577]'
                      }`}>
                        {stat.overdueCount}
                      </span>
                    </td>

                    {/* Total Active */}
                    <td className="py-3.5 text-center">
                      <span className="font-semibold text-sm text-[#2B2A25]">
                        {stat.totalActiveTasks}
                      </span>
                    </td>

                    {/* Workload Progress Bar */}
                    <td className="py-3.5 w-44">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-[#FAF8F5] border border-[#EAE3D6] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              stat.workloadPercentage > 80
                                ? 'bg-[#DD6B60]'
                                : stat.workloadPercentage > 50
                                ? 'bg-[#DB8A3C]'
                                : 'bg-[#5FA07A]'
                            }`}
                            style={{ width: `${stat.workloadPercentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-[#2B2A25] min-w-[32px]">
                          {stat.workloadPercentage}%
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5">
                      {stat.status === 'optimal' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#E7F3EB] text-[#5FA07A]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#5FA07A]" />
                          Оптимально
                        </span>
                      ) : stat.status === 'high' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#FBEBD9] text-[#DB8A3C]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#DB8A3C]" />
                          Высокая загрузка
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#FCE6E3] text-[#DD6B60]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#DD6B60]" />
                          Перегружен / Долги
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 text-right pr-1">
                      <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#5FA07A] hover:underline"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Задачи</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overdue Items Alert Section */}
      {overdueTasks.length > 0 && (
        <div className="bg-white border border-[#DD6B60]/40 rounded-[10px] p-6">
          <div className="flex items-center gap-2 mb-3 text-[#DD6B60]">
            <AlertCircle className="w-5 h-5" />
            <h2 className="text-base font-bold">
              Внимание: Просроченные отчеты ({overdueTasks.length})
            </h2>
          </div>
          <p className="text-xs text-[#8C8577] mb-4">
            Эти документы требуют немедленной отправки в государственные органы для предотвращения штрафов:
          </p>

          <div className="space-y-2.5">
            {overdueTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 bg-[#FCE6E3]/50 border border-[#DD6B60]/20 rounded-[8px] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
              >
                <div>
                  <span className="font-bold text-[#2B2A25]">{t.doc_type}</span>
                  <div className="text-[11px] text-[#8C8577] mt-0.5">
                    Компания: <strong className="text-[#2B2A25]">{t.company?.name}</strong> • ИНН {t.company?.inn}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#DD6B60]">
                    Срок был: {formatDateRu(t.due_date, 'd MMM yyyy')}
                  </span>
                  {t.company?.owner && (
                    <span className="text-[11px] bg-white border border-[#EAE3D6] px-2 py-0.5 rounded-[4px] text-[#2B2A25]">
                      Бухгалтер: {t.company.owner.full_name.split(' ')[0]}
                    </span>
                  )}
                  <Link
                    to={`/companies/${t.company_id}`}
                    className="text-xs font-semibold text-[#5FA07A] hover:underline"
                  >
                    Перейти →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
