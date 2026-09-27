import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { getCurrentUser, loginWithEmail, registerWithEmail, logoutUser, switchMockUser } from '../lib/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (email: string, password: string, fullName: string, role?: 'accountant' | 'manager', inviteCode?: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshUser = async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch (e) {
      console.error('Failed to get user:', e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await refreshUser();
        } else {
          setUser(null);
        }
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const u = await loginWithEmail(email, pass);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, pass: string, fullName: string, role: 'accountant' | 'manager' = 'accountant', inviteCode?: string) => {
    setLoading(true);
    try {
      const u = await registerWithEmail(email, pass, fullName, role, inviteCode);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const switchUser = async (userId: string) => {
    setLoading(true);
    try {
      const u = await switchMockUser(userId);
      setUser(u);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured: isSupabaseConfigured,
        login,
        register,
        logout,
        switchUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
