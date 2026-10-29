import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const tabScopedAuthStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(key);
  },
};

const typedSupabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: tabScopedAuthStorage,
    storageKey: 'qhudoor_supabase_auth_session',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const supabase = typedSupabase;
