import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Calendar as CalendarIcon,
  CheckSquare,
  PlusCircle,
  Bell,
  Settings,
  LogOut,
  Users,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllUsers, getNotifications, markNotificationRead } from '../lib/api';
import { AppNotification, UserProfile } from '../types';
import logo from '../assets/hero.png';

export const Navbar: React.FC = () => {
  const { user, logout, isConfigured, switchUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [demoUsers, setDemoUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    if (user) {
      getNotifications(user.id).then(setNotifications);
    }
  }, [user]);

  useEffect(() => {
    if (!isConfigured) {
      getAllUsers()
        .then(setDemoUsers)
        .catch((error) => console.error('Failed to load demo users:', error));
    }
  }, [isConfigured]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      await switchUser(userId);
      setShowUserMenu(false);
    } catch (error) {
      console.error('Failed to switch demo user:', error);
    }
  };

  const isManager = user?.role === 'manager';

  const navLinks = [
    ...(isManager
      ? [
          {
            to: '/manager',
            label: 'Сводка руководителя',
            icon: Users,
            active: location.pathname === '/manager',
          },
        ]
      : []),
    {
      to: '/dashboard',
      label: isManager ? 'Все задачи агентства' : 'Мои задачи',
      icon: CheckSquare,
      active: location.pathname === '/dashboard',
    },
    {
      to: '/calendar',
      label: 'Календарь',
      icon: CalendarIcon,
      active: location.pathname === '/calendar',
    },
    {
      to: '/tax-calendar',
      label: 'Налоги КР',
      icon: BookOpen,
      active: location.pathname === '/tax-calendar',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-[#EAE3D6] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Agency Name */}
          <div className="flex items-center gap-8">
            <Link to={isManager ? '/manager' : '/dashboard'} className="flex items-center gap-2.5 group">
              <img
                src={logo}
                alt="Логотип Учётки"
                className="w-10 h-10 rounded-[10px] object-cover transition group-hover:scale-105"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg text-[#2B2A25] tracking-tight">УЧЁТКА</span>
                </div>
              </div>
            </Link>

            {/* Navigation tabs */}
            <nav className="hidden md:flex items-center gap-1.5">
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm font-medium transition ${
                      item.active
                        ? 'bg-[#E7F3EB] text-[#5FA07A]'
                        : 'text-[#2B2A25] hover:bg-[#FAF8F5] hover:text-[#5FA07A]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Action CTAs & User Controls */}
          <div className="flex items-center gap-3">
            {/* Quick Create Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <Link
                to="/companies/new"
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium border border-[#EAE3D6] text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#8C8577]" />
                <span>+ Компания</span>
              </Link>
              <Link
                to="/import"
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium border border-[#EAE3D6] text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#8C8577]" />
                <span>Импорт</span>
              </Link>
              <Link
                to="/tasks/new"
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-medium text-white bg-[#5FA07A] hover:bg-[#528E6B] transition shadow-none"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Задача</span>
              </Link>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifMenu(!showNotifMenu)}
                className="relative p-2 rounded-[10px] text-[#8C8577] hover:text-[#2B2A25] hover:bg-[#FAF8F5] transition"
                title="Уведомления"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#DD6B60] text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification drop-down menu */}
              {showNotifMenu && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-[#EAE3D6] rounded-[10px] shadow-lg p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EAE3D6]">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#5FA07A]" />
                      <span className="text-xs font-semibold text-[#2B2A25]">Уведомления</span>
                    </div>
                    {unreadCount > 0 && (
                      <span className="text-[11px] text-[#8C8577]">
                        {unreadCount} новых
                      </span>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#8C8577] text-center py-4">Нет новых уведомлений</p>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-[8px] text-xs transition ${
                            n.is_read ? 'bg-[#FAF8F5] text-[#8C8577]' : 'bg-[#FBEBD9] text-[#2B2A25]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="leading-snug">{n.message}</p>
                            {!n.is_read && (
                              <button
                                onClick={() => handleMarkAsRead(n.id)}
                                className="text-[10px] text-[#DB8A3C] hover:underline flex-shrink-0"
                                title="Отметить прочитанным"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-[#8C8577] mt-1 block">
                            {new Date(n.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 pl-2.5 rounded-[10px] border border-[#EAE3D6] hover:bg-[#FAF8F5] transition"
              >
                <div className="text-left hidden sm:block">
                  <div className="text-sm font-semibold text-[#2B2A25] leading-tight">
                    {user?.full_name || 'Сотрудник'}
                  </div>
                  <div className="text-xs text-[#8C8577]">
                    {isManager ? 'Руководитель' : 'Бухгалтер'}
                  </div>
                </div>
                <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center font-bold text-xs ${
                  isManager ? 'bg-[#FBEBD9] text-[#DB8A3C]' : 'bg-[#E7F3EB] text-[#5FA07A]'
                }`}>
                  {user?.full_name?.charAt(0) || 'Б'}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#8C8577]" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-[#EAE3D6] rounded-[10px] shadow-lg p-2 z-50">
                <div className="px-4 py-3 border-b border-[#EAE3D6] mb-1">
                    <p className="text-sm font-bold text-[#2B2A25]">{user?.full_name}</p>
                    <p className="text-xs text-[#8C8577] truncate mt-0.5">{user?.email}</p>
                    <span className={`inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                      isManager ? 'bg-[#FBEBD9] text-[#DB8A3C]' : 'bg-[#E7F3EB] text-[#5FA07A]'
                    }`}>
                      {isManager ? '👔 Руководитель агентства' : '🧾 Бухгалтер'}
                    </span>
                  </div>

                  {!isConfigured && demoUsers.length > 0 && (
                    <div className="px-4 py-3 border-b border-[#EAE3D6]">
                      <label htmlFor="demo-user-switcher" className="block text-xs font-semibold text-[#6B6558] mb-1.5">
                        Смотреть как
                      </label>
                      <select
                        id="demo-user-switcher"
                        value={user?.id || ''}
                        onChange={(event) => handleSwitchUser(event.target.value)}
                        className="w-full px-2.5 py-2 text-xs border border-[#EAE3D6] rounded-[8px] bg-white text-[#2B2A25]"
                      >
                        {demoUsers.map((demoUser) => (
                          <option key={demoUser.id} value={demoUser.id}>
                            {demoUser.role === 'manager' ? 'Руководитель' : 'Бухгалтер'} — {demoUser.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                <Link
                    to="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#2B2A25] hover:bg-[#FAF8F5] rounded-xl transition"
                  >
                    <Settings className="w-4 h-4 text-[#8C8577]" />
                    <span>Настройки профиля</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#DD6B60] hover:bg-[#FCE6E3] rounded-xl transition mt-1"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Выйти из аккаунта</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
