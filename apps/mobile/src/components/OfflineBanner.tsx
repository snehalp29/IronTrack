import { Text, View } from 'react-native';

import { useOfflineStore } from '../stores/offlineStore';

export function OfflineBanner() {
  const isOnline = useOfflineStore((state) => state.isOnline);
  const pendingSyncCount = useOfflineStore((state) => state.pendingSyncCount);

  if (isOnline && pendingSyncCount === 0) {
    return null;
  }

  return (
    <View style={{ backgroundColor: '#7f1d1d', padding: 10 }}>
      <Text style={{ color: 'white', fontWeight: '700' }}>
        Offline mode active. Pending sync: {pendingSyncCount}
      </Text>
    </View>
  );
}
