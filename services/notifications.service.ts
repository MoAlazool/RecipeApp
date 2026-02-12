import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const TIMER_CHANNEL_ID = 'cooking-timers';
const MESSAGES_CHANNEL_ID = 'messages';
let isConfigured = false;

export const configureNotifications = async (): Promise<void> => {
  if (isConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
      name: 'Cooking Timers',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  isConfigured = true;
};

const ensurePermissions = async (): Promise<boolean> => {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const request = await Notifications.requestPermissionsAsync();
  return (
    request.granted || request.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
};

export const scheduleTimerNotification = async (params: {
  label?: string;
  recipeName?: string;
  seconds: number;
}): Promise<string | null> => {
  await configureNotifications();

  const hasPermission = await ensurePermissions();
  if (!hasPermission) {
    return null;
  }

  const title = params.recipeName ? `Timer done — ${params.recipeName}` : 'Timer done';
  const body = params.label ? `${params.label} is ready.` : 'Your timer finished.';

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(params.seconds)),
      channelId: TIMER_CHANNEL_ID,
    },
  });
};

export const cancelNotification = async (notificationId?: string | null): Promise<void> => {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

export const registerForPushNotifications = async (): Promise<string | null> => {
  await configureNotifications();

  const hasPermission = await ensurePermissions();
  if (!hasPermission) return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[Notifications] No EAS projectId found');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    return token;
  } catch {
    // Silently fail — push tokens don't work on iOS simulator
    return null;
  }
};

export const showMessageNotification = async (params: {
  senderName: string;
  body: string;
  conversationId: string;
}): Promise<void> => {
  await configureNotifications();

  const hasPermission = await ensurePermissions();
  if (!hasPermission) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.senderName,
      body: params.body,
      sound: 'default',
      data: { type: 'message', conversationId: params.conversationId },
      ...(Platform.OS === 'android' && { channelId: MESSAGES_CHANNEL_ID }),
    },
    trigger: null, // show immediately
  });
};
