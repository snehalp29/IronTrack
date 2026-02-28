import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

export async function onSetCompleted(restSeconds: number) {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
