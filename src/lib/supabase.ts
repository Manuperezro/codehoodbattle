import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_PUBLIC_SUPABASE_URL = 'https://macrdaowufrbkllsvzru.supabase.co';
const DEFAULT_PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hY3JkYW93dWZyYmtsbHN2enJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMzAyMTgsImV4cCI6MjEwOTkwNjIxOH0.hpisqqPZKL8YtozsjXidNldlt6mvhbw9xFlPCjr-KSc';

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const supabaseUrl =
  envUrl && !envUrl.includes('your-project-id')
    ? envUrl
    : DEFAULT_PUBLIC_SUPABASE_URL;

const supabaseAnonKey =
  envKey && envKey !== 'your-publishable-anon-key-here'
    ? envKey
    : DEFAULT_PUBLIC_SUPABASE_ANON_KEY;

// In automated unit tests (vitest), keep local Demo Mode so unit tests run offline deterministically
const isTestEnv = Boolean(import.meta.env.VITEST);

export const isSupabaseConfigured: boolean =
  !isTestEnv &&
  Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('your-project-id')
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
  error?: string;
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
    if (error) {
      return {
        anonymousId: '',
        isDemo: false,
        error:
          error.message.includes('Anonymous') || error.message.includes('anonymous')
            ? 'Anonymous Sign-Ins are not enabled yet in Supabase. Go to Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins and toggle it ON.'
            : error.message,
      };
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
