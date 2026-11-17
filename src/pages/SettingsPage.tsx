import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings, 
  Lock, 
  Mail, 
  User, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Database,
  ArrowRight,
  Trash2,
  AlertTriangle,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile, requestAccountDeletion } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [notificationEmail, setNotificationEmail] = useState(
    user?.notification_email || user?.email || ''
  );

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Account deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setProfileSuccess(false);
    setSavingProfile(true);

    try {
      await updateUserProfile(user.id, {
        full_name: fullName.trim(),
        notification_email: notificationEmail.trim(),
      });
      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления профиля');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setSavingPassword(true);
    try {
      if (isSupabaseConfigured) {
        const { error: passErr } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (passErr) throw passErr;
      }
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setError(err.message || 'Ошибка смены пароля');
    } finally {
      setSavingPassword(false);
    }
  };

  const deletionDatePreview = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeletingAccount(true);
    setError(null);

    try {
      await requestAccountDeletion(user.id);
      await logout();
      navigate('/login', {
        replace: true,
        state: {
          deletionNotice: `Запрос на удаление аккаунта ${user.email} принят. Доступ закрыт, а все ваши данные будут окончательно стёрты через 3 дня.`,
        },
      });
    } catch (err: any) {
      setError(err.message || 'Не удалось запросить удаление аккаунта');
      setShowDeleteModal(false);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F4EFEA] px-8 py-7">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#F2ECE3]">
          <div className="w-10 h-10 rounded-xl bg-[#E2EFE7] text-[#1E4D3B] flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#1A1916]">
              Настройки аккаунта и уведомлений
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Управление контактными данными для email-напоминаний и паролем
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-xl bg-[#FCE8E6] text-xs font-semibold text-[#D9483B] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-6">
        {/* Profile & Notification Email Form */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-[#2B2A25] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#5FA07A]" />
              <span>Профиль и Email для уведомлений</span>
            </h2>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-[4px] uppercase ${
              user?.role === 'manager' ? 'bg-[#FBEBD9] text-[#DB8A3C]' : 'bg-[#E7F3EB] text-[#5FA07A]'
            }`}>
              {user?.role === 'manager' ? 'Руководитель' : 'Бухгалтер'}
            </span>
          </div>

          {profileSuccess && (
            <div className="mb-4 p-2.5 rounded-[8px] bg-[#E7F3EB] border border-[#5FA07A]/30 text-xs text-[#5FA07A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Настройки профиля успешно сохранены!</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                ФИО сотрудника
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#8C8577] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                Email для получения напоминаний о дедлайнах
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8C8577] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
                />
              </div>
              <p className="text-[10px] text-[#8C8577] mt-1">
                На этот адрес ежедневно за 3 дня и за 1 день до срока сдачи будут приходить письма с напоминанием.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-4 py-2 rounded-lg bg-[#1E4D3B] text-white text-xs font-semibold hover:bg-[#163B2D] transition disabled:opacity-50 shadow-2xs"
              >
                {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>

        {/* Password Change Form */}
        <div className="bg-white border border-[#EAE5DD] rounded-2xl p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-[#1A1916] flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-gray-400" />
            <span>Смена пароля</span>
          </h2>

          {passwordSuccess && (
            <div className="mb-4 p-2.5 rounded-lg bg-[#E2EFE7] border border-[#1E4D3B]/30 text-xs text-[#1E4D3B] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Пароль успешно обновлен!</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1A1916] mb-1">
                  Новый пароль
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D4CDBF] rounded-lg focus:outline-none focus:border-[#1E4D3B] text-[#1A1916]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1A1916] mb-1">
                  Подтверждение пароля
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#D4CDBF] rounded-lg focus:outline-none focus:border-[#1E4D3B] text-[#1A1916]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-800 transition disabled:opacity-50 shadow-2xs"
              >
                {savingPassword ? 'Обновление...' : 'Обновить пароль'}
              </button>
            </div>
          </form>
        </div>

        {/* Backend / Supabase Connection Status Card */}
        <div className="bg-white border border-[#EAE5DD] rounded-2xl p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-[#1A1916] flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-gray-400" />
            <span>Статус подключения базы данных Supabase</span>
          </h2>

          <div className="mt-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#EAE5DD] flex items-start justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-[#1E4D3B]' : 'bg-[#C47F2A]'}`} />
                <span className="font-semibold text-[#1A1916]">
                  {isSupabaseConfigured
                    ? 'Подключено к Supabase Postgres (Live Cloud)'
                    : 'Локальный демонстрационный режим (Mock Store)'}
                </span>
              </div>
              <p className="text-gray-500 text-[11px] leading-relaxed">
                {isSupabaseConfigured
                  ? 'Все данные синхронизируются с удаленным сервером Supabase с проверкой Row Level Security и Realtime событиями.'
                  : 'Для подключения к реальному инстансу Supabase укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.'}
              </p>
            </div>
          </div>
        </div>

        {/* Danger Zone: Account Deletion */}
        <div className="bg-[#FFF8F7] border border-[#F6D0CC] rounded-2xl p-6 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-[#D9483B] flex items-center gap-2 mb-1.5">
                <Trash2 className="w-4 h-4 flex-shrink-0" />
                <span>Опасная зона: Удаление аккаунта</span>
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed max-w-xl">
                Вы можете запросить удаление своего аккаунта. Сеанс будет завершён немедленно. Все персональные данные, привязки и записи будут храниться в течение <span className="font-bold text-[#1A1916]">3 дней</span> (период отсрочки), после чего безвозвратно удалятся из базы данных Supabase.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmed(false);
                setShowDeleteModal(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-[#D9483B] hover:bg-[#B33A2F] text-white text-xs font-bold transition flex items-center justify-center gap-2 flex-shrink-0 shadow-2xs cursor-pointer self-start sm:self-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Удалить аккаунт</span>
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Modal: Confirmation of Account Deletion */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EAE5DD] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#EAE5DD] bg-[#FAF8F5]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FCE8E6] text-[#D9483B] flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-[#1A1916]">Удалить аккаунт?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#FCE8E6]/60 border border-[#D9483B]/20 text-xs text-[#D9483B] leading-relaxed">
                <p className="font-bold mb-1">Период отсрочки: 3 дня</p>
                <p>
                  После подтверждения доступ к системе прекратится сразу. Ваши данные будут окончательно стёрты из базы данных Supabase <strong className="underline">{deletionDatePreview}</strong>.
                </p>
              </div>

              <div className="text-xs text-gray-600 space-y-2">
                <p>
                  Аккаунт: <span className="font-bold text-[#1A1916]">{user?.email}</span>
                </p>
                <p className="text-[11px] text-gray-500">
                  До истечения 3 дней данные остаются замороженными для предотвращения случайной потери информации агентства.
                </p>
              </div>

              <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={deleteConfirmed}
                  onChange={(e) => setDeleteConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-[#D4CDBF] text-[#D9483B] focus:ring-[#D9483B]"
                />
                <span className="text-xs text-gray-700 leading-snug">
                  Я подтверждаю, что хочу удалить свой аккаунт и согласен на полное стирание данных через 3 дня
                </span>
              </label>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-[#EAE5DD]">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingAccount}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={!deleteConfirmed || deletingAccount}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#D9483B] hover:bg-[#B33A2F] rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-2xs"
                >
                  {deletingAccount ? 'Запрос на удаление...' : 'Да, удалить аккаунт'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
