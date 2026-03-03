import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRestTimer } from './useRestTimer';

const useEffectMock = vi.hoisted(() => vi.fn());
const useActiveWorkoutStoreMock = vi.hoisted(() => vi.fn());

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: useEffectMock,
  };
});

vi.mock('../stores/activeWorkoutStore', () => ({
  useActiveWorkoutStore: useActiveWorkoutStoreMock,
}));

function mockStoreState(active: boolean, tick: () => void) {
  useActiveWorkoutStoreMock.mockImplementation(
    (
      selector: (state: {
        restTimerActive: boolean;
        tickRestTimer: () => void;
      }) => unknown,
    ) =>
      selector({
        restTimerActive: active,
        tickRestTimer: tick,
      }),
  );
}

function isCleanupFn(value: unknown): value is () => void {
  return typeof value === 'function';
}

describe('useRestTimer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not schedule interval when timer is not active', () => {
    const tick = vi.fn();
    mockStoreState(false, tick);
    const setIntervalMock = vi.fn<
      (handler: () => void, delay?: number) => number
    >(() => 123);
    const clearIntervalMock = vi.fn<(id: number) => void>();
    vi.stubGlobal('window', {
      setInterval: setIntervalMock,
      clearInterval: clearIntervalMock,
    } as unknown as Window);

    useEffectMock.mockImplementation((effect: () => unknown) => effect());

    useRestTimer();

    expect(useActiveWorkoutStoreMock).toHaveBeenCalledTimes(2);
    expect(useEffectMock).toHaveBeenCalledTimes(1);
    expect(setIntervalMock).not.toHaveBeenCalled();
    expect(clearIntervalMock).not.toHaveBeenCalled();
    expect(tick).not.toHaveBeenCalled();
  });

  it('schedules interval when active and clears it on cleanup', () => {
    const tick = vi.fn();
    mockStoreState(true, tick);

    const setIntervalMock = vi.fn<
      (handler: () => void, delay?: number) => number
    >(() => 321);
    const clearIntervalMock = vi.fn<(id: number) => void>();
    vi.stubGlobal('window', {
      setInterval: setIntervalMock,
      clearInterval: clearIntervalMock,
    } as unknown as Window);

    let cleanup: (() => void) | undefined;
    useEffectMock.mockImplementation((effect: () => unknown) => {
      const result = effect();
      cleanup = isCleanupFn(result) ? result : undefined;
    });

    useRestTimer();

    expect(setIntervalMock).toHaveBeenCalledWith(expect.any(Function), 1000);
    const intervalCallback = setIntervalMock.mock.calls[0]?.[0];
    expect(intervalCallback).toBeDefined();
    intervalCallback?.();
    expect(tick).toHaveBeenCalledTimes(1);

    expect(cleanup).toBeDefined();
    cleanup?.();
    expect(clearIntervalMock).toHaveBeenCalledWith(321);
  });
});
