import { NativeModules, Platform } from 'react-native';

type LiveActivityModule = {
  startTimer: (
    label: string,
    recipeName: string | null,
    startTimeMs: number,
    endTimeMs: number
  ) => Promise<string>;
  endTimer: () => Promise<boolean>;
};

const nativeModule = NativeModules.LiveActivityManager as LiveActivityModule | undefined;

const getIOSVersion = (): number => {
  const version = Platform.Version;
  if (typeof version === 'string') {
    const parsed = Number.parseFloat(version);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return typeof version === 'number' ? version : 0;
};

const isSupported = (): boolean => {
  return Platform.OS === 'ios' && getIOSVersion() >= 16.1 && !!nativeModule;
};

let activeKey: string | null = null;

export const LiveActivity = {
  async startTimer(params: {
    label: string;
    recipeName?: string;
    startTimeMs: number;
    endTimeMs: number;
    key: string;
  }): Promise<boolean> {
    if (!isSupported()) {
      return false;
    }

    if (activeKey === params.key) {
      return true;
    }

    activeKey = params.key;

    try {
      await nativeModule?.startTimer(
        params.label,
        params.recipeName ?? null,
        params.startTimeMs,
        params.endTimeMs
      );
      return true;
    } catch {
      activeKey = null;
      return false;
    }
  },

  async endTimer(): Promise<boolean> {
    if (!isSupported()) {
      return false;
    }

    activeKey = null;

    try {
      await nativeModule?.endTimer();
      return true;
    } catch {
      return false;
    }
  },
};
