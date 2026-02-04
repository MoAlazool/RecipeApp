import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseService } from '@/services/firebase.service';
import { useRecipeStore } from './recipeStore';
import { useShoppingStore } from './shoppingStore';
import { useMessagingStore } from './messagingStore';
import type { User } from '@/utils/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      initialize: async () => {
        try {
          set({ isLoading: true });
          const session = await firebaseService.getSession();

          if (session?.user) {
            const profile = await firebaseService.getProfile(session.user.id);
            set({
              user: profile,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            set({ isLoading: false });
          }
        } catch (error) {
          console.error('Auth init error:', error);
          set({ isLoading: false });
        }
      },

      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true, error: null });

          // Clear old data before signing in new user
          useRecipeStore.getState().clearAll();
          useShoppingStore.getState().resetStore();
          useMessagingStore.getState().clearAll();

          const { user } = await firebaseService.signIn(email, password);

          if (user) {
            const profile = await firebaseService.getProfile(user.id);
            set({
              user: profile,
              isAuthenticated: true,
              isLoading: false,
            });

            // Fetch fresh data for this user
            useRecipeStore.getState().fetchRecipes();
            useShoppingStore.getState().fetchItems();
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to sign in',
            isLoading: false,
          });
          throw error;
        }
      },

      signUp: async (email: string, password: string, fullName?: string) => {
        try {
          set({ isLoading: true, error: null });

          // Clear old data before signing up new user
          useRecipeStore.getState().clearAll();
          useShoppingStore.getState().resetStore();
          useMessagingStore.getState().clearAll();

          const { user, session } = await firebaseService.signUp(email, password);

          if (user && session) {
            // Create profile
            await firebaseService.createProfile({
              id: user.id,
              email: user.email!,
              full_name: fullName,
            });

            const profile = await firebaseService.getProfile(user.id);
            set({
              user: profile,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          }

          if (user && !session) {
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
            throw new Error('Check your email to confirm your account, then sign in.');
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to sign up',
            isLoading: false,
          });
          throw error;
        }
      },

      signInWithGoogle: async () => {
        try {
          set({ isLoading: true, error: null });

          // Clear old data before signing in new user
          useRecipeStore.getState().clearAll();
          useShoppingStore.getState().resetStore();
          useMessagingStore.getState().clearAll();

          const { user } = await firebaseService.signInWithGoogle();

          if (user) {
            let profile = await firebaseService.getProfile(user.id);
            if (!profile) {
              await firebaseService.createProfile({
                id: user.id,
                email: user.email || '',
                full_name:
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  undefined,
                avatar_url: user.user_metadata?.avatar_url,
              });
              profile = await firebaseService.getProfile(user.id);
            } else if (!profile.avatar_url && user.user_metadata?.avatar_url) {
              // Update existing profile with avatar if missing
              await firebaseService.updateProfile(user.id, {
                avatar_url: user.user_metadata.avatar_url,
              });
              profile = await firebaseService.getProfile(user.id);
            }

            set({
              user: profile,
              isAuthenticated: true,
              isLoading: false,
            });

            // Fetch fresh data for this user
            useRecipeStore.getState().fetchRecipes();
            useShoppingStore.getState().fetchItems();
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to sign in with Google',
            isLoading: false,
          });
          throw error;
        }
      },

      signOut: async () => {
        try {
          await firebaseService.signOut();

          // Clear all app data
          useRecipeStore.getState().clearAll();
          useShoppingStore.getState().resetStore();
          useMessagingStore.getState().clearAll();

          set({
            user: null,
            isAuthenticated: false,
          });
        } catch (error) {
          console.error('Sign out error:', error);
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        try {
          const { user } = get();
          if (!user) return;

          await firebaseService.updateProfile(user.id, updates);
          set({ user: { ...user, ...updates } });
        } catch (error) {
          console.error('Update profile error:', error);
          throw error;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
