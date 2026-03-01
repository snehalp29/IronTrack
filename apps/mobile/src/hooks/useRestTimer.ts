import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!current.canAskAgain) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function onSetCompleted(restSeconds: number) {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Rest complete',
      body: 'Time for your next set',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: restSeconds,
    },
  });
}
