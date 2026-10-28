import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Building2, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  Eye,
  AlertCircle,
  Flame,
  ShieldCheck,
  Download,
  MessageCircle,
  Check,
  CalendarDays,
  FileSpreadsheet
} from 'lucide-react';
import { getAllUsers, getAllCompanyDocuments, getCompanies, getTasks, subscribeToTasks } from '../lib/api';
import { UserProfile, Company, CompanyDocument, Task, AccountantStat, ActivityLog } from '../types';
import { getTaskUrgency, formatDateRu } from '../lib/dateUtils';
import { TaskCard } from '../components/TaskCard';
import { useAuth } from '../context/AuthContext';
import { evaluateTaskEscalations, resolveTaskEscalation } from '../lib/escalation';
import { getActivityLogs, exportActivityLogsToCsv, downloadCsvFile } from '../lib/activityLog';
import { formatWhatsAppUrl } from '../lib/messenger';

export const ManagerPage: React.FC = () => {
  const { user } = useAuth();
  const [accountants, setAccountants] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [selectedAccountantId, setSelectedAccountantId] = useState('');
  const [loading, setLoading] = useState(true);
  const [checkingEscalations, setCheckingEscalations] = useState(false);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>('all');

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, c, t, d, logs] = await Promise.all([
        getAllUsers(),
        getCompanies(),
        getTasks(),
        getAllCompanyDocuments(),
        getActivityLogs({ limit: 100 }),
      ]);
      setAccountants(u.filter((x) => x.role === 'accountant' || x.role === 'manager'));
      setCompanies(c);
      setTasks(t);
      setDocuments(d);
      setActivityLogs(logs);
    } catch (err) {
      console.error('Error loading manager metrics:', err);
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
      await resolveTaskEscalation(task, user, 'Решено руководителем');
      await loadData();
    } catch (err) {
      console.error('Failed to resolve escalation:', err);
    }
  };


  useEffect(() => {
    loadData();

    // Subscribe to Realtime updates on tasks table
    const unsubscribe = subscribeToTasks((payload) => {
      console.log('Realtime event received in Manager view:', payload);
      setLastRealtimeEvent(new Date().toLocaleTimeString('ru-RU'));
      // Silently refresh metrics
      Promise.all([getAllUsers(), getCompanies(), getTasks(), getAllCompanyDocuments()]).then(([u, c, t, d]) => {
        setAccountants(u.filter((x) => x.role === 'accountant' || x.role === 'manager'));
        setCompanies(c);
        setTasks(t);
        setDocuments(d);
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
  const visibleAccountantStats = accountantStats.filter(
    (stat) => !selectedAccountantId || stat.accountant.id === selectedAccountantId
  );

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCheckEscalations}
            disabled={checkingEscalations}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#DD6B60]/30 text-xs font-semibold text-[#DD6B60] bg-[#FCE6E3]/40 hover:bg-[#FCE6E3] transition disabled:opacity-50"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{checkingEscalations ? 'Проверка...' : 'Проверить риски эскалации'}</span>
          </button>
          <Link
            to="/tax-calendar"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#EAE3D6] text-xs font-semibold text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
          >
            <CalendarDays className="w-3.5 h-3.5 text-[#5FA07A]" />
            <span>Налоги КР</span>
          </Link>
          <Link
            to="/import"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#EAE3D6] text-xs font-semibold text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#5FA07A]" />
            <span>Импорт</span>
          </Link>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[#EAE3D6] text-xs font-semibold text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8C8577] ${loading ? 'animate-spin' : ''}`} />
            <span>Обновить</span>
          </button>
          <Link
            to="/companies/new"
            className="px-3 py-1.5 rounded-[8px] text-xs font-medium text-[#2B2A25] bg-white border border-[#EAE3D6] hover:bg-[#FAF8F5] transition"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

      {/* Escalated Tasks Section (Item 7 from prompt) */}
      {(() => {
        const escalatedTasks = tasks.filter(
          (t) => t.is_escalated && t.status !== 'done' && t.status !== 'submitted'
        );

        if (escalatedTasks.length === 0) return null;

        return (
          <div className="bg-white border border-[#DD6B60] rounded-2xl p-6 mb-8 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#DD6B60]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#FCE6E3] text-[#DD6B60] flex items-center justify-center">
                  <Flame className="w-5 h-5 fill-current animate-bounce" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#2B2A25]">
                    Горящие и эскалированные задачи на контроле ({escalatedTasks.length})
                  </h2>
                  <p className="text-xs text-[#8C8577]">
                    Срочные риски штрафов или невыхода клиента на связь, переданные руководителю
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {escalatedTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-[#DD6B60]/40 bg-[#FCE6E3]/20 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#DD6B60] text-white">
                        Эскалация
                      </span>
                      <span className="text-xs font-mono font-bold text-[#DD6B60]">
                        Дедлайн: {t.due_date}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-[#2B2A25] mb-1 leading-snug">
                      {t.doc_type}
                    </h3>
                    <p className="text-xs text-[#5FA07A] font-semibold mb-2">
                      {t.company?.name || 'Компания'} (ИНН {t.company?.inn})
                    </p>

                    <div className="p-2.5 rounded-lg bg-white border border-[#DD6B60]/30 text-xs text-[#DD6B60] mb-3">
                      <strong>Причина: </strong>
                      <span>{t.escalation_reason || 'Требуется срочное решение руководителя'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#DD6B60]/20 flex items-center justify-between gap-2">
                    {t.company?.phone ? (
                      <a
                        href={formatWhatsAppUrl(
                          t.company.phone,
                          `Здравствуйте! Беспокоит руководство бухгалтерского агентства «Учётка» по компании ${t.company.name}. Срочный вопрос по отчету ${t.doc_type}.`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-[11px] font-semibold hover:bg-[#20ba59]"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Написать клиенту</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-[#8C8577]">Нет телефона</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleResolveEscalation(t)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#5FA07A] bg-white text-[#5FA07A] text-[11px] font-semibold hover:bg-[#E7F3EB]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Снять контроль</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}


      {/* Main Table: Accountants workload and real-time status */}
      <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6 mb-8">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#EAE3D6]">
          <div>
            <h2 className="text-base font-bold text-[#2B2A25]">
              Выполнение задач сотрудниками
            </h2>
            <p className="text-xs text-[#8C8577]">
              Компании, срочные задачи и прогресс выполнения задач по каждому сотруднику
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
                <th className="pb-3 text-center">Выполнено</th>
                <th className="pb-3 text-center">Осталось</th>
                <th className="pb-3">Прогресс выполнения</th>
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

                    {/* Completed tasks */}
                    <td className="py-3.5 text-center">
                      <span className="font-bold text-sm text-[#5FA07A]">
                        {stat.completedTasks}
                      </span>
                    </td>

                    {/* Remaining tasks */}
                    <td className="py-3.5 text-center">
                      <span className={`font-bold text-sm ${
                        stat.remainingTasks > 0 ? 'text-[#DB8A3C]' : 'text-[#8C8577]'
                      }`}>
                        {stat.remainingTasks}
                      </span>
                    </td>

                    {/* Completed tasks progress */}
                    <td className="py-3.5 w-44">
                      <div className="space-y-1.5">
                        <div className="w-full bg-[#FAF8F5] border border-[#EAE3D6] rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#5FA07A] transition-all duration-500"
                            style={{ width: `${stat.completionPercentage}%` }}
                          />
                        </div>
                        <span className="block text-[11px] text-[#6B6558]">
                          {stat.completedTasks} из {stat.totalTasks} · {stat.completionPercentage}%
                        </span>
                      </div>
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

      <section className="mb-8">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#2B2A25]">Профили и работа бухгалтеров</h2>
            <p className="text-xs text-[#8C8577] mt-1">
              Фильтруйте компании, задачи и загруженные документы по сотруднику.
            </p>
          </div>
          <select
            value={selectedAccountantId}
            onChange={(event) => setSelectedAccountantId(event.target.value)}
            className="min-w-56 px-3 py-2 text-xs border border-[#EAE3D6] rounded-[8px] bg-white"
            aria-label="Фильтр по бухгалтеру"
          >
            <option value="">Все бухгалтеры</option>
            {accountantStats.map((stat) => (
              <option key={stat.accountant.id} value={stat.accountant.id}>
                {stat.accountant.full_name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          {visibleAccountantStats.map((stat) => {
            const employeeCompanies = companies.filter(
              (company) => company.owner_id === stat.accountant.id
            );
            const employeeCompanyIds = new Set(employeeCompanies.map((company) => company.id));
            const employeeTasks = tasks.filter((task) => task.assignments?.length
              ? task.assignments.some(
                  (assignment) => assignment.assignment_role === 'executor' && assignment.user_id === stat.accountant.id
                )
              : employeeCompanyIds.has(task.company_id));
            const employeeDocuments = documents.filter(
              (document) => document.created_by === stat.accountant.id
                || employeeCompanyIds.has(document.company_id)
            );

            return (
              <details key={stat.accountant.id} className="bg-white border border-[#EAE3D6] rounded-[10px] group">
                <summary className="cursor-pointer list-none p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[10px] bg-[#E7F3EB] text-[#5FA07A] font-bold flex items-center justify-center">
                      {stat.accountant.full_name.charAt(0)}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-[#2B2A25]">
                        {stat.accountant.full_name}
                      </span>
                      <span className="block text-xs text-[#8C8577]">{stat.accountant.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#6B6558]">
                    <span className="px-2.5 py-1 rounded-[6px] bg-[#FAF8F5]">
                      {employeeCompanies.length} компаний
                    </span>
                    <span className="px-2.5 py-1 rounded-[6px] bg-[#FAF8F5]">
                      {employeeTasks.length} задач
                    </span>
                    <span className="px-2.5 py-1 rounded-[6px] bg-[#FAF8F5]">
                      {employeeDocuments.length} документов
                    </span>
                    <span className="text-[#5FA07A] group-open:rotate-90 transition-transform">›</span>
                  </div>
                </summary>

                <div className="border-t border-[#EAE3D6] p-4 space-y-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#8C8577] mb-2">
                      Профиль сотрудника
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#2B2A25]">
                      <p><span className="text-[#8C8577]">ФИО: </span>{stat.accountant.full_name}</p>
                      <p><span className="text-[#8C8577]">Email: </span>{stat.accountant.email}</p>
                      <p><span className="text-[#8C8577]">Дата регистрации: </span>{formatDateRu(stat.accountant.created_at, 'd MMMM yyyy')}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#8C8577] mb-2">
                      Компании и ИП
                    </h3>
                    {employeeCompanies.length === 0 ? (
                      <p className="text-xs text-[#8C8577]">За сотрудником пока не закреплены компании.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {employeeCompanies.map((company) => (
                          <Link
                            key={company.id}
                            to={`/companies/${company.id}`}
                            className="flex items-center justify-between gap-3 p-3 rounded-[8px] bg-[#FAF8F5] hover:bg-[#E7F3EB] transition"
                          >
                            <span className="text-xs font-semibold text-[#2B2A25]">{company.name}</span>
                            <span className="text-[11px] text-[#8C8577] flex-shrink-0">ИНН {company.inn}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#8C8577] mb-2">
                      Задачи
                    </h3>
                    {employeeTasks.length === 0 ? (
                      <p className="text-xs text-[#8C8577]">Задач пока нет.</p>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {employeeTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            showAccountant
                            onTaskUpdated={(updated) => {
                              setTasks((current) =>
                                current.map((item) => item.id === updated.id ? updated : item)
                              );
                            }}
                            onTaskDeleted={(deletedId) => {
                              setTasks((current) => current.filter((item) => item.id !== deletedId));
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#8C8577] mb-2">
                      Загруженные документы
                    </h3>
                    {employeeDocuments.length === 0 ? (
                      <p className="text-xs text-[#8C8577]">Сотрудник пока не загружал документы.</p>
                    ) : (
                      <div className="space-y-2">
                        {employeeDocuments.map((document) => (
                          <Link
                            key={document.id}
                            to={`/companies/${document.company_id}`}
                            className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-[8px] bg-[#FAF8F5] hover:bg-[#E7F3EB] transition text-xs"
                          >
                            <span>
                              <strong className="text-[#2B2A25]">{document.title}</strong>
                              <span className="block text-[#8C8577]">
                                {document.company?.name || companies.find((company) => company.id === document.company_id)?.name}
                                {' · '}получен {formatDateRu(document.received_at, 'd MMM yyyy')}
                              </span>
                            </span>
                            <span className="text-[#6B6558]">{document.received_address}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      {/* Overdue Items Alert Section */}
      {overdueTasks.length > 0 && (
        <div className="bg-white border border-[#DD6B60]/40 rounded-[10px] p-6 mb-8">
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

      {/* Agency Audit Trail & History (Item 8 from prompt) */}
      <div className="bg-white border border-[#EAE3D6] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-4 border-b border-[#EAE3D6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E7F3EB] text-[#5FA07A] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#2B2A25]">
                История действий команды (Audit Trail)
              </h2>
              <p className="text-xs text-[#8C8577]">
                Кто, что и когда сделал: фиксация сдачи отчётов, статусов и напоминаний для подтверждения клиентам и УГНС
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activityLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const csv = exportActivityLogsToCsv(activityLogs);
                  downloadCsvFile(csv, `agency_audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAE3D6] bg-white text-xs font-semibold text-[#2B2A25] hover:bg-[#FAF8F5] transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-[#5FA07A]" />
                <span>Выгрузить CSV для проверок</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter categories */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none text-xs">
          {[
            { id: 'all', label: 'Все события' },
            { id: 'escalate', label: 'Эскалации' },
            { id: 'send_reminder', label: 'Напоминания клиентам' },
            { id: 'status_change', label: 'Смена статусов' },
            { id: 'document_upload', label: 'Загрузка документов' },
            { id: 'generate_year_calendar', label: 'Генерация календаря' },
            { id: 'import_batch', label: 'Импорт' },
          ].map((flt) => (
            <button
              key={flt.id}
              type="button"
              onClick={() => setAuditFilter(flt.id)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                auditFilter === flt.id
                  ? 'bg-[#5FA07A] text-white shadow-sm'
                  : 'bg-[#FAF8F5] border border-[#EAE3D6] text-[#8C8577] hover:text-[#2B2A25]'
              }`}
            >
              {flt.label}
            </button>
          ))}
        </div>

        {activityLogs.length === 0 ? (
          <p className="text-xs text-[#8C8577] text-center py-8">
            Журнал действий пока пуст. Все операции сотрудников будут автоматически протоколироваться здесь.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[450px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EAE3D6] bg-[#FAF8F5] text-[#8C8577] text-[11px]">
                  <th className="py-2.5 px-4 font-semibold">Дата и время</th>
                  <th className="py-2.5 px-4 font-semibold">Сотрудник</th>
                  <th className="py-2.5 px-4 font-semibold">Тип действия</th>
                  <th className="py-2.5 px-4 font-semibold">Компания</th>
                  <th className="py-2.5 px-4 font-semibold">Описание события</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE3D6]">
                {activityLogs
                  .filter((l) => auditFilter === 'all' || l.action_type === auditFilter)
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAF8F5] transition">
                      <td className="py-2.5 px-4 text-[#8C8577] font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('ru-RU')}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-[#2B2A25] whitespace-nowrap">
                        {log.user_name}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action_type === 'escalate'
                              ? 'bg-[#FCE6E3] text-[#DD6B60]'
                              : log.action_type === 'send_reminder'
                              ? 'bg-[#25D366]/10 text-[#128C7E]'
                              : 'bg-[#E7F3EB] text-[#5FA07A]'
                          }`}
                        >
                          {log.action_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-[#2B2A25] font-medium whitespace-nowrap">
                        {log.company_name || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-[#2B2A25] leading-relaxed">
                        {log.description}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
