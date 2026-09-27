import React, { useState } from 'react';
import { 
  Settings, 
  Lock, 
  Mail, 
  User, 
  Shield, 
  CheckCircle2, 
  AlertCircle, 
  Database,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../lib/api';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();

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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#EAE3D6]">
        <div className="w-10 h-10 rounded-[10px] bg-[#E7F3EB] text-[#5FA07A] flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#2B2A25]">
            Настройки аккаунта и уведомлений
          </h1>
          <p className="text-xs text-[#8C8577]">
            Управление контактными данными для email-напоминаний и паролем
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-[8px] bg-[#FCE6E3] border border-[#DD6B60]/30 text-xs text-[#DD6B60] flex items-center gap-2">
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
                className="px-4 py-2 rounded-[8px] bg-[#5FA07A] text-white text-xs font-semibold hover:bg-[#528E6B] transition disabled:opacity-50"
              >
                {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </div>
          </form>
        </div>

        {/* Password Change Form */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6">
          <h2 className="text-sm font-bold text-[#2B2A25] flex items-center gap-2 mb-4">
            <Lock className="w-4 h-4 text-[#C7A96E]" />
            <span>Смена пароля</span>
          </h2>

          {passwordSuccess && (
            <div className="mb-4 p-2.5 rounded-[8px] bg-[#E7F3EB] border border-[#5FA07A]/30 text-xs text-[#5FA07A] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Пароль успешно обновлен!</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                  Новый пароль
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#2B2A25] mb-1">
                  Подтверждение пароля
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#EAE3D6] rounded-[8px] focus:outline-none focus:border-[#5FA07A] text-[#2B2A25]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={savingPassword}
                className="px-4 py-2 rounded-[8px] bg-[#2B2A25] text-white text-xs font-semibold hover:bg-black transition disabled:opacity-50"
              >
                {savingPassword ? 'Обновление...' : 'Обновить пароль'}
              </button>
            </div>
          </form>
        </div>

        {/* Backend / Supabase Connection Status Card */}
        <div className="bg-white border border-[#EAE3D6] rounded-[10px] p-6">
          <h2 className="text-sm font-bold text-[#2B2A25] flex items-center gap-2 mb-2">
            <Database className="w-4 h-4 text-[#8C8577]" />
            <span>Статус подключения базы данных Supabase</span>
          </h2>

          <div className="mt-3 p-3.5 rounded-[8px] bg-[#FAF8F5] border border-[#EAE3D6] flex items-start justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-[#5FA07A]' : 'bg-[#DB8A3C]'}`} />
                <span className="font-semibold text-[#2B2A25]">
                  {isSupabaseConfigured
                    ? 'Подключено к Supabase Postgres (Live Cloud)'
                    : 'Локальный демонстрационный режим (Mock Store)'}
                </span>
              </div>
              <p className="text-[#8C8577] text-[11px] leading-relaxed">
                {isSupabaseConfigured
                  ? 'Все данные синхронизируются с удаленным сервером Supabase с проверкой Row Level Security и Realtime событиями.'
                  : 'Для подключения к реальному инстансу Supabase укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файле .env.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
