'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fetchDisplayName: () => Promise<void>;
}

function translateError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Email ou senha incorretos';
  if (msg.includes('User already registered')) return 'Este email já está cadastrado';
  if (msg.includes('Email not confirmed')) return 'Confirme seu email antes de entrar';
  if (msg.includes('Password should be at least'))
    return 'A senha deve ter pelo menos 6 caracteres';
  return msg;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  displayName: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    const supabase = createClient();
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      set({
        session,
        user: session?.user ?? null,
        isInitialized: true,
      });

      if (session?.user) {
        get().fetchDisplayName();
      }

      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          session,
          user: session?.user ?? null,
        });
        if (session?.user) {
          get().fetchDisplayName();
        } else {
          set({ displayName: null });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isInitialized: true });
    }
  },

  signIn: async (email, password) => {
    const supabase = createClient();
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: translateError(error.message) };
      }

      set({ user: data.user, session: data.session });
      await get().fetchDisplayName();
      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email, password, fullName) => {
    const supabase = createClient();
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) {
        return { error: translateError(error.message) };
      }

      if (data.user) {
        // The `handle_new_user` trigger creates the profile row from
        // raw_user_meta_data.full_name; make sure display_name is set when
        // the session is already active (email confirmation disabled).
        if (data.session) {
          await supabase
            .from('profiles')
            .update({ display_name: fullName })
            .eq('id', data.user.id);
        }

        set({
          user: data.user,
          session: data.session,
          displayName: fullName,
        });
      }

      return { error: null };
    } catch (err) {
      return { error: (err as Error).message };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    const supabase = createClient();
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
      set({ user: null, session: null, displayName: null });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDisplayName: async () => {
    const { user } = get();
    if (!user) return;

    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle<{ display_name: string | null }>();

    if (data?.display_name) {
      set({ displayName: data.display_name });
    }
  },
}));
