import React, { useState } from 'react';
import { X, UserPlus, Mail, User, Shield } from 'lucide-react';
import { UserRole } from '../types';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddEmployee: (name: string, email: string, role: UserRole) => Promise<void>;
}

export const AddEmployeeModal: React.FC<AddEmployeeModalProps> = ({
  isOpen,
  onClose,
  onAddEmployee,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('accountant');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError('Заполните имя и email сотрудника');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onAddEmployee(fullName.trim(), email.trim(), role);
      setFullName('');
      setEmail('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить сотрудника');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#EAE5DD] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE5DD]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E2EFE7] text-[#1E4D3B] flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1A1916]">Добавить сотрудника</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[#FCE8E6] text-[#D9483B] text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Имя и фамилия сотрудника
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Например: Айгуль Асанова"
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#D4CDBF] rounded-lg bg-white text-gray-900 focus:outline-none focus:border-[#1E4D3B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email для входа и уведомлений
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="accountant@example.com"
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#D4CDBF] rounded-lg bg-white text-gray-900 focus:outline-none focus:border-[#1E4D3B]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Роль в агентстве
            </label>
            <div className="relative">
              <Shield className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-[#D4CDBF] rounded-lg bg-white text-gray-900 focus:outline-none focus:border-[#1E4D3B]"
              >
                <option value="accountant">Бухгалтер (ведение компаний и отчетов)</option>
                <option value="manager">Руководитель (полный доступ и сводка)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#1E4D3B] hover:bg-[#163B2D] rounded-lg transition disabled:opacity-50"
            >
              {submitting ? 'Добавление...' : 'Добавить сотрудника'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
