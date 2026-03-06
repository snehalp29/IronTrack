import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { logoutCurrentSession } from '../auth/auth-service';
import { clearAuthSession } from '../auth/auth-session';
import { useRestTimer } from '../hooks/useRestTimer';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import {
  type ActiveSessionPayload,
  type WorkoutTemplatePayload,
  createExercise,
  deleteCurrentUser,
  deleteWorkoutExercise,
  fetchActiveSession,
  fetchChecklistForDate,
  fetchCurrentUser,
  fetchEquipment,
  fetchMuscleGroups,
  fetchWeeklyProgress,
  fetchWorkoutTemplateById,
  fetchWorkoutTemplates,
  finishWorkoutSession,
  listExercises,
  listWorkoutSessions,
  reorderWorkoutExercises,
  startWorkoutSession,
  swapWorkoutExercise,
  toggleWorkoutSetCompletion,
  updateCurrentUser,
  updateWorkoutExercise,
} from './web-api';

type WizardFormValues = {
  name: string;
  description: string;
  exerciseType: string;
  primaryMuscleGroupId: string;
  secondaryMuscleGroupIds: string[];
  equipmentIds: string[];
  defaultSets: string;
  repMin: string;
  repMax: string;
  defaultCues: string;
};

const WIZARD_STEPS = [
  'Name and description',
  'Exercise type',
  'Primary muscle',
  'Secondary muscles',
  'Equipment',
  'Defaults and cues',
  'Review',
] as const;

const INITIAL_WIZARD_FORM_VALUES: WizardFormValues = {
  name: '',
  description: '',
  exerciseType: 'WEIGHT_REPS',
  primaryMuscleGroupId: '',
  secondaryMuscleGroupIds: [],
  equipmentIds: [],
  defaultSets: '',
  repMin: '',
  repMax: '',
  defaultCues: '',
};

export function useDashboardPageData() {
  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUser,
  });
  const today = getTodayDate(userQuery.data?.timezone);
  const checklistQuery = useQuery({
    queryKey: ['checklist', today],
    queryFn: () => fetchChecklistForDate(today),
  });
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: fetchWorkoutTemplates,
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'dashboard'],
    queryFn: () => listWorkoutSessions({ page: 1, pageSize: 30 }),
  });

  return {
    isLoading:
      userQuery.isLoading ||
      checklistQuery.isLoading ||
      templatesQuery.isLoading ||
      sessionsQuery.isLoading,
    errorMessage:
      asErrorMessage(userQuery.error) ??
      asErrorMessage(checklistQuery.error) ??
      asErrorMessage(templatesQuery.error) ??
      asErrorMessage(sessionsQuery.error),
    checklistCompleteCount:
      checklistQuery.data?.filter((item) => item.isCompleted).length ?? 0,
    checklistTotalCount: checklistQuery.data?.length ?? 0,
    nextTemplate: templatesQuery.data?.[0]
      ? {
          id: templatesQuery.data[0].id,
          name: templatesQuery.data[0].name,
        }
      : undefined,
    workoutStreakDays: computeWorkoutStreakDays(
      sessionsQuery.data?.items ?? [],
      userQuery.data?.timezone,
    ),
  };
}

export function useHistoryPageData() {
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'history'],
    queryFn: () => listWorkoutSessions({ page: 1, pageSize: 20 }),
  });

  return {
    isLoading: sessionsQuery.isLoading,
    errorMessage: asErrorMessage(sessionsQuery.error),
    items:
      sessionsQuery.data?.items.map((item) => ({
        id: item.id,
        startedAt: item.startedAt.slice(0, 10),
        templateName: item.workoutTemplate?.name ?? 'Ad-hoc Workout',
        durationLabel: formatDurationLabel(item.durationSeconds ?? 0),
        volumeLabel: formatNumber(item.totalVolume ?? 0),
      })) ?? [],
  };
}

export function useSettingsPageData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setRestTimerDefault = useActiveWorkoutStore(
    (state) => state.setRestTimerDefault,
  );
  const restTimerDefaultSeconds = useActiveWorkoutStore(
    (state) => state.restTimerDefaultSeconds,
  );
  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUser,
  });
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [unitPreference, setUnitPreference] = useState<'METRIC' | 'IMPERIAL'>(
    'METRIC',
  );
  const [restTimerDefault, setRestTimerDefaultValue] = useState(
    String(restTimerDefaultSeconds),
  );
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    if (!userQuery.data) {
      return;
    }

    setName(userQuery.data.name ?? '');
    setTimezone(userQuery.data.timezone);
    setUnitPreference(userQuery.data.unitPreference);
  }, [userQuery.data]);

  useEffect(() => {
    setRestTimerDefaultValue(String(restTimerDefaultSeconds));
  }, [restTimerDefaultSeconds]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const updated = await updateCurrentUser({
        name: trimmedName || undefined,
        timezone,
        unitPreference,
      });
      setRestTimerDefault(parsePositiveInteger(restTimerDefault, 90));
      await queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      return updated;
    },
    onError: (error) => {
      setErrorMessage(asErrorMessage(error) ?? 'Failed to save settings');
    },
    onSuccess: () => {
      setErrorMessage(undefined);
    },
  });

  return {
    errorMessage: errorMessage ?? asErrorMessage(userQuery.error),
    isSaving: saveMutation.isPending,
    name,
    timezone,
    unitPreference,
    restTimerDefaultSeconds: restTimerDefault,
    timezones: getSupportedTimezones(timezone),
    onNameChange: (event: ChangeEvent<HTMLInputElement>) => {
      setName(event.target.value);
    },
    onTimezoneChange: (event: ChangeEvent<HTMLSelectElement>) => {
      setTimezone(event.target.value);
    },
    onUnitPreferenceChange: (event: ChangeEvent<HTMLSelectElement>) => {
      setUnitPreference(event.target.value as 'METRIC' | 'IMPERIAL');
    },
    onRestTimerDefaultSecondsChange: (event: ChangeEvent<HTMLInputElement>) => {
      setRestTimerDefaultValue(event.target.value);
    },
    onSave: async (event?: FormEvent) => {
      event?.preventDefault();
      try {
        await saveMutation.mutateAsync();
      } catch {
        return;
      }
    },
    onLogout: async () => {
      await logoutCurrentSession();
      navigate('/login');
    },
    onDeleteAccount: async () => {
      await deleteCurrentUser();
      try {
        await logoutCurrentSession();
      } catch {
        // Delete succeeded; clear any remaining local auth state anyway.
      } finally {
        clearAuthSession();
        navigate('/register');
      }
    },
  };
}

export function useWorkoutPreviewPageData(templateId?: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const start = useActiveWorkoutStore((state) => state.start);
  const templateQuery = useQuery({
    enabled: Boolean(templateId),
    queryKey: ['template', templateId],
    queryFn: () => fetchWorkoutTemplateById(templateId ?? ''),
  });
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!templateId) {
        throw new Error('Template not found.');
      }

      return startWorkoutSession({
        workoutTemplateId: templateId,
      });
    },
    onSuccess: async (session) => {
      start(session.id, mapSessionExercises(session), {
        startedAt: session.startedAt,
      });
      await queryClient.invalidateQueries({ queryKey: ['active-session'] });
      navigate('/workout/active');
    },
  });

  return {
    isLoading: templateQuery.isLoading || startMutation.isPending,
    errorMessage: !templateId
      ? 'Template not found.'
      : (asErrorMessage(templateQuery.error) ??
        asErrorMessage(startMutation.error)),
    template: templateQuery.data
      ? {
          id: templateQuery.data.id,
          name: templateQuery.data.name,
          exercises: templateQuery.data.exercises.map((exercise) => ({
            id: exercise.exercise.id,
            name: exercise.exercise.name,
            setsLabel: buildSetsLabel(exercise),
          })),
        }
      : undefined,
    onStartWorkout: async () => {
      await startMutation.mutateAsync();
    },
  };
}

export function useExerciseSelectPageData() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sessionId = useActiveWorkoutStore((state) => state.sessionId);
  const start = useActiveWorkoutStore((state) => state.start);
  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: listExercises,
  });
  const selectedSessionExerciseId = searchParams.get('sessionExerciseId');

  return {
    isLoading: exercisesQuery.isLoading,
    errorMessage: asErrorMessage(exercisesQuery.error),
    items:
      exercisesQuery.data?.items.map((item) => ({
        id: item.id,
        name: item.name,
      })) ?? [],
    onSelectExercise: async (exerciseId: string) => {
      if (sessionId && selectedSessionExerciseId) {
        await swapWorkoutExercise(
          sessionId,
          selectedSessionExerciseId,
          exerciseId,
        );
        const activeSession = await fetchActiveSession();
        if (activeSession) {
          start(activeSession.id, mapSessionExercises(activeSession), {
            startedAt: activeSession.startedAt,
          });
          await queryClient.invalidateQueries({ queryKey: ['active-session'] });
        }
        navigate('/workout/active');
        return;
      }

      navigate(`/exercise/${exerciseId}`);
    },
    onCreateExercise: () => {
      navigate('/exercise/create');
    },
  };
}

export function useCompletionFlowData() {
  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUser,
  });
  const progressQuery = useQuery({
    queryKey: ['progress', 'weekly'],
    queryFn: () => fetchWeeklyProgress(),
  });
  const templatesQuery = useQuery({
    queryKey: ['templates', 'completion'],
    queryFn: fetchWorkoutTemplates,
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'completion'],
    queryFn: () => listWorkoutSessions({ page: 1, pageSize: 30 }),
  });

  const recommendedTemplate = useMemo(() => {
    const template = templatesQuery.data?.[0];
    if (!template) {
      return undefined;
    }

    return {
      id: template.id,
      name: template.name,
      reason: buildRecommendationReason(template, progressQuery.data),
    };
  }, [progressQuery.data, templatesQuery.data]);

  return {
    weeklyCoverageLabel: `Muscle coverage: ${Math.round(
      progressQuery.data?.coveragePercent ?? 0,
    )}%`,
    progressCards:
      progressQuery.data?.perMuscleVolume
        .slice(0, 2)
        .map(
          (item) =>
            `${item.name} ${item.volume >= 0 ? '+' : ''}${Math.round(item.volume)}`,
        ) ?? [],
    recommendedTemplate,
    streakDays: computeWorkoutStreakDays(
      sessionsQuery.data?.items ?? [],
      userQuery.data?.timezone,
    ),
  };
}

export function useExerciseWizardPageData() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStep = Number(searchParams.get('step') ?? '1');
  const step = Number.isFinite(rawStep)
    ? Math.min(WIZARD_STEPS.length, Math.max(1, Math.trunc(rawStep)))
    : 1;
  const [formValues, setFormValues] = useState(INITIAL_WIZARD_FORM_VALUES);
  const [errorMessage, setErrorMessage] = useState<string>();
  const musclesQuery = useQuery({
    queryKey: ['catalog', 'muscles'],
    queryFn: fetchMuscleGroups,
  });
  const equipmentQuery = useQuery({
    queryKey: ['catalog', 'equipment'],
    queryFn: fetchEquipment,
  });
  const createMutation = useMutation({
    mutationFn: async () =>
      createExercise({
        name: formValues.name.trim(),
        description: optionalTrimmed(formValues.description),
        exerciseType: formValues.exerciseType,
        primaryMuscleGroupId: formValues.primaryMuscleGroupId,
        secondaryMuscleGroupIds: formValues.secondaryMuscleGroupIds,
        equipmentIds: formValues.equipmentIds,
        defaultSets: optionalNumber(formValues.defaultSets),
        repMin: optionalNumber(formValues.repMin),
        repMax: optionalNumber(formValues.repMax),
        defaultCues: optionalTrimmed(formValues.defaultCues),
      }),
    onError: (error) => {
      setErrorMessage(asErrorMessage(error) ?? 'Failed to create exercise');
    },
  });

  const updateStep = (nextStep: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(
      'step',
      String(Math.min(WIZARD_STEPS.length, Math.max(1, nextStep))),
    );
    setSearchParams(nextParams, { replace: true });
  };

  return {
    step,
    totalSteps: WIZARD_STEPS.length,
    currentStepLabel: WIZARD_STEPS[step - 1],
    isLoading: musclesQuery.isLoading || equipmentQuery.isLoading,
    isSubmitting: createMutation.isPending,
    isSubmitStep: step === WIZARD_STEPS.length,
    formValues,
    errorMessage:
      errorMessage ??
      asErrorMessage(musclesQuery.error) ??
      asErrorMessage(equipmentQuery.error),
    options: {
      muscleGroups: musclesQuery.data ?? [],
      equipment: equipmentQuery.data ?? [],
    },
    onBack: () => {
      updateStep(step - 1);
    },
    onNext: () => {
      updateStep(step + 1);
    },
    onSubmit: async () => {
      const created = await createMutation.mutateAsync();
      if (created?.id) {
        navigate(`/exercise/${created.id}`);
      }
    },
    onChangeField: <K extends keyof WizardFormValues>(
      field: K,
      value: WizardFormValues[K],
    ) => {
      setFormValues((current) => ({
        ...current,
        [field]: value,
      }));
    },
  };
}

export function useActiveWorkoutPageData() {
  useRestTimer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const state = useActiveWorkoutStore((store) => store.state);
  const sessionId = useActiveWorkoutStore((store) => store.sessionId);
  const startedAt = useActiveWorkoutStore((store) => store.startedAt);
  const start = useActiveWorkoutStore((store) => store.start);
  const exercises = useActiveWorkoutStore((store) => store.exercises);
  const updateSet = useActiveWorkoutStore((store) => store.updateSet);
  const removeExercise = useActiveWorkoutStore((store) => store.removeExercise);
  const reorderExercises = useActiveWorkoutStore(
    (store) => store.reorderExercises,
  );
  const finish = useActiveWorkoutStore((store) => store.finish);
  const restTimerSeconds = useActiveWorkoutStore(
    (store) => store.restTimerSeconds,
  );
  const [errorMessage, setErrorMessage] = useState<string>();
  const [overflowExerciseId, setOverflowExerciseId] = useState<string>();
  const [showOverflow, setShowOverflow] = useState(false);
  const [showReorder, setShowReorder] = useState(false);
  const [showSuperset, setShowSuperset] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [draftOrder, setDraftOrder] = useState<
    Array<{ id: string; name: string; orderIndex: number }>
  >([]);
  const [selectedSupersetExerciseIds, setSelectedSupersetExerciseIds] =
    useState<string[]>([]);
  const activeSessionQuery = useQuery({
    queryKey: ['active-session'],
    queryFn: fetchActiveSession,
  });

  useEffect(() => {
    if (!activeSessionQuery.data) {
      return;
    }

    if (state === 'COMPLETED') {
      return;
    }

    if (activeSessionQuery.data.id === sessionId && startedAt) {
      return;
    }

    start(
      activeSessionQuery.data.id,
      mapSessionExercises(activeSessionQuery.data),
      {
        startedAt: activeSessionQuery.data.startedAt,
      },
    );
  }, [activeSessionQuery.data, sessionId, start, startedAt, state]);

  const totals = useMemo(() => {
    const allSets = exercises.flatMap((exercise) => exercise.sets);
    const completed = allSets.filter((set) => set.isCompleted).length;
    return {
      completed,
      total: allSets.length,
    };
  }, [exercises]);

  const selectedOverflowExercise = exercises.find(
    (exercise) => exercise.id === overflowExerciseId,
  );

  const syncActiveSession = async () => {
    const session = await fetchActiveSession();
    if (session) {
      start(session.id, mapSessionExercises(session), {
        startedAt: session.startedAt,
      });
    }
  };

  return {
    state: state === 'COMPLETED' ? 'IDLE' : state,
    exercises,
    totals,
    restTimerSeconds,
    errorMessage: errorMessage ?? asErrorMessage(activeSessionQuery.error),
    idleActionLabel: 'Choose Workout',
    onIdleAction: () => {
      navigate('/');
    },
    onToggleSet: async (
      sessionExerciseId: string,
      setId: string,
      isCompleted: boolean,
    ) => {
      try {
        const updated = await toggleWorkoutSetCompletion(
          sessionExerciseId,
          setId,
          isCompleted,
        );
        updateSet(sessionExerciseId, setId, {
          durationSeconds: updated.durationSeconds ?? undefined,
          isCompleted: updated.isCompleted,
          reps: updated.reps ?? undefined,
          weight: updated.weight ?? undefined,
        });
      } catch (error) {
        setErrorMessage(asErrorMessage(error) ?? 'Failed to update set');
      }
    },
    onFinishWorkout: async () => {
      if (!sessionId) {
        navigate('/');
        return;
      }

      if (totals.completed < totals.total) {
        setShowIncomplete(true);
        return;
      }

      try {
        const summary = await finishWorkoutSession(sessionId);
        finish({
          totalVolume: summary.totalVolume,
          durationSeconds: summary.durationSeconds ?? 0,
          prs: summary.newPrs.length,
        });
        await queryClient.invalidateQueries({ queryKey: ['sessions'] });
        navigate('/workout/complete');
      } catch (error) {
        setErrorMessage(asErrorMessage(error) ?? 'Failed to finish workout');
      }
    },
    openOverflow: (exerciseId?: string) => {
      setOverflowExerciseId(exerciseId ?? exercises[0]?.id);
      setShowOverflow(true);
    },
    openReorder: () => {
      setDraftOrder(
        exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          orderIndex: exercise.orderIndex,
        })),
      );
      setShowReorder(true);
    },
    openSuperset: () => {
      setSelectedSupersetExerciseIds([]);
      setShowSuperset(true);
    },
    overflow: {
      open: showOverflow,
      exerciseName: selectedOverflowExercise?.name,
      onClose: () => {
        setShowOverflow(false);
      },
      onEditNotes: async () => {
        if (!sessionId || !selectedOverflowExercise) {
          return;
        }

        const nextNotes = globalThis.prompt?.(
          'Exercise notes',
          selectedOverflowExercise.notes ?? '',
        );
        if (nextNotes === undefined || nextNotes === null) {
          return;
        }

        await updateWorkoutExercise(sessionId, selectedOverflowExercise.id, {
          notes: nextNotes,
        });
        await syncActiveSession();
        setShowOverflow(false);
      },
      onSwapExercise: () => {
        if (!selectedOverflowExercise) {
          return;
        }
        navigate(
          `/exercise/select?sessionExerciseId=${encodeURIComponent(
            selectedOverflowExercise.id,
          )}`,
        );
      },
      onDeleteExercise: async () => {
        if (!sessionId || !selectedOverflowExercise) {
          return;
        }

        await deleteWorkoutExercise(sessionId, selectedOverflowExercise.id);
        removeExercise(selectedOverflowExercise.id);
        setShowOverflow(false);
      },
    },
    reorder: {
      open: showReorder,
      exercises: draftOrder,
      onClose: () => {
        setShowReorder(false);
      },
      onMoveUp: (exerciseId: string) => {
        setDraftOrder((current) => moveItem(current, exerciseId, -1));
      },
      onMoveDown: (exerciseId: string) => {
        setDraftOrder((current) => moveItem(current, exerciseId, 1));
      },
      onApply: async () => {
        if (!sessionId) {
          return;
        }
        const items = draftOrder.map((exercise, index) => ({
          id: exercise.id,
          orderIndex: index,
        }));
        await reorderWorkoutExercises(sessionId, items);
        reorderExercises(items);
        setShowReorder(false);
      },
    },
    superset: {
      open: showSuperset,
      exercises: exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
      })),
      selectedExerciseIds: selectedSupersetExerciseIds,
      onClose: () => {
        setShowSuperset(false);
      },
      onToggleExercise: (exerciseId: string) => {
        setSelectedSupersetExerciseIds((current) =>
          current.includes(exerciseId)
            ? current.filter((item) => item !== exerciseId)
            : [...current, exerciseId].slice(0, 4),
        );
      },
      onApply: async () => {
        if (!sessionId || selectedSupersetExerciseIds.length < 2) {
          setShowSuperset(false);
          return;
        }

        const supersetGroupKey = `group-${Date.now()}`;
        await Promise.all(
          exercises.map((exercise) =>
            updateWorkoutExercise(sessionId, exercise.id, {
              supersetGroupKey: selectedSupersetExerciseIds.includes(
                exercise.id,
              )
                ? supersetGroupKey
                : null,
            }),
          ),
        );
        await syncActiveSession();
        setShowSuperset(false);
      },
    },
    incomplete: {
      open: showIncomplete,
      onClose: () => {
        setShowIncomplete(false);
      },
      onConfirm: async () => {
        setShowIncomplete(false);
        await queryClient.invalidateQueries({ queryKey: ['sessions'] });
        await queryClient.invalidateQueries({ queryKey: ['progress'] });
        if (sessionId) {
          try {
            const summary = await finishWorkoutSession(sessionId);
            finish({
              totalVolume: summary.totalVolume,
              durationSeconds: summary.durationSeconds ?? 0,
              prs: summary.newPrs.length,
            });
            navigate('/workout/complete');
          } catch (error) {
            setErrorMessage(
              asErrorMessage(error) ?? 'Failed to finish workout',
            );
          }
        }
      },
    },
  };
}

export function getTodayDate(timezone = 'UTC', now = new Date()): string {
  return formatDateInTimezone(now, timezone);
}

function asErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDurationLabel(totalSeconds: number): string {
  if (!totalSeconds) {
    return '0m';
  }

  return `${Math.max(1, Math.round(totalSeconds / 60))}m`;
}

export function computeWorkoutStreakDays(
  sessions: Array<{
    startedAt: string;
  }>,
  timezone = 'UTC',
): number {
  const uniqueDays = Array.from(
    new Set(
      sessions
        .map((session) => formatDateInTimezone(session.startedAt, timezone))
        .sort((left, right) => right.localeCompare(left)),
    ),
  );

  if (uniqueDays.length === 0) {
    return 0;
  }

  let streak = 1;
  for (let index = 1; index < uniqueDays.length; index += 1) {
    const difference = differenceInWholeDays(
      uniqueDays[index - 1],
      uniqueDays[index],
    );
    if (difference !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
}

function formatDateInTimezone(value: Date | string, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Could not format date in timezone');
  }

  return `${year}-${month}-${day}`;
}

function differenceInWholeDays(
  leftDateKey: string,
  rightDateKey: string,
): number {
  const left = parseDateKey(leftDateKey);
  const right = parseDateKey(rightDateKey);
  return (left.getTime() - right.getTime()) / (24 * 60 * 60 * 1000);
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map((value) => Number(value));
  return new Date(Date.UTC(year, month - 1, day));
}

function buildSetsLabel(
  exercise: WorkoutTemplatePayload['exercises'][number],
): string {
  const defaultSets = exercise.defaultSets ?? 3;
  if (
    typeof exercise.repMin === 'number' &&
    typeof exercise.repMax === 'number'
  ) {
    return `${defaultSets} x ${exercise.repMin}-${exercise.repMax}`;
  }
  if (typeof exercise.repMin === 'number') {
    return `${defaultSets} x ${exercise.repMin}`;
  }

  return `${defaultSets} sets`;
}

function buildRecommendationReason(
  template: WorkoutTemplatePayload,
  progress: Awaited<ReturnType<typeof fetchWeeklyProgress>> | undefined,
): string {
  if (!progress || template.exercises.length === 0) {
    return 'balances your upcoming training week';
  }

  const leastCoveredMuscle = progress.perMuscleVolume
    .slice()
    .sort((left, right) => left.volume - right.volume)[0];

  if (!leastCoveredMuscle) {
    return 'balances your upcoming training week';
  }

  return `targets underworked ${leastCoveredMuscle.name.toLowerCase()}`;
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalTrimmed(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSupportedTimezones(currentTimezone: string): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    }
  ).supportedValuesOf;
  const timezones = supportedValuesOf
    ? supportedValuesOf('timeZone')
    : ['UTC', 'America/New_York', 'America/Los_Angeles'];

  return Array.from(new Set([currentTimezone, ...timezones]));
}

function mapSessionExercises(session: ActiveSessionPayload) {
  return session.sessionExercises.map((exercise) => ({
    id: exercise.id,
    exerciseTemplateId: exercise.exerciseTemplateId,
    name: exercise.exercise.name,
    notes: exercise.notes ?? undefined,
    orderIndex: exercise.orderIndex,
    supersetGroupKey: exercise.supersetGroupKey ?? undefined,
    sets: exercise.sets.map((set) => ({
      id: set.id,
      orderIndex: set.orderIndex,
      durationSeconds: set.durationSeconds ?? undefined,
      isCompleted: set.isCompleted,
      reps: set.reps ?? undefined,
      weight: set.weight ?? undefined,
    })),
  }));
}

function moveItem<T extends { id: string }>(
  items: T[],
  targetId: string,
  direction: -1 | 1,
): T[] {
  const index = items.findIndex((item) => item.id === targetId);
  const nextIndex = index + direction;

  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const cloned = items.slice();
  const [target] = cloned.splice(index, 1);
  if (!target) {
    return items;
  }
  cloned.splice(nextIndex, 0, target);
  return cloned.map((item, itemIndex) => ({
    ...item,
    orderIndex: itemIndex,
  }));
}
