'use client';

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';
import type { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  fetchDisplayName: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  session: null,
  displayName: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      set({ isLoading: true });

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        set({
          user: session.user,
          session,
        });
        await get().fetchDisplayName();
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          user: session?.user ?? null,
          session,
        });

        if (session?.user) {
          get().fetchDisplayName();
        } else {
          set({ displayName: null });
        }
      });
    } finally {
      set({ isLoading: false, isInitialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      set({
        user: data.user,
        session: data.session,
      });

      await get().fetchDisplayName();
      return { error: null };
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (email: string, password: string, displayName: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.user) {
        // Create profile record
        await supabase.from('profiles').upsert({
          id: data.user.id,
          display_name: displayName,
        });

        set({
          user: data.user,
          session: data.session,
          displayName,
        });
      }

      return { error: null };
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await supabase.auth.signOut();
      set({
        user: null,
        session: null,
        displayName: null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDisplayName: async () => {
    const { user } = get();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single<Pick<UserProfile, 'display_name'>>();

    if (data?.display_name) {
      set({ displayName: data.display_name });
    }
  },

  updateDisplayName: async (name: string) => {
    const { user } = get();
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: name,
      });

    if (error) {
      return { error: error.message };
    }

    set({ displayName: name });
    return { error: null };
  },
}));
