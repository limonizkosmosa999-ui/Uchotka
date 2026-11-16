import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  Plus,
  Settings,
  LogOut,
  Bell,
  X,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  getAllUsers,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  subscribeToNotifications,
  getCompanies,
  getTasks,
  subscribeToTasks,
  registerWithEmail
} from '../lib/api';
import { AppNotification, Company, Task, UserProfile, UserRole } from '../types';
import { getTaskUrgency } from '../lib/dateUtils';
import { AddEmployeeModal } from './AddEmployeeModal';

export const Navbar: React.FC = () => {
  const { user, logout, isConfigured, switchUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const bellButtonRef = useRef<HTMLButtonElement>(null);
  const notifDropdownRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isManager = user?.role === 'manager';

  // Load agency users, companies, and tasks
  const refreshData = async () => {
    try {
      const [u, c, t] = await Promise.all([
        getAllUsers(),
        getCompanies(),
        getTasks(),
      ]);
      setAllUsers(u);
      setCompanies(c);
      setTasks(t);
    } catch (err) {
      console.error('Navbar failed to load data:', err);
    }
  };

  useEffect(() => {
    refreshData();
    const unsub = subscribeToTasks(() => {
      refreshData();
    });
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const refreshNotifs = () => {
      getNotifications(user.id)
        .then((items) => {
          if (active) setNotifications(items);
        })
        .catch((err) => console.error('Failed to load notifications:', err));
    };

    refreshNotifs();
    const unsubNotifs = subscribeToNotifications(user.id, refreshNotifs);
    return () => {
      active = false;
      unsubNotifs();
    };
  }, [user?.id]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        notifDropdownRef.current &&
        !notifDropdownRef.current.contains(target) &&
        !bellButtonRef.current?.contains(target)
      ) {
        setShowNotifMenu(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(target) &&
        !userButtonRef.current?.contains(target)
      ) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Compute overdue count for badge on "Сводка"
  const overdueCount = tasks.filter((t) => {
    if (t.status === 'done' || t.status === 'submitted') return false;
    return getTaskUrgency(t) === 'overdue';
  }).length;

  // Filter accountants for manager sidebar
  const accountants = allUsers.filter((u) => u.role === 'accountant');

  // Compute task count per accountant
  const getAccountantActiveTaskCount = (accountantId: string) => {
    const accCompanies = companies.filter(
      (c) => c.owner_id === accountantId || c.curator_id === accountantId
    );
    const accCompanyIds = new Set(accCompanies.map((c) => c.id));
    return tasks.filter((task) => {
      if (task.status === 'done' || task.status === 'submitted') return false;
      if (task.assignments?.length) {
        return task.assignments.some(
          (a) => a.assignment_role === 'executor' && a.user_id === accountantId
        );
      }
      return accCompanyIds.has(task.company_id);
    }).length;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSwitchUser = async (targetUserId: string) => {
    try {
      await switchUser(targetUserId);
      setShowUserMenu(false);
      navigate(isManager ? '/manager' : '/dashboard');
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const handleAddEmployee = async (fullName: string, email: string, role: UserRole) => {
    await registerWithEmail(email, 'demo1234', fullName, role);
    await refreshData();
  };

  const currentPath = location.pathname;

  return (
    <>
      <aside className="app-sidebar w-[230px] min-w-[230px] h-screen sticky top-0 flex flex-col justify-between bg-white border-r border-[#EAE5DD] z-30 select-none">
        {/* Top: Logo & Main Navigation */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-3">
          {/* Brand Logo matching design */}
          <Link
            to={isManager ? '/manager' : '/dashboard'}
            className="flex items-center gap-2.5 px-2 mb-6 group"
          >
            <div className="w-6 h-6 rounded-[7px] bg-black text-white flex items-center justify-center font-bold shadow-xs">
              <Check className="w-4 h-4 stroke-[2.8]" />
            </div>
            <span className="text-[17px] font-extrabold text-[#1A1916] tracking-tight">
              Учётка
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {isManager && (
              <Link
                to="/manager"
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                  currentPath === '/manager'
                    ? 'bg-[#EAE6DF] text-[#1A1916] font-semibold'
                    : 'text-[#3B3A36] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
                }`}
              >
                <span>Сводка</span>
                {overdueCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#FCE8E6] text-[#D9483B]">
                    {overdueCount}
                  </span>
                )}
              </Link>
            )}

            <Link
              to="/dashboard"
              className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                currentPath === '/dashboard' && !location.search.includes('accountant')
                  ? 'bg-[#E2EFE7] text-[#1E4D3B] font-semibold'
                  : 'text-[#3B3A36] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
              }`}
            >
              <span>{isManager ? 'Все задачи агентства' : 'Мои задачи'}</span>
            </Link>

            <Link
              to="/calendar"
              className={`flex items-center px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                currentPath === '/calendar'
                  ? 'bg-[#E2EFE7] text-[#1E4D3B] font-semibold'
                  : 'text-[#3B3A36] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
              }`}
            >
              <span>Календарь</span>
            </Link>

            <Link
              to="/tax-calendar"
              className={`flex items-center px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                currentPath === '/tax-calendar'
                  ? 'bg-[#E2EFE7] text-[#1E4D3B] font-semibold'
                  : 'text-[#3B3A36] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
              }`}
            >
              <span>Налоги КР</span>
            </Link>

            <Link
              to="/activity"
              className={`flex items-center px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                currentPath === '/activity'
                  ? 'bg-[#E2EFE7] text-[#1E4D3B] font-semibold'
                  : 'text-[#3B3A36] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
              }`}
            >
              <span>Журнал действий</span>
            </Link>

            <Link
              to="/import"
              className={`flex items-center px-3 py-2 rounded-xl text-[13px] font-medium transition ${
                currentPath === '/import'
                  ? 'bg-[#E2EFE7] text-[#1E4D3B] font-semibold'
                  : 'text-[#3B3A36] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
              }`}
            >
              <span>Импорт</span>
            </Link>
          </nav>

          {/* Section: СОТРУДНИКИ (Руководитель) */}
          {isManager ? (
            <div className="mt-7">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[11px] font-bold text-[#8C8577] tracking-wider uppercase">
                  СОТРУДНИКИ
                </span>
                <button
                  type="button"
                  onClick={() => setShowAddEmployeeModal(true)}
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-black hover:bg-gray-100 transition"
                  title="Добавить сотрудника"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-0.5">
                {accountants.map((acc) => {
                  const activeTasks = getAccountantActiveTaskCount(acc.id);
                  const isFiltered = location.search.includes(`accountant=${acc.id}`);

                  return (
                    <Link
                      key={acc.id}
                      to={`/dashboard?accountant=${acc.id}`}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition ${
                        isFiltered
                          ? 'bg-[#EAE6DF] font-semibold text-[#1A1916]'
                          : 'text-[#4A463F] hover:bg-[#F6F3EE] hover:text-[#1A1916]'
                      }`}
                      title={acc.email}
                    >
                      <span className="truncate">{acc.full_name}</span>
                      <span className="text-gray-400 text-[11px] ml-1 font-medium">
                        {activeTasks}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Section: КЛИЕНТЫ (Бухгалтер) */
            <div className="mt-7">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-[11px] font-bold text-[#8C8577] tracking-wider uppercase">
                  КЛИЕНТЫ
                </span>
                <Link
                  to="/companies/new"
                  className="w-5 h-5 flex items-center justify-center rounded text-gray-500 hover:text-black hover:bg-gray-100 transition"
                  title="Добавить компанию"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="space-y-0.5 max-h-56 overflow-y-auto">
                {companies.map((comp) => (
                  <Link
                    key={comp.id}
                    to={`/companies/${comp.id}`}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-[#4A463F] hover:bg-[#F6F3EE] hover:text-[#1A1916] transition"
                    title={comp.name}
                  >
                    <span className="truncate">{comp.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Profile Footer matching design */}
        <div className="p-3 border-t border-[#EAE5DD] relative">
          <div className="flex items-center justify-between">
            <button
              ref={userButtonRef}
              type="button"
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifMenu(false);
              }}
              className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-[#F6F3EE] transition w-full text-left"
            >
              {/* User Avatar Circle (Peach/sand background) */}
              <div className="w-8 h-8 rounded-full bg-[#FCE5D2] text-[#B85E1A] font-bold text-xs flex items-center justify-center flex-shrink-0">
                {user?.full_name?.charAt(0) || 'С'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#1A1916] truncate">
                  {user?.full_name || 'Сайкал'}
                </div>
                <div className="text-[11px] text-[#8C8577] truncate">
                  {isManager ? 'Руководитель' : 'Бухгалтер'}
                </div>
              </div>
            </button>

            {/* Notification Bell Icon */}
            <div className="relative">
              <button
                ref={bellButtonRef}
                type="button"
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  setShowUserMenu(false);
                }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-[#F6F3EE] transition relative"
                title="Уведомления"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D9483B]" />
                )}
              </button>
            </div>
          </div>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div
              ref={userMenuRef}
              className="absolute bottom-full left-3 mb-2 w-64 bg-white border border-[#EAE5DD] rounded-2xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
            >
              <div className="px-3 py-2.5 border-b border-[#EAE5DD] mb-1">
                <p className="text-xs font-bold text-[#1A1916]">{user?.full_name}</p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#E2EFE7] text-[#1E4D3B]">
                  {isManager ? '👔 Руководитель' : '🧾 Бухгалтер'}
                </span>
              </div>

              {/* Demo user switch */}
              {!isConfigured && allUsers.length > 0 && (
                <div className="px-3 py-2 border-b border-[#EAE5DD]">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                    Войти как:
                  </label>
                  <div className="space-y-1">
                    {allUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSwitchUser(u.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                          user?.id === u.id
                            ? 'bg-[#E2EFE7] text-[#1E4D3B] font-semibold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate">{u.full_name}</span>
                        <span className="text-[10px] text-gray-400 ml-1">
                          {u.role === 'manager' ? 'Руководитель' : 'Бухгалтер'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Link
                to="/settings"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-[#F6F3EE] rounded-lg transition"
              >
                <Settings className="w-3.5 h-3.5 text-gray-400" />
                <span>Настройки профиля</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#D9483B] hover:bg-[#FCE8E6] rounded-lg transition mt-0.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Выйти из аккаунта</span>
              </button>
            </div>
          )}

          {/* Notifications Dropdown */}
          {showNotifMenu && (
            <div
              ref={notifDropdownRef}
              className="absolute left-full bottom-3 ml-3 w-[390px] sm:w-[420px] bg-white border border-[#EAE5DD] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-left-2 duration-150"
            >
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#EAE5DD] bg-[#FAF8F5]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#1A1916]">Уведомления</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D9483B] text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return;
                      setMarkingAllRead(true);
                      await markAllNotificationsRead(user.id);
                      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                      setMarkingAllRead(false);
                    }}
                    className="text-[11px] text-[#1E4D3B] font-medium hover:underline"
                  >
                    {markingAllRead ? 'Отмечаем...' : 'Прочитать все'}
                  </button>
                )}
              </div>
              <div className="max-h-[500px] overflow-y-auto divide-y divide-[#EAE5DD]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-medium">Нет новых уведомлений</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) {
                          await markNotificationRead(n.id);
                          setNotifications((prev) =>
                            prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
                          );
                        }
                      }}
                      className={`p-3.5 text-xs cursor-pointer transition hover:bg-[#F6F3EE] ${
                        n.is_read ? 'bg-white text-gray-600' : 'bg-[#FAF8F5] text-gray-900 font-medium'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="leading-snug flex-1">{n.message}</p>
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full bg-[#1E4D3B] flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1.5 block">
                        {new Date(n.created_at).toLocaleString('ru-RU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modal for adding employee */}
      <AddEmployeeModal
        isOpen={showAddEmployeeModal}
        onClose={() => setShowAddEmployeeModal(false)}
        onAddEmployee={handleAddEmployee}
      />
    </>
  );
};
