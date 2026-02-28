import { useEffect } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { OfflineBanner } from './components/OfflineBanner';
import { initDatabase } from './db/database';
import { AppNavigator } from './navigation/AppNavigator';

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    initDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <AppNavigator />
    </QueryClientProvider>
  );
}
