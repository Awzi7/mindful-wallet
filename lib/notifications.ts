import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { addNotification, getWeeklyRecapNotificationId, setWeeklyRecapNotificationId } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let permissionRequested = false;

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted || current.ios?.status === 2;
  if (!granted && !permissionRequested) {
    permissionRequested = true;
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    granted = req.granted || req.ios?.status === 2;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('mindful-wallet', {
      name: 'Mindful Wallet coaching',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  return granted;
}

export async function scheduleProactiveNudge(
  title: string,
  body: string,
  secondsFromNow: number
): Promise<string | null> {
  // Logged in-app regardless of OS push permission, so the notification center still
  // reflects every coaching moment even if the user denied system notifications.
  await addNotification(title, body);
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const channelId = Platform.OS === 'android' ? 'mindful-wallet' : undefined;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger:
      secondsFromNow <= 0
        ? null
        : {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: secondsFromNow,
            channelId,
          },
  });
}

function secondsUntilNextSunday(hour: number): number {
  const now = new Date();
  const next = new Date(now);
  const daysUntilSunday = (7 - now.getDay()) % 7; // Date#getDay(): 0 = Sunday
  next.setDate(now.getDate() + daysUntilSunday);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 7);
  return Math.max(60, Math.round((next.getTime() - now.getTime()) / 1000));
}

/**
 * (Re)schedules a single weekly recap notification for the upcoming Sunday evening, replacing
 * any previously scheduled one. Expo Go can't run a true background task, so the content is a
 * snapshot as of whenever the app was last opened before Sunday rather than computed live at
 * delivery time — and unlike scheduleProactiveNudge, this does NOT log to the in-app
 * notification list immediately, since that list should reflect delivered notices, not ones
 * scheduled for days from now (which would also duplicate on every reschedule).
 */
export async function scheduleWeeklyRecap(title: string, body: string): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const previousId = await getWeeklyRecapNotificationId();
  if (previousId) {
    await Notifications.cancelScheduledNotificationAsync(previousId).catch(() => {});
  }

  const channelId = Platform.OS === 'android' ? 'mindful-wallet' : undefined;
  const id = await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secondsUntilNextSunday(19),
      channelId,
    },
  });
  await setWeeklyRecapNotificationId(id);
}
