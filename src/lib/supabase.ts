import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('your-project-id') &&
    supabaseAnonKey !== 'your-publishable-anon-key-here'
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Ensures the student has an anonymous Supabase session (or local anonymous UUID in Demo Mode).
 * Never asks for email, real name, password or student ID.
 */
export async function ensureAnonymousStudentSession(): Promise<{
  anonymousId: string;
  isDemo: boolean;
}> {
  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return { anonymousId: session.user.id, isDemo: false };
    }
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data.user?.id) {
      return { anonymousId: data.user.id, isDemo: false };
    }
  }

  // Fallback local anonymous session identifier for Demo Mode
  const storageKey = 'pca_demo_anon_session_id';
  let localId = localStorage.getItem(storageKey);
  if (!localId) {
    localId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `anon-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(storageKey, localId);
  }
  return { anonymousId: localId, isDemo: true };
}

