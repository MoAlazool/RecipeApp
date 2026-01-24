import * as LiveActivityModule from 'expo-live-activity';
import type { LiveActivityConfig, LiveActivityState } from 'expo-live-activity';
import { Platform } from 'react-native';

const MIN_IOS_VERSION = 16.2;
const TIMER_CONFIG: LiveActivityConfig = {
  backgroundColor: '#FFFFFF',
  titleColor: '#1C100D',
  subtitleColor: '#9C5749',
  progressViewTint: '#F2330D',
  progressViewLabelColor: '#F2330D',
  timerType: 'digital',
};

const getIOSVersion = (): number => {
  const version = Platform.Version;
  if (typeof version === 'string') {
    const parsed = Number.parseFloat(version);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return typeof version === 'number' ? version : 0;
};

const isSupported = (): boolean => {
  return Platform.OS === 'ios' && getIOSVersion() >= MIN_IOS_VERSION;
};

const buildTimerState = (params: {
  label: string;
  recipeName?: string;
  stepLabel?: string;
  endTimeMs: number;
}): LiveActivityState => ({
  title: params.label,
  subtitle: buildSubtitle(params.recipeName, params.stepLabel),
  progressBar: { date: params.endTimeMs },
});

const buildSubtitle = (recipeName?: string, stepLabel?: string): string | undefined => {
  if (recipeName && stepLabel) {
    return `${recipeName}||${stepLabel}`;
  }
  return recipeName ?? stepLabel;
};

let activeActivityId: string | null = null;
let activeKey: string | null = null;
let lastState: LiveActivityState | null = null;

export const LiveActivity = {
  async startTimer(params: {
    label: string;
    recipeName?: string;
    stepLabel?: string;
    startTimeMs: number;
    endTimeMs: number;
    key: string;
  }): Promise<boolean> {
    if (!isSupported()) {
      return false;
    }

    const state = buildTimerState({
      label: params.label,
      recipeName: params.recipeName,
      stepLabel: params.stepLabel,
      endTimeMs: params.endTimeMs,
    });
    lastState = state;

    if (activeKey === params.key && activeActivityId) {
      try {
        await LiveActivityModule.updateActivity(activeActivityId, state);
        return true;
      } catch {
        return false;
      }
    }

    if (activeActivityId) {
      try {
        await LiveActivityModule.stopActivity(activeActivityId, state);
      } catch {
        // Ignore stop failures to avoid blocking new activity start.
      }
    }

    let activityId: string | void;
    try {
      activityId = LiveActivityModule.startActivity(state, TIMER_CONFIG);
    } catch {
      activeActivityId = null;
      activeKey = null;
      return false;
    }

    if (!activityId) {
      activeActivityId = null;
      activeKey = null;
      return false;
    }

    activeActivityId = activityId;
    activeKey = params.key;
    return true;
  },

  async endTimer(): Promise<boolean> {
    if (!isSupported()) {
      return false;
    }

    if (!activeActivityId) {
      activeKey = null;
      lastState = null;
      return true;
    }

    try {
      await LiveActivityModule.stopActivity(
        activeActivityId,
        lastState ?? {
          title: 'Timer done',
          progressBar: { date: Date.now() },
        }
      );
      return true;
    } catch {
      return false;
    } finally {
      activeActivityId = null;
      activeKey = null;
      lastState = null;
    }
  },
};
