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
  PlusCircle, 
  Building, 
  CheckCircle2, 
  Clock, 
  Hourglass,
  ArrowRight,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getTasks } from '../lib/api';
import { Task } from '../types';
import { TaskCard } from '../components/TaskCard';
import { getUrgencyBadge, formatDateRu } from '../lib/dateUtils';

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
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Starts Monday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get tasks for a given date
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#2B2A25] tracking-tight">
            Календарь дедлайнов сдачи
          </h1>
          <p className="text-xs text-[#8C8577] mt-1">
            Наглядный обзор сроков сдачи документов и отчетности по датам месяца
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-[8px] border border-[#EAE3D6] text-xs font-semibold text-[#2B2A25] bg-white hover:bg-[#FAF8F5] transition"
          >
            Сегодня
          </button>
          <div className="flex items-center bg-white border border-[#EAE3D6] rounded-[8px] p-0.5">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-[6px] hover:bg-[#FAF8F5] text-[#8C8577] hover:text-[#2B2A25] transition"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-bold text-[#2B2A25] capitalize min-w-[120px] text-center">
              {format(currentMonth, 'LLLL yyyy', { locale: ru })}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-[6px] hover:bg-[#FAF8F5] text-[#8C8577] hover:text-[#2B2A25] transition"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <Link
            to={`/tasks/new?due_date=${selectedDateStr}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] text-xs font-medium text-white bg-[#5FA07A] hover:bg-[#528E6B] transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Задача на день</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Left Calendar (7 cols), Right Day Details Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Monthly Calendar View (2 cols on large screens) */}
        <div className="lg:col-span-2 bg-white border border-[#EAE3D6] rounded-[10px] p-4 sm:p-5">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center pb-3 border-b border-[#EAE3D6] text-xs font-semibold text-[#8C8577]">
            <span>Пн</span>
            <span>Вт</span>
            <span>Ср</span>
            <span>Чт</span>
            <span>Пт</span>
            <span className="text-[#DD6B60]">Сб</span>
            <span className="text-[#DD6B60]">Вс</span>
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
                  className={`min-h-[85px] sm:min-h-[100px] p-2 rounded-[8px] border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#5FA07A] bg-[#E7F3EB]/40 ring-2 ring-[#5FA07A]/20'
                      : isCurrentDay
                      ? 'border-[#C7A96E] bg-[#FAF8F5]'
                      : 'border-[#EAE3D6]/70 bg-white hover:border-[#C7A96E]/80 hover:bg-[#FAF8F5]/50'
                  } ${!isCurrentMonth ? 'opacity-35' : ''}`}
                >
                  {/* Top: Day Number & Today indicator */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isCurrentDay
                          ? 'bg-[#2B2A25] text-white'
                          : isSelected
                          ? 'text-[#5FA07A] font-extrabold'
                          : 'text-[#2B2A25]'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-[4px] bg-[#FAF8F5] border border-[#EAE3D6] text-[#8C8577]">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Bottom: Dots / Indicators for tasks */}
                  <div className="space-y-1 mt-1">
                    {dayTasks.slice(0, 3).map((task) => {
                      const badge = getUrgencyBadge(task);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-1 text-[10px] truncate px-1 py-0.5 rounded-[4px]"
                          style={{
                            backgroundColor: badge.bgColor,
                            color: badge.textColor,
                          }}
                          title={`${task.doc_type} (${task.company?.name})`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: badge.dotColor }}
                          />
                          <span className="truncate">{task.doc_type}</span>
                        </div>
                      );
                    })}

                    {dayTasks.length > 3 && (
                      <span className="text-[10px] text-[#8C8577] block font-medium pl-1">
                        + ещё {dayTasks.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Legend */}
          <div className="mt-5 pt-4 border-t border-[#EAE3D6] flex flex-wrap items-center gap-4 text-xs text-[#8C8577]">
            <span className="font-semibold text-[#2B2A25]">Цветовые индикаторы:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DD6B60]" />
              <span>Сегодня / Просрочено</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DB8A3C]" />
              <span>На этой неделе</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C7A96E]" />
              <span>Позже</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#5FA07A]" />
              <span>Сдано / Ожидает</span>
            </div>
          </div>
        </div>

        {/* Selected Date Tasks Panel (1 col) */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-5">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#EAE3D6]">
            <div>
              <span className="text-xs font-semibold text-[#8C8577] uppercase tracking-wider block">
                Задачи на выбранный день
              </span>
              <h2 className="text-base font-bold text-[#2B2A25] capitalize">
                {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ru })}
              </h2>
            </div>
            <Link
              to={`/tasks/new?due_date=${selectedDateStr}`}
              className="p-1.5 rounded-[8px] bg-[#E7F3EB] text-[#5FA07A] hover:bg-[#5FA07A] hover:text-white transition"
              title="Добавить задачу на эту дату"
            >
              <PlusCircle className="w-4 h-4" />
            </Link>
          </div>

          {/* Task list for selected date */}
          {selectedDateTasks.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#8C8577]">
              <CalendarIcon className="w-8 h-8 text-[#C7A96E] mx-auto mb-2 opacity-50" />
              <p className="font-medium text-[#2B2A25] mb-1">На эту дату задач нет</p>
              <p className="mb-4">Можно назначить сдачу отчета или документа</p>
              <Link
                to={`/tasks/new?due_date=${selectedDateStr}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-xs font-semibold text-[#5FA07A] bg-[#E7F3EB] hover:bg-[#5FA07A] hover:text-white transition"
              >
                <PlusCircle className="w-3.5 h-3.5" />
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
