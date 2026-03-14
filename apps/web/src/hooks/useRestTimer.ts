import { useEffect } from 'react';

import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';

export function useRestTimer(): void {
  const active = useActiveWorkoutStore((state) => state.restTimerActive);
  const tick = useActiveWorkoutStore((state) => state.tickRestTimer);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = window.setInterval(() => tick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, tick]);
}
