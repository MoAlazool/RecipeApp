import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PreferencesState {
  // Appearance
  darkMode: boolean;

  // Notifications
  notificationsEnabled: boolean;
  messageNotifications: boolean;
  followNotifications: boolean;
  recipeNotifications: boolean;

  // Cooking
  voiceFeedback: boolean;
  keepScreenAwake: boolean;

  // Privacy
  privateAccount: boolean;

  // Actions
  setDarkMode: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setMessageNotifications: (enabled: boolean) => void;
  setFollowNotifications: (enabled: boolean) => void;
  setRecipeNotifications: (enabled: boolean) => void;
  setVoiceFeedback: (enabled: boolean) => void;
  setKeepScreenAwake: (enabled: boolean) => void;
  setPrivateAccount: (enabled: boolean) => void;
  resetPreferences: () => void;
}

const defaultPreferences = {
  darkMode: false,
  notificationsEnabled: true,
  messageNotifications: true,
  followNotifications: true,
  recipeNotifications: true,
  voiceFeedback: true,
  keepScreenAwake: true,
  privateAccount: false,
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      setDarkMode: (enabled: boolean) => set({ darkMode: enabled }),

      setNotificationsEnabled: (enabled: boolean) => set({ notificationsEnabled: enabled }),

      setMessageNotifications: (enabled: boolean) => set({ messageNotifications: enabled }),

      setFollowNotifications: (enabled: boolean) => set({ followNotifications: enabled }),

      setRecipeNotifications: (enabled: boolean) => set({ recipeNotifications: enabled }),

      setVoiceFeedback: (enabled: boolean) => set({ voiceFeedback: enabled }),

      setKeepScreenAwake: (enabled: boolean) => set({ keepScreenAwake: enabled }),

      setPrivateAccount: (enabled: boolean) => set({ privateAccount: enabled }),

      resetPreferences: () => set(defaultPreferences),
    }),
    {
      name: 'preferences-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
