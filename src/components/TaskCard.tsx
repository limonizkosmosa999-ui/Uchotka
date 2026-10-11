import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Hourglass, 
  CheckCircle2, 
  Building, 
  MoreVertical, 
  AlertCircle, 
  Check, 
  Trash2, 
  FileText,
  User,
  ArrowRight,
  X,
} from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { formatDateRu, getUrgencyBadge, getDaysLeftText } from '../lib/dateUtils';
import { updateTask, deleteTask } from '../lib/api';

interface TaskCardProps {
  task: Task;
  onTaskUpdated?: (updated: Task) => void;
  onTaskDeleted?: (id: string) => void;
  showAccountant?: boolean;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onTaskUpdated,
  onTaskDeleted,
  showAccountant = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditingWait, setIsEditingWait] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [waitDate, setWaitDate] = useState(task.wait_until || '');

  const badge = getUrgencyBadge(task);
  const daysLeft = getDaysLeftText(task.due_date);
  const statusLabel: Record<TaskStatus, string> = {
    in_progress: 'В работе',
    submitted: 'Отправлено',
    waiting: 'Ожидает ответа',
    done: 'Завершено',
  };

  useEffect(() => {
    if (!showDetails) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDetails(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showDetails]);

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setLoading(true);
    try {
      const updated = await updateTask(task.id, {
        status: newStatus,
        wait_until: newStatus === 'waiting' ? (task.wait_until || new Date().toISOString().split('T')[0]) : task.wait_until,
      });
      onTaskUpdated?.(updated);
      setShowMenu(false);
    } catch (err) {
      console.error('Failed to update task:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWaitDate = async () => {
    if (!waitDate) return;
    setLoading(true);
    try {
      const updated = await updateTask(task.id, {
        status: 'waiting',
        wait_until: waitDate,
      });
      onTaskUpdated?.(updated);
      setIsEditingWait(false);
    } catch (err) {
      console.error('Failed to update wait date:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Удалить задачу по документу "${task.doc_type}"?`)) {
      setLoading(true);
      try {
        await deleteTask(task.id);
        onTaskDeleted?.(task.id);
      } catch (err) {
        console.error('Failed to delete task:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
    <div
      className={`relative bg-white border border-[#EAE3D6] rounded-[10px] p-4 transition hover:border-[#C7A96E] ${
        loading ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      {/* Top Header: Badge & Status Menu */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium"
          style={{
            backgroundColor: badge.bgColor,
            color: badge.textColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: badge.dotColor }}
          />
          <span>{badge.label}</span>
          {task.status !== 'done' && task.status !== 'submitted' && (
            <span className="opacity-75 text-[11px] ml-1">({daysLeft})</span>
          )}
        </div>

        {/* Action dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 rounded-[6px] text-[#8C8577] hover:text-[#2B2A25] hover:bg-[#FAF8F5] transition"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white border border-[#EAE3D6] rounded-[10px] shadow-lg p-1.5 z-30 text-xs">
              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-[#8C8577]">
                Сменить статус:
              </div>
              <button
                type="button"
                onClick={() => handleStatusChange('in_progress')}
                className="w-full text-left px-2 py-1.5 rounded-[6px] hover:bg-[#FAF8F5] text-[#2B2A25] flex items-center justify-between"
              >
                <span>В работе</span>
                {task.status === 'in_progress' && <Check className="w-3 h-3 text-[#5FA07A]" />}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('submitted')}
                className="w-full text-left px-2 py-1.5 rounded-[6px] hover:bg-[#FAF8F5] text-[#2B2A25] flex items-center justify-between"
              >
                <span>Сдано в ведомство</span>
                {task.status === 'submitted' && <Check className="w-3 h-3 text-[#5FA07A]" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setIsEditingWait(true);
                }}
                className="w-full text-left px-2 py-1.5 rounded-[6px] hover:bg-[#FAF8F5] text-[#2B2A25] flex items-center justify-between"
              >
                <span>Ожидает ответа...</span>
                {task.status === 'waiting' && <Check className="w-3 h-3 text-[#5FA07A]" />}
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('done')}
                className="w-full text-left px-2 py-1.5 rounded-[6px] hover:bg-[#FAF8F5] text-[#5FA07A] flex items-center justify-between"
              >
                <span>Завершено (Готово)</span>
                {task.status === 'done' && <Check className="w-3 h-3 text-[#5FA07A]" />}
              </button>

              <div className="border-t border-[#EAE3D6] my-1" />
              <button
                type="button"
                onClick={handleDelete}
                className="w-full text-left px-2 py-1.5 rounded-[6px] hover:bg-[#FCE6E3] text-[#DD6B60] flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить задачу</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Task Document Title */}
      <div className="mb-1.5">
        <h3 className="text-sm font-semibold text-[#2B2A25] leading-snug">
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="text-left hover:text-[#5FA07A] transition"
            aria-label={`Открыть задачу: ${task.doc_type}`}
          >
            {task.doc_type}
          </button>
        </h3>
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="text-[11px] text-[#5FA07A] hover:underline mt-0.5"
        >
          Открыть задачу
        </button>
      </div>

      {/* Company Link */}
      {task.company && (
        <div className="mb-3">
          <Link
            to={`/companies/${task.company.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-[#8C8577] hover:text-[#5FA07A] transition group"
          >
            <Building className="w-3.5 h-3.5 text-[#C7A96E]" />
            <span className="font-medium group-hover:underline">{task.company.name}</span>
            <span className="text-[10px] text-[#8C8577] bg-[#FAF8F5] px-1.5 py-0.5 rounded-[4px] border border-[#EAE3D6]">
              ИНН: {task.company.inn}
            </span>
          </Link>
        </div>
      )}

      {/* Notes if any */}
      {task.notes && (
        <p className="text-xs text-[#8C8577] bg-[#FAF8F5] p-2 rounded-[8px] mb-3 leading-relaxed border border-[#EAE3D6]/50">
          {task.notes}
        </p>
      )}

      {/* Waiting mode indicator or inline editor */}
      {task.status === 'waiting' && !isEditingWait && (
        <div className="flex items-center justify-between bg-[#E7F3EB] border border-[#5FA07A33] rounded-[8px] px-2.5 py-1.5 text-xs text-[#5FA07A] mb-3">
          <div className="flex items-center gap-1.5">
            <Hourglass className="w-3.5 h-3.5" />
            <span>Ожидание ответа {task.wait_until ? `до ${formatDateRu(task.wait_until, 'dd.MM.yyyy')}` : ''}</span>
          </div>
          <button
            onClick={() => setIsEditingWait(true)}
            className="text-[11px] underline font-medium hover:text-[#528E6B]"
          >
            изменить
          </button>
        </div>
      )}

      {isEditingWait && (
        <div className="bg-[#FAF8F5] border border-[#EAE3D6] p-2.5 rounded-[8px] mb-3 text-xs">
          <label className="block text-[11px] font-medium text-[#2B2A25] mb-1">
            Дата ожидаемого ответа (wait_until):
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={waitDate}
              onChange={(e) => setWaitDate(e.target.value)}
              className="px-2 py-1 text-xs border border-[#EAE3D6] rounded-[6px] focus:outline-none focus:border-[#5FA07A] bg-white flex-1"
            />
            <button
              onClick={handleSaveWaitDate}
              className="px-2.5 py-1 rounded-[6px] bg-[#5FA07A] text-white font-medium hover:bg-[#528E6B]"
            >
              Сохранить
            </button>
            <button
              onClick={() => setIsEditingWait(false)}
              className="px-2 py-1 rounded-[6px] text-[#8C8577] hover:bg-white"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Card Footer: Due Date & Quick Submission Button */}
      <div className="flex items-center justify-between pt-2.5 border-t border-[#EAE3D6]/70 text-xs text-[#8C8577]">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#8C8577]" />
          <span>Срок: <strong className="text-[#2B2A25]">{formatDateRu(task.due_date, 'd MMM yyyy')}</strong></span>
        </div>

        {/* Assigned accountant tag (for manager panel) */}
        {showAccountant && task.company?.owner && (
          <div className="flex items-center gap-1 text-[11px] text-[#8C8577] bg-[#FAF8F5] px-2 py-0.5 rounded-[6px] border border-[#EAE3D6]">
            <User className="w-3 h-3 text-[#5FA07A]" />
            <span className="truncate max-w-[120px]">{task.company.owner.full_name.split(' ')[0]}</span>
          </div>
        )}

        {/* Quick action button */}
        {task.status !== 'done' ? (
          <button
            type="button"
            onClick={() => handleStatusChange('done')}
            className="flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-medium text-[#5FA07A] bg-[#E7F3EB] hover:bg-[#5FA07A] hover:text-white transition"
            title="Отметить выполненным"
          >
            <Check className="w-3 h-3" />
            <span>Сдано</span>
          </button>
        ) : (
          <span className="flex items-center gap-1 text-xs text-[#5FA07A] font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Завершено</span>
          </span>
        )}
      </div>
    </div>
    {showDetails && (
      <div
        className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowDetails(false);
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={`task-details-title-${task.id}`}
          className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-xl"
        >
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[#EAE3D6]">
            <div>
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-medium mb-3"
                style={{ backgroundColor: badge.bgColor, color: badge.textColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: badge.dotColor }} />
                {badge.label}
              </span>
              <h2 id={`task-details-title-${task.id}`} className="text-lg font-bold text-[#2B2A25] leading-snug">
                {task.doc_type}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="p-2 rounded-lg text-[#8C8577] hover:bg-[#FAF8F5] hover:text-[#2B2A25]"
              aria-label="Закрыть задачу"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="block text-xs text-[#8C8577] mb-1">Срок выполнения</span>
                <span className="font-semibold text-[#2B2A25]">
                  {formatDateRu(task.due_date, 'd MMMM yyyy')}
                </span>
              </div>
              <div>
                <span className="block text-xs text-[#8C8577] mb-1">Статус</span>
                <span className="font-semibold text-[#2B2A25]">{statusLabel[task.status]}</span>
              </div>
              {task.status === 'waiting' && task.wait_until && (
                <div>
                  <span className="block text-xs text-[#8C8577] mb-1">Ожидаемый ответ до</span>
                  <span className="font-semibold text-[#2B2A25]">
                    {formatDateRu(task.wait_until, 'd MMMM yyyy')}
                  </span>
                </div>
              )}
            </div>

            {task.company && (
              <div>
                <span className="block text-xs text-[#8C8577] mb-1">Компания</span>
                <Link
                  to={`/companies/${task.company.id}`}
                  onClick={() => setShowDetails(false)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5FA07A] hover:underline"
                >
                  <Building className="w-4 h-4" />
                  {task.company.name}
                  <span className="text-xs font-normal text-[#8C8577]">ИНН: {task.company.inn}</span>
                </Link>
              </div>
            )}

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8C8577] mb-2">
                Описание задачи
              </h3>
              <div className="min-h-24 whitespace-pre-wrap break-words rounded-xl border border-[#EAE3D6] bg-[#FAF8F5] p-4 text-sm leading-relaxed text-[#2B2A25]">
                {task.notes?.trim() || 'Описание задачи не добавлено.'}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 rounded-lg bg-[#5FA07A] text-sm font-semibold text-white hover:bg-[#528E6B]"
              >
                Закрыть
              </button>
            </div>
          </div>
        </section>
      </div>
    )}
    </>
  );
};
