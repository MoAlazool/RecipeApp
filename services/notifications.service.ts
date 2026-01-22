import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const TIMER_CHANNEL_ID = 'cooking-timers';
let isConfigured = false;

export const configureNotifications = async (): Promise<void> => {
  if (isConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: false,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
      name: 'Cooking Timers',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
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
      channelId: TIMER_CHANNEL_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.round(params.seconds)),
    },
  });
};

export const cancelNotification = async (notificationId?: string | null): Promise<void> => {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};
