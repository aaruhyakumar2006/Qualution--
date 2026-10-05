import { createClient } from '@supabase/supabase-js';
import type { Database } from '../features/portal/types/database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.DEV) {
    console.warn(
      '[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment variables. ' +
      'Please check your .env configuration against .env.example.'
    );
  }
}

// Ensure the client can initialize safely even before environment variables are supplied
export const supabase = createClient<Database>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export type SupabaseClient = typeof supabase;
