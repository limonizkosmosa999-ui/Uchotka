import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  CheckSquare,
  Calendar as CalendarIcon,
  BookOpen,
  Plus,
  Users,
  Settings,
  X,
  PlusCircle,
  FileSpreadsheet,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  if (!user) return null;

  const isManager = user?.role === 'manager';

  const navItems = [
    {
      to: '/dashboard',
      label: 'Задачи',
      icon: CheckSquare,
      active: location.pathname === '/dashboard',
    },
    {
      to: '/calendar',
      label: 'Календарь',
      icon: CalendarIcon,
      active: location.pathname === '/calendar',
    },
    // Center Quick Action Button handled separately
    {
      to: '/tax-calendar',
      label: 'Налоги КР',
      icon: BookOpen,
      active: location.pathname === '/tax-calendar',
    },
    {
      to: isManager ? '/manager' : '/settings',
      label: isManager ? 'Сводка' : 'Профиль',
      icon: isManager ? Users : Settings,
      active: isManager ? location.pathname === '/manager' : location.pathname === '/settings',
    },
  ];

  return (
    <>
      {/* Quick Actions Bottom Sheet Overlay */}
      {showQuickMenu && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-white rounded-t-2xl p-5 shadow-2xl border-t border-[#EAE3D6] space-y-3 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#EAE3D6]">
              <span className="text-sm font-bold text-[#2B2A25]">Быстрые действия</span>
              <button
                onClick={() => setShowQuickMenu(false)}
                className="p-1 rounded-full text-[#8C8577] hover:bg-[#FAF8F5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Link
                to="/tasks/new"
                onClick={() => setShowQuickMenu(false)}
                className="flex items-center gap-2.5 p-3 rounded-[12px] bg-[#E7F3EB] text-[#5FA07A] font-medium text-xs hover:bg-[#d9ede0] transition"
              >
                <PlusCircle className="w-4 h-4 flex-shrink-0" />
                <span>Новая задача</span>
              </Link>

              <Link
                to="/companies/new"
                onClick={() => setShowQuickMenu(false)}
                className="flex items-center gap-2.5 p-3 rounded-[12px] bg-[#FAF8F5] text-[#2B2A25] font-medium text-xs border border-[#EAE3D6] hover:bg-[#F3EFEA] transition"
              >
                <Plus className="w-4 h-4 flex-shrink-0 text-[#8C8577]" />
                <span>Новая компания</span>
              </Link>

              <Link
                to="/tax-calendar?tab=generator"
                onClick={() => setShowQuickMenu(false)}
                className="flex items-center gap-2.5 p-3 rounded-[12px] bg-[#FBEBD9] text-[#DB8A3C] font-medium text-xs hover:bg-[#f6e1c7] transition"
              >
                <CalendarDays className="w-4 h-4 flex-shrink-0" />
                <span>Задачи на год</span>
              </Link>

              <Link
                to="/import"
                onClick={() => setShowQuickMenu(false)}
                className="flex items-center gap-2.5 p-3 rounded-[12px] bg-[#FAF8F5] text-[#2B2A25] font-medium text-xs border border-[#EAE3D6] hover:bg-[#F3EFEA] transition"
              >
                <FileSpreadsheet className="w-4 h-4 flex-shrink-0 text-[#5FA07A]" />
                <span>Импорт Excel</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-[#EAE3D6] shadow-[0_-2px_10px_rgba(0,0,0,0.03)] px-3 py-1.5 safe-bottom">
        <div className="flex items-center justify-around">
          {/* Left item 1: Dashboard */}
          <Link
            to={navItems[0].to}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
              navItems[0].active ? 'text-[#5FA07A]' : 'text-[#8C8577]'
            }`}
          >
            <CheckSquare className="w-5 h-5 mb-0.5" />
            <span>{navItems[0].label}</span>
          </Link>

          {/* Left item 2: Calendar */}
          <Link
            to={navItems[1].to}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
              navItems[1].active ? 'text-[#5FA07A]' : 'text-[#8C8577]'
            }`}
          >
            <CalendarIcon className="w-5 h-5 mb-0.5" />
            <span>{navItems[1].label}</span>
          </Link>

          {/* Center: Action button */}
          <button
            type="button"
            onClick={() => setShowQuickMenu(true)}
            className="flex items-center justify-center -mt-4 w-12 h-12 rounded-full bg-[#5FA07A] text-white shadow-lg shadow-[#5FA07A]/30 active:scale-95 transition"
            aria-label="Создать"
          >
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </button>

          {/* Right item 1: Tax KR */}
          <Link
            to={navItems[2].to}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
              navItems[2].active ? 'text-[#5FA07A]' : 'text-[#8C8577]'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span>{navItems[2].label}</span>
          </Link>

          {/* Right item 2: Profile / Manager */}
          <Link
            to={navItems[3].to}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-medium transition ${
              navItems[3].active ? 'text-[#5FA07A]' : 'text-[#8C8577]'
            }`}
          >
            {isManager ? <Users className="w-5 h-5 mb-0.5" /> : <Settings className="w-5 h-5 mb-0.5" />}
            <span>{navItems[3].label}</span>
          </Link>
        </div>
      </nav>
    </>
  );
};
