import React, { useState } from 'react';
import { X, AlertTriangle, Flame, ShieldAlert, Check } from 'lucide-react';
import { Task, UserProfile } from '../types';
import { escalateTaskManually } from '../lib/escalation';

interface EscalateTaskModalProps {
  task: Task;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccess: (updatedTask: Task) => void;
}

const QUICK_REASONS = [
  'Клиент не выходит на связь более 3 дней',
  'Нет первичных документов и банковских выписок',
  'Технический сбой в кабинете ГНС (salyk.kg) / ЭЦП',
  'Блокировка счета / требование УГНС',
  'Высокий риск штрафа за просрочку сдачи',
  'Требуется решение руководителя по налоговой ставке',
];

export const EscalateTaskModal: React.FC<EscalateTaskModalProps> = ({
  task,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState(QUICK_REASONS[0]);
  const [customNote, setCustomNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason = customNote.trim() ? `${reason}: ${customNote.trim()}` : reason;
    setLoading(true);

    try {
      const updated = await escalateTaskManually(task, finalReason, currentUser);
      onSuccess(updated);
      onClose();
    } catch (err) {
      console.error('Failed to escalate task:', err);
      alert('Ошибка при эскалации задачи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-[#DD6B60]/30 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE3D6] bg-[#FCE6E3]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FCE6E3] text-[#DD6B60] flex items-center justify-center">
              <Flame className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#2B2A25]">
                Эскалация руководителю
              </h3>
              <p className="text-[11px] text-[#8C8577]">
                Задача будет помечена как критическая и передана на контроль
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#8C8577] hover:text-[#2B2A25] hover:bg-[#EAE3D6]/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <span className="text-[11px] font-semibold text-[#8C8577] block mb-1">
              Задача
            </span>
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#EAE3D6]">
              <span className="font-semibold text-[#2B2A25] block">{task.doc_type}</span>
              <span className="text-[11px] text-[#8C8577]">
                Компания: {task.company?.name || '—'} • Срок: {task.due_date}
              </span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8C8577] block mb-1.5">
              Причина эскалации
            </label>
            <div className="space-y-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between ${
                    reason === r
                      ? 'border-[#DD6B60] bg-[#FCE6E3]/30 text-[#DD6B60] font-semibold'
                      : 'border-[#EAE3D6] text-[#2B2A25] hover:bg-[#FAF8F5]'
                  }`}
                >
                  <span>{r}</span>
                  {reason === r && <Check className="w-4 h-4 text-[#DD6B60]" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-[#8C8577] block mb-1">
              Дополнительный комментарий
            </label>
            <textarea
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Укажите подробности (например: последний звонок клиенту был вчера, телефон отключен)..."
              className="w-full p-2.5 border border-[#EAE3D6] rounded-xl text-xs text-[#2B2A25] focus:outline-none focus:border-[#DD6B60] resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#EAE3D6]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-[#8C8577] hover:bg-[#EAE3D6]/50 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#DD6B60] hover:bg-[#c9594f] text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>{loading ? 'Эскалация...' : 'Передать руководителю'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
