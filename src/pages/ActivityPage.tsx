import React, { useState, useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import { 
  getAllUsers, 
  getCompanies, 
  subscribeToActivityLogs 
} from '../lib/api';
import { 
  getActivityLogs, 
  exportActivityLogsToCsv, 
  downloadCsvFile,
  ACTIVITY_ACTION_LABELS 
} from '../lib/activityLog';
import { UserProfile, Company, ActivityLog, ActivityActionType } from '../types';

export const ActivityPage: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [period, setPeriod] = useState<'30' | '7' | 'custom'>('30');

  const loadData = async () => {
    try {
      setLoading(true);
      const [l, u, c] = await Promise.all([
        getActivityLogs({ limit: 200 }),
        getAllUsers(),
        getCompanies(),
      ]);
      setLogs(l);
      setUsers(u);
      setCompanies(c);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribeToActivityLogs(() => {
      loadData();
    });
    return () => unsub();
  }, []);

  // Filter tag definitions matching Image 2
  const filterTabs = [
    { id: 'all', label: 'Все события' },
    { id: 'escalate', label: 'Эскалации' },
    { id: 'send_reminder', label: 'Напоминания клиентам' },
    { id: 'status_change', label: 'Смена статусов' },
    { id: 'create_task', label: 'Создание задач' },
    { id: 'assign_task', label: 'Назначения' },
    { id: 'update_task', label: 'Изменения' },
    { id: 'delete_task', label: 'Удаления' },
  ];

  // Filtered logs computation
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by category tab
      if (activeTab === 'escalate') {
        if (log.action_type !== 'escalate' && log.action_type !== 'resolve_escalation') return false;
      } else if (activeTab === 'send_reminder') {
        if (log.action_type !== 'send_reminder') return false;
      } else if (activeTab === 'status_change') {
        if (log.action_type !== 'status_change') return false;
      } else if (activeTab === 'create_task') {
        if (log.action_type !== 'create_task' && log.action_type !== 'company_create') return false;
      } else if (activeTab === 'assign_task') {
        if (log.action_type !== 'assign_task') return false;
      } else if (activeTab === 'update_task') {
        if (log.action_type !== 'update_task' && log.action_type !== 'company_update') return false;
      } else if (activeTab === 'delete_task') {
        if (log.action_type !== 'delete_task' && log.action_type !== 'company_delete') return false;
      }

      // Filter by User
      if (selectedUser !== 'all') {
        if (log.user_id !== selectedUser && log.user_name !== selectedUser) {
          const userObj = users.find((u) => u.id === selectedUser);
          if (!userObj || log.user_name !== userObj.full_name) return false;
        }
      }

      // Filter by Company
      if (selectedCompany !== 'all') {
        if (log.company_id !== selectedCompany) {
          const compObj = companies.find((c) => c.id === selectedCompany);
          if (!compObj || (log.company_name && !compObj.name.includes(log.company_name))) {
            return false;
          }
        }
      }

      // Filter by Period
      if (period === '7') {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (new Date(log.created_at).getTime() < sevenDaysAgo) return false;
      } else if (period === '30') {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (new Date(log.created_at).getTime() < thirtyDaysAgo) return false;
      }

      return true;
    });
  }, [logs, activeTab, selectedUser, selectedCompany, period, users, companies]);

  const handleResetFilters = () => {
    setActiveTab('all');
    setSelectedUser('all');
    setSelectedCompany('all');
    setPeriod('30');
  };

  const handleExportCsv = () => {
    const csv = exportActivityLogsToCsv(filteredLogs);
    downloadCsvFile(csv, `zhurnal_deystviy_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const formatTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
  };

  const getActionBadge = (actionType: ActivityActionType) => {
    switch (actionType) {
      case 'status_change':
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#E3F5EC] text-[#1E7E51] whitespace-nowrap">
            Смена статуса
          </span>
        );
      case 'create_task':
      case 'company_create':
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#FEF4E6] text-[#C47F2A] whitespace-nowrap">
            Создание задачи
          </span>
        );
      case 'assign_task':
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#EAF2F5] text-[#34828E] whitespace-nowrap">
            Назначение
          </span>
        );
      case 'escalate':
      case 'resolve_escalation':
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#FCE8E6] text-[#D9483B] whitespace-nowrap">
            Эскалация
          </span>
        );
      case 'send_reminder':
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#E3F5EC] text-[#1E7E51] whitespace-nowrap">
            Напоминание
          </span>
        );
      case 'delete_task':
      case 'company_delete':
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#FCE8E6] text-[#D9483B] whitespace-nowrap">
            Удаление
          </span>
        );
      default:
        return (
          <span className="inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#F3EFF8] text-[#7E57C2] whitespace-nowrap">
            {ACTIVITY_ACTION_LABELS[actionType] || 'Действие'}
          </span>
        );
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F4EFEA] px-8 py-7">
      {/* Header Area matching Image 2 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 font-medium">
            Кто, что и когда сделал: для проверок и подтверждения клиентам
          </p>
          <h1 className="text-2xl font-extrabold text-[#1A1916] tracking-tight mt-0.5">
            Журнал действий команды
          </h1>
        </div>

        <div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4CDBF] bg-white text-xs font-semibold text-[#1A1916] hover:bg-[#F9F7F3] transition shadow-2xs"
          >
            <span>Выгрузить CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Category Pills Row matching Image 2 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {filterTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition shadow-2xs ${
                isActive
                  ? 'bg-black text-white'
                  : 'bg-white border border-[#E2DBD0] text-gray-600 hover:border-gray-400 hover:text-black'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2-Column Layout: Table Card on left, Filters on right matching Image 2 */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Events Table Card */}
        <div className="flex-1 w-full bg-white rounded-2xl border border-[#EAE5DD] shadow-2xs overflow-hidden min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider border-b border-[#F2ECE3]">
                  <th className="py-3.5 px-5">ВРЕМЯ</th>
                  <th className="py-3.5 px-4">КТО</th>
                  <th className="py-3.5 px-4">ДЕЙСТВИЕ</th>
                  <th className="py-3.5 px-4">КЛИЕНТ</th>
                  <th className="py-3.5 px-5">ОПИСАНИЕ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F6F2EC]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-xs text-gray-400">
                      Событий по выбранным фильтрам не найдено.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="text-xs hover:bg-[#FAF8F5] transition">
                      {/* Время */}
                      <td className="py-3.5 px-5 text-gray-400 font-mono text-[11px] whitespace-nowrap">
                        {formatTimestamp(log.created_at)}
                      </td>

                      {/* Кто */}
                      <td className="py-3.5 px-4 font-bold text-[#1A1916] whitespace-nowrap">
                        {log.user_name || 'Система'}
                      </td>

                      {/* Действие */}
                      <td className="py-3.5 px-4">
                        {getActionBadge(log.action_type)}
                      </td>

                      {/* Клиент */}
                      <td className="py-3.5 px-4 font-medium text-gray-700 whitespace-nowrap">
                        {log.company_name || '—'}
                      </td>

                      {/* Описание */}
                      <td className="py-3.5 px-5 text-[#1A1916] leading-relaxed">
                        {log.description}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Filters Panel matching Image 2 */}
        <div className="w-full lg:w-[310px] flex-shrink-0 space-y-4">
          <div className="text-[11px] font-bold text-[#8C8577] tracking-wider uppercase mb-1">
            ФИЛЬТРЫ
          </div>

          {/* Filter 1: Сотрудник */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1916] mb-1.5">
              Сотрудник
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full bg-white border border-[#D4CDBF] rounded-lg px-3 py-2 text-xs text-[#1A1916] focus:outline-none focus:border-[#1E4D3B] shadow-2xs cursor-pointer"
            >
              <option value="all">Все сотрудники</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Компания */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1916] mb-1.5">
              Компания
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full bg-white border border-[#D4CDBF] rounded-lg px-3 py-2 text-xs text-[#1A1916] focus:outline-none focus:border-[#1E4D3B] shadow-2xs cursor-pointer"
            >
              <option value="all">Все компании</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Период */}
          <div>
            <label className="block text-xs font-semibold text-[#1A1916] mb-1.5">
              Период
            </label>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPeriod('30')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === '30'
                    ? 'bg-black text-white shadow-2xs'
                    : 'bg-white border border-[#D4CDBF] text-gray-700 hover:bg-gray-50'
                }`}
              >
                30 дней
              </button>
              <button
                type="button"
                onClick={() => setPeriod('7')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === '7'
                    ? 'bg-black text-white shadow-2xs'
                    : 'bg-white border border-[#D4CDBF] text-gray-700 hover:bg-gray-50'
                }`}
              >
                Неделя
              </button>
              <button
                type="button"
                onClick={() => setPeriod('custom')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  period === 'custom'
                    ? 'bg-black text-white shadow-2xs'
                    : 'bg-white border border-[#D4CDBF] text-gray-700 hover:bg-gray-50'
                }`}
              >
                Свои даты
              </button>
            </div>
          </div>

          {/* Stat Card matching Image 2 (beige card with count) */}
          <div className="bg-[#F6F1EA] rounded-xl p-4.5 border border-[#EAE3D6] space-y-1">
            <div className="text-3xl font-extrabold text-[#1A1916]">
              {filteredLogs.length}
            </div>
            <p className="text-xs text-gray-600 leading-relaxed font-normal">
              событий по выбранным фильтрам. Журнал нельзя изменить или удалить.
            </p>
          </div>

          {/* Bottom Actions */}
          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="w-full bg-[#1E4D3B] hover:bg-[#163B2D] text-white py-3 rounded-lg text-xs font-bold transition shadow-2xs flex items-center justify-center gap-2"
            >
              <span>Выгрузить CSV для проверки</span>
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="w-full text-center text-xs text-gray-500 hover:text-black py-1 transition cursor-pointer"
            >
              Сбросить фильтры
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
