import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  isToday 
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTasks } from '../lib/api';
import { Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { getUrgencyBadge } from '../lib/dateUtils';

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = user?.role === 'manager';

  const loadTasks = async () => {
    try {
      setLoading(true);
      const ownerId = isManager ? undefined : user?.id;
      const data = await getTasks({ ownerId });
      setTasks(data);
    } catch (err) {
      console.error('Error fetching calendar tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getTasksForDate = (date: Date): Task[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter((t) => t.due_date === dateStr);
  };

  const selectedDateTasks = getTasksForDate(selectedDate);
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  return (
    <div className="w-full min-h-screen bg-[#F4EFEA] px-8 py-7">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1916] tracking-tight">
            Календарь
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Наглядный обзор сроков сдачи документов и отчетности по датам месяца
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={goToToday}
            className="px-3.5 py-1.5 rounded-lg border border-[#D4CDBF] text-xs font-semibold text-[#1A1916] bg-white hover:bg-[#F9F7F3] transition shadow-2xs"
          >
            Сегодня
          </button>
          <div className="flex items-center bg-white border border-[#D4CDBF] rounded-lg p-0.5 shadow-2xs">
            <button
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-600 transition"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-[#1A1916] capitalize min-w-[120px] text-center">
              {format(currentMonth, 'LLLL yyyy', { locale: ru })}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-600 transition"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link
            to={`/tasks/new?due_date=${selectedDateStr}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] transition shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Задача на день</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Left Calendar (7 cols), Right Day Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Monthly Calendar View */}
        <div className="lg:col-span-2 bg-white border border-[#EAE5DD] rounded-2xl p-5 shadow-2xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center pb-3 border-b border-[#F2ECE3] text-xs font-semibold text-gray-400">
            <span>Пн</span>
            <span>Вт</span>
            <span>Ср</span>
            <span>Чт</span>
            <span>Пт</span>
            <span className="text-[#D9483B]">Сб</span>
            <span className="text-[#D9483B]">Вс</span>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 gap-1.5 pt-3">
            {days.map((day) => {
              const dayTasks = getTasksForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[85px] sm:min-h-[96px] p-2 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#1E4D3B] bg-[#E2EFE7]/40 ring-2 ring-[#1E4D3B]/20'
                      : isCurrentDay
                      ? 'border-[#C47F2A] bg-[#FFF0D6]/30'
                      : 'border-[#EAE5DD] bg-white hover:border-gray-400 hover:bg-[#FAF8F5]'
                  } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                >
                  {/* Top: Day Number & Count */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isCurrentDay
                          ? 'bg-[#1A1916] text-white'
                          : isSelected
                          ? 'text-[#1E4D3B] font-extrabold'
                          : 'text-[#1A1916]'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FAF8F5] border border-[#EAE5DD] text-gray-600">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task indicators */}
                  <div className="space-y-1 mt-1">
                    {dayTasks.slice(0, 2).map((task) => {
                      const badge = getUrgencyBadge(task);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-1 text-[10px] font-medium truncate px-1.5 py-0.5 rounded-md"
                          style={{
                            backgroundColor: badge.bgColor,
                            color: badge.textColor,
                          }}
                          title={`${task.doc_type} (${task.company?.name || ''})`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: badge.dotColor }}
                          />
                          <span className="truncate">{task.doc_type}</span>
                        </div>
                      );
                    })}

                    {dayTasks.length > 2 && (
                      <span className="text-[10px] text-gray-400 block font-medium pl-1">
                        + ещё {dayTasks.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Legend */}
          <div className="mt-5 pt-4 border-t border-[#F2ECE3] flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
            <span className="font-bold text-[#1A1916]">Индикаторы:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#D9483B]" />
              <span>Сегодня / Просрочено</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C47F2A]" />
              <span>На этой неделе</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
              <span>Позже</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1E4D3B]" />
              <span>Сдано</span>
            </div>
          </div>
        </div>

        {/* Selected Date Tasks Panel */}
        <div className="bg-white border border-[#EAE5DD] rounded-2xl p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#F2ECE3]">
            <div>
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                Задачи на выбранный день
              </span>
              <h2 className="text-base font-bold text-[#1A1916] capitalize mt-0.5">
                {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ru })}
              </h2>
            </div>
            <Link
              to={`/tasks/new?due_date=${selectedDateStr}`}
              className="w-7 h-7 rounded-lg bg-[#E2EFE7] text-[#1E4D3B] hover:bg-[#1E4D3B] hover:text-white transition flex items-center justify-center shadow-2xs"
              title="Добавить задачу на эту дату"
            >
              <Plus className="w-4 h-4" />
            </Link>
          </div>

          {selectedDateTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="font-bold text-[#1A1916] mb-1">На эту дату задач нет</p>
              <p className="mb-4 text-gray-500">Можно запланировать сдачу отчета или документа</p>
              <Link
                to={`/tasks/new?due_date=${selectedDateStr}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#1E4D3B] bg-[#E2EFE7] hover:bg-[#1E4D3B] hover:text-white transition shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Запланировать сдачу</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onTaskUpdated={(updated) => {
                    setTasks((prev) =>
                      prev.map((t) => (t.id === updated.id ? updated : t))
                    );
                  }}
                  onTaskDeleted={(id) => {
                    setTasks((prev) => prev.filter((t) => t.id !== id));
                  }}
                  showAccountant={isManager}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
