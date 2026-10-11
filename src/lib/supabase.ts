import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

function isSecretApiKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;

  const payload = key.split('.')[1];
  if (!payload) return false;

  try {
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
    const claims: { role?: string } = JSON.parse(decodedPayload);
    return claims.role === 'service_role';
  } catch {
    return false;
  }
}

const hasSupabaseCredentials = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key')
);

export const supabaseConfigError =
  hasSupabaseCredentials && isSecretApiKey(supabaseAnonKey)
    ? 'В настройках указан секретный ключ Supabase. Браузеру разрешён только публичный ключ anon/publishable.'
    : null;

export const isSupabaseConfigured = hasSupabaseCredentials && !supabaseConfigError;

// Initialize supabase client if configured, otherwise provide safe fallback client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : createClient('https://mock-uchotka-placeholder.supabase.co', 'mock-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
