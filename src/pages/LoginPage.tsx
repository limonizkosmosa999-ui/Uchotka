import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Lock,
  Mail,
  User,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, register, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'accountant' | 'manager'>('accountant');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDemoHint, setShowDemoHint] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        navigate(user.role === 'manager' ? '/manager' : '/dashboard');
      } else {
        const user = await register(
          email,
          password,
          fullName,
          role,
          role === 'accountant' ? inviteCode : undefined
        );
        navigate(user.role === 'manager' ? '/manager' : '/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка. Проверьте введённые данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F1EB] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-white border border-[#D4C9B0] flex items-center justify-center shadow-sm">
            <Building2 className="w-9 h-9 text-[#4A8C68]" strokeWidth={1.8} />
          </div>
        </div>
        <h1 className="text-center text-3xl font-bold text-[#1E1D19] tracking-tight">
          Учётка
        </h1>
        <p className="mt-1.5 text-center text-sm text-[#6B6558]">
          Система управления бухгалтерского агентства
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md space-y-4">
        {/* Demo credentials hint */}
        {!isConfigured && (
          <div className="bg-white border border-[#C4B99A] rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDemoHint(!showDemoHint)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-[#1E1D19] hover:bg-[#FAF8F4] transition"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-[#4A8C68]" />
                <span>Демо-режим — готовые данные для входа</span>
              </div>
              {showDemoHint ? (
                <ChevronUp className="w-4 h-4 text-[#6B6558]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[#6B6558]" />
              )}
            </button>

            {showDemoHint && (
              <div className="border-t border-[#EAE3D6] px-5 py-4 space-y-3">
                {/* Manager demo */}
                <div
                  className="p-3.5 rounded-xl bg-[#FFF8F0] border border-[#E8C87A]/50 cursor-pointer hover:border-[#C47F2A] transition group"
                  onClick={() => {
                    setMode('login');
                    setEmail('manager@uchotka.agency');
                    setPassword('demo1234');
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#C47F2A]">
                      👤 Руководитель агентства
                    </span>
                    <span className="text-[11px] text-[#8C8577] group-hover:text-[#C47F2A] transition">
                      Нажмите для автозаполнения →
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-[#8C8577]" />
                      <code className="text-[#1E1D19] font-semibold">manager@uchotka.agency</code>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Lock className="w-4 h-4 text-[#8C8577]" />
                      <code className="text-[#1E1D19] font-semibold">demo1234</code>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#6B6558] mt-1">
                      <KeyRound className="w-3.5 h-3.5 text-[#C47F2A]" />
                      <span>Код приглашения для новых бухгалтеров:</span>
                      <code className="font-bold text-[#C47F2A] bg-[#F6EFDE] px-1.5 py-0.5 rounded">УЧЁТКА-2026</code>
                    </div>
                  </div>
                </div>

                {/* Accountant demo entries */}
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { name: 'Бакыт Муратов', email: 'bakyt@uchotka.agency' },
                    { name: 'Елена Ким', email: 'elena@uchotka.agency' },
                    { name: 'Улан Джумабеков', email: 'ulan@uchotka.agency' },
                  ].map((acc) => (
                    <div
                      key={acc.email}
                      className="p-3 rounded-xl bg-[#F2FAF5] border border-[#4A8C68]/20 cursor-pointer hover:border-[#4A8C68] transition group flex items-center justify-between"
                      onClick={() => {
                        setMode('login');
                        setEmail(acc.email);
                        setPassword('demo1234');
                      }}
                    >
                      <div>
                        <span className="text-xs font-bold text-[#4A8C68] block">
                          🧾 Бухгалтер — {acc.name}
                        </span>
                        <code className="text-sm text-[#1E1D19] font-medium">{acc.email}</code>
                        <span className="text-sm text-[#6B6558] ml-2">/ demo1234</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#4A8C68] opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white border border-[#D4C9B0] rounded-2xl px-7 py-8">
          {/* Tabs */}
          <div className="flex border-b border-[#EAE3D6] mb-7 -mx-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 pb-3 text-sm font-semibold border-b-2 transition text-center ${
                  mode === m
                    ? 'border-[#4A8C68] text-[#4A8C68]'
                    : 'border-transparent text-[#8C8577] hover:text-[#1E1D19]'
                }`}
              >
                {m === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-[#FCE6E3] border border-[#DD6B60]/30 text-sm text-[#C0392B] leading-snug">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (
              <>
                {/* Full name */}
                <div>
                  <label className="block text-sm font-semibold text-[#1E1D19] mb-1.5">
                    Полное имя (ФИО)
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-[#8C8577] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Айгуль Садыкова"
                      className="w-full pl-11 pr-4 py-3 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-white text-[#1E1D19] placeholder-[#A89F92]"
                    />
                  </div>
                </div>

                {/* Role selector */}
                <div>
                  <label className="block text-sm font-semibold text-[#1E1D19] mb-1.5">
                    Роль в агентстве
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('accountant')}
                      className={`py-3 rounded-xl border text-sm font-semibold transition ${
                        role === 'accountant'
                          ? 'bg-[#E7F3EB] border-[#4A8C68] text-[#4A8C68]'
                          : 'border-[#D4C9B0] text-[#6B6558] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      🧾 Бухгалтер
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('manager')}
                      className={`py-3 rounded-xl border text-sm font-semibold transition ${
                        role === 'manager'
                          ? 'bg-[#FFF3E0] border-[#C47F2A] text-[#C47F2A]'
                          : 'border-[#D4C9B0] text-[#6B6558] hover:bg-[#FAF8F4]'
                      }`}
                    >
                      👔 Руководитель
                    </button>
                  </div>
                </div>

                {/* Invite code — only for accountant */}
                {role === 'accountant' && (
                  <div>
                    <label className="block text-sm font-semibold text-[#1E1D19] mb-1.5">
                      Код приглашения от руководителя
                    </label>
                    <div className="relative">
                      <KeyRound className="w-5 h-5 text-[#C47F2A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                        placeholder="УЧЁТКА-2026"
                        className="w-full pl-11 pr-4 py-3 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#C47F2A] focus:ring-2 focus:ring-[#C47F2A]/10 bg-white font-mono text-[#1E1D19] tracking-widest placeholder-[#A89F92]"
                      />
                    </div>
                    <p className="text-xs text-[#8C8577] mt-1.5">
                      Запросите этот код у вашего руководителя — он есть в настройках его аккаунта
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-[#1E1D19] mb-1.5">
                Рабочий Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-[#8C8577] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="accountant@uchotka.agency"
                  className="w-full pl-11 pr-4 py-3 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-white text-[#1E1D19] placeholder-[#A89F92]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-[#1E1D19] mb-1.5">
                Пароль
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-[#8C8577] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3 text-sm border border-[#D4C9B0] rounded-xl focus:outline-none focus:border-[#4A8C68] focus:ring-2 focus:ring-[#4A8C68]/10 bg-white text-[#1E1D19]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8C8577] hover:text-[#1E1D19]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#4A8C68] text-white text-sm font-bold hover:bg-[#3D7557] transition disabled:opacity-50 mt-2"
            >
              {loading
                ? 'Загрузка...'
                : mode === 'login'
                ? 'Войти в систему'
                : 'Зарегистрировать аккаунт'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
