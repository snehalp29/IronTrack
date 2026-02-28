import { useState } from 'react';

import { RefreshControl, ScrollView, Text, View } from 'react-native';

export function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View>
        <Text style={{ fontSize: 28, fontWeight: '700' }}>
          IronTrack Mobile
        </Text>
        <Text style={{ marginTop: 10 }}>
          Offline-first workout logging with SQLite sync queue.
        </Text>
      </View>
    </ScrollView>
  );
}
