import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { logoutCurrentSession } from '../auth/auth-service';
import { clearAuthSession } from '../auth/auth-session';
import { useRestTimer } from '../hooks/useRestTimer';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';
import {
  type ActiveSessionPayload,
  type WorkoutTemplatePayload,
  applyWorkoutSuperset,
  createExercise,
  createWorkoutTemplate,
  deleteCurrentUser,
  deleteWorkoutExercise,
  fetchActiveSession,
  fetchChecklistForDate,
  fetchCurrentUser,
  fetchEquipment,
  fetchExerciseById,
  fetchExerciseHistory,
  fetchMuscleGroups,
  fetchWeeklyProgress,
  fetchWorkoutStreak,
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

type TemplateBuilderExerciseForm = {
  id: string;
  name: string;
  selected: boolean;
  defaultSets: string;
  repMin: string;
  repMax: string;
  supersetGroupKey: string;
};

type TemplateBuilderFormValues = {
  step: number;
  name: string;
  description: string;
  exercises: TemplateBuilderExerciseForm[];
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

const TEMPLATE_BUILDER_STEPS = [
  'Template Name',
  'Select exercises and set defaults',
  'Superset and order review',
  'Final review and notes',
] as const;

const SUPPORTED_TIMEZONES = resolveSupportedTimezones();

export function useDashboardPageData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const start = useActiveWorkoutStore((state) => state.start);
  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUser,
  });
  const today = userQuery.data ? getTodayDate(userQuery.data.timezone) : null;
  const checklistQuery = useQuery({
    enabled: Boolean(today),
    queryKey: ['checklist', today ?? 'pending'],
    queryFn: () => fetchChecklistForDate(today ?? getTodayDate('UTC')),
  });
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: fetchWorkoutTemplates,
  });
  const streakQuery = useQuery({
    queryKey: ['streak', 'workout'],
    queryFn: fetchWorkoutStreak,
  });
  const nextTemplate = templatesQuery.data?.[0]
    ? {
        id: templatesQuery.data[0].id,
        name: templatesQuery.data[0].name,
      }
    : undefined;
  const startMutation = useMutation({
    mutationFn: async () => {
      if (!nextTemplate) {
        throw new Error('Template not found.');
      }

      return startWorkoutSession({
        workoutTemplateId: nextTemplate.id,
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
    isLoading:
      userQuery.isLoading ||
      checklistQuery.isLoading ||
      templatesQuery.isLoading ||
      streakQuery.isLoading ||
      startMutation.isPending,
    errorMessage:
      asErrorMessage(userQuery.error) ??
      asErrorMessage(checklistQuery.error) ??
      asErrorMessage(templatesQuery.error) ??
      asErrorMessage(streakQuery.error) ??
      asErrorMessage(startMutation.error),
    checklistCompleteCount:
      checklistQuery.data?.filter((item) => item.isCompleted).length ?? 0,
    checklistTotalCount: checklistQuery.data?.length ?? 0,
    nextTemplate,
    onStartNextWorkout: async () => {
      if (!nextTemplate) {
        navigate('/workout/template/new');
        return;
      }

      try {
        await startMutation.mutateAsync();
      } catch {
        return;
      }
    },
    workoutStreakDays: streakQuery.data?.currentStreakDays ?? 0,
  };
}

export function useHistoryPageData() {
  const userQuery = useQuery({
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUser,
  });
  const sessionsQuery = useQuery({
    queryKey: ['sessions', 'history'],
    queryFn: async () => {
      const firstPage = await listWorkoutSessions({
        page: 1,
        pageSize: 20,
        status: 'FINISHED',
      });
      const totalPages = Math.ceil(
        firstPage.pagination.total / firstPage.pagination.pageSize,
      );
      if (totalPages <= 1) {
        return firstPage;
      }

      const remainingPages = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
          listWorkoutSessions({
            page: index + 2,
            pageSize: firstPage.pagination.pageSize,
            status: 'FINISHED',
          }),
        ),
      );

      return {
        ...firstPage,
        items: [
          ...firstPage.items,
          ...remainingPages.flatMap((page) => page.items),
        ],
      };
    },
  });

  return {
    isLoading: userQuery.isLoading || sessionsQuery.isLoading,
    errorMessage:
      asErrorMessage(userQuery.error) ?? asErrorMessage(sessionsQuery.error),
    items:
      sessionsQuery.data?.items.map((item) => ({
        id: item.id,
        startedAt: formatDateInTimezone(
          item.startedAt,
          userQuery.data?.timezone ?? 'UTC',
        ),
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
  const [savedSettings, setSavedSettings] = useState(() => ({
    name: '',
    timezone: 'UTC',
    unitPreference: 'METRIC' as 'METRIC' | 'IMPERIAL',
    restTimerDefault: String(restTimerDefaultSeconds),
  }));
  const [errorMessage, setErrorMessage] = useState<string>();
  const hasLocalSettingsEditsRef = useRef(false);
  const hasHydratedProfileRef = useRef(false);
  const hasHydratedRestTimerRef = useRef(false);

  useEffect(() => {
    if (
      !userQuery.data ||
      hasLocalSettingsEditsRef.current ||
      hasHydratedProfileRef.current
    ) {
      return;
    }

    setName(userQuery.data.name ?? '');
    setTimezone(userQuery.data.timezone);
    setUnitPreference(userQuery.data.unitPreference);
    setSavedSettings((current) => ({
      ...current,
      name: userQuery.data.name ?? '',
      timezone: userQuery.data.timezone,
      unitPreference: userQuery.data.unitPreference,
    }));
    hasHydratedProfileRef.current = true;
  }, [userQuery.data]);

  useEffect(() => {
    const nextValue = String(restTimerDefaultSeconds);
    if (hasLocalSettingsEditsRef.current || hasHydratedRestTimerRef.current) {
      return;
    }

    setRestTimerDefaultValue(nextValue);
    setSavedSettings((current) => ({
      ...current,
      restTimerDefault: nextValue,
    }));
    hasHydratedRestTimerRef.current = true;
  }, [restTimerDefaultSeconds]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = name.trim();
      const parsedRestTimerDefault = parsePositiveInteger(restTimerDefault, 90);
      const updated = await updateCurrentUser({
        name: trimmedName || undefined,
        timezone,
        unitPreference,
      });
      setRestTimerDefault(parsedRestTimerDefault);
      hasLocalSettingsEditsRef.current = false;
      hasHydratedProfileRef.current = true;
      hasHydratedRestTimerRef.current = true;
      setName(updated.name ?? '');
      setTimezone(updated.timezone);
      setUnitPreference(updated.unitPreference);
      setRestTimerDefaultValue(String(parsedRestTimerDefault));
      setSavedSettings({
        name: updated.name ?? '',
        timezone: updated.timezone,
        unitPreference: updated.unitPreference,
        restTimerDefault: String(parsedRestTimerDefault),
      });
      queryClient.setQueryData(['user', 'me'], updated);
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

  const trimmedName = name.trim();
  const savedName = savedSettings.name.trim();
  const isDirty =
    trimmedName !== savedName ||
    timezone !== savedSettings.timezone ||
    unitPreference !== savedSettings.unitPreference ||
    restTimerDefault !== savedSettings.restTimerDefault;

  return {
    errorMessage: errorMessage ?? asErrorMessage(userQuery.error),
    isDirty,
    isSaving: saveMutation.isPending,
    name,
    timezone,
    unitPreference,
    restTimerDefaultSeconds: restTimerDefault,
    timezones: getSupportedTimezones(timezone),
    onNameChange: (event: ChangeEvent<HTMLInputElement>) => {
      hasLocalSettingsEditsRef.current = true;
      setName(event.target.value);
    },
    onTimezoneChange: (event: ChangeEvent<HTMLSelectElement>) => {
      hasLocalSettingsEditsRef.current = true;
      setTimezone(event.target.value);
    },
    onUnitPreferenceChange: (event: ChangeEvent<HTMLSelectElement>) => {
      hasLocalSettingsEditsRef.current = true;
      setUnitPreference(event.target.value as 'METRIC' | 'IMPERIAL');
    },
    onRestTimerDefaultSecondsChange: (event: ChangeEvent<HTMLInputElement>) => {
      hasLocalSettingsEditsRef.current = true;
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
      try {
        await logoutCurrentSession();
        navigate('/login');
      } catch (error) {
        setErrorMessage(asErrorMessage(error) ?? 'Failed to log out');
      }
    },
    onDeleteAccount: async () => {
      try {
        await deleteCurrentUser();
      } catch (error) {
        setErrorMessage(asErrorMessage(error) ?? 'Failed to delete account');
        return;
      }

      try {
        await logoutCurrentSession();
      } catch {
        // Delete succeeded; clear any remaining local auth state anyway.
      }

      clearAuthSession();
      navigate('/register');
    },
  };
}

export function useTemplateBuilderPageData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: listExercises,
  });
  const [formValues, setFormValues] = useState<TemplateBuilderFormValues>({
    description: '',
    exercises: [],
    name: '',
    step: 1,
  });
  const [errorMessage, setErrorMessage] = useState<string>();
  const createMutation = useMutation({
    mutationFn: async () =>
      createWorkoutTemplate({
        description: optionalTrimmed(formValues.description),
        exercises: formValues.exercises
          .filter((exercise) => exercise.selected)
          .map((exercise, index) => ({
            defaultSets: optionalNumber(exercise.defaultSets),
            exerciseTemplateId: exercise.id,
            orderIndex: index,
            repMax: optionalNumber(exercise.repMax),
            repMin: optionalNumber(exercise.repMin),
            supersetGroupKey: optionalTrimmed(exercise.supersetGroupKey),
          })),
        name: formValues.name.trim(),
      }),
    onError: (error) => {
      setErrorMessage(asErrorMessage(error) ?? 'Failed to create template');
    },
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({ queryKey: ['templates'] });
      navigate(`/workout/${template.id}/preview`);
    },
  });

  useEffect(() => {
    if (!exercisesQuery.data?.items.length) {
      return;
    }

    setFormValues((current) => {
      const knownIds = new Set(
        current.exercises.map((exercise) => exercise.id),
      );
      const additions = exercisesQuery.data.items
        .filter((exercise) => !knownIds.has(exercise.id))
        .map((exercise) => ({
          defaultSets: '',
          id: exercise.id,
          name: exercise.name,
          repMax: '',
          repMin: '',
          selected: false,
          supersetGroupKey: '',
        }));

      return additions.length
        ? {
            ...current,
            exercises: [...current.exercises, ...additions],
          }
        : current;
    });
  }, [exercisesQuery.data]);

  const validateTemplateBuilderStep = (
    targetStep = formValues.step,
  ): string | undefined => {
    if (targetStep === 1 && formValues.name.trim().length === 0) {
      return 'Template name is required';
    }
    if (targetStep === 1 && formValues.name.trim().length < 2) {
      return 'Template name must be at least 2 characters';
    }

    const selectedExercises = formValues.exercises.filter(
      (exercise) => exercise.selected,
    );
    if (targetStep >= 2 && selectedExercises.length === 0) {
      return 'Select at least one exercise';
    }

    for (const exercise of selectedExercises) {
      if (
        exercise.repMin.trim() &&
        exercise.repMax.trim() &&
        Number(exercise.repMin) > Number(exercise.repMax)
      ) {
        return `Rep max for ${exercise.name} must be greater than or equal to rep min`;
      }
    }

    return undefined;
  };

  return {
    currentStepLabel: TEMPLATE_BUILDER_STEPS[formValues.step - 1],
    description: formValues.description,
    errorMessage: errorMessage ?? asErrorMessage(exercisesQuery.error),
    exercises: formValues.exercises,
    isLoading: exercisesQuery.isLoading,
    isSubmitting: createMutation.isPending,
    isSubmitStep: formValues.step === TEMPLATE_BUILDER_STEPS.length,
    name: formValues.name,
    step: formValues.step,
    totalSteps: TEMPLATE_BUILDER_STEPS.length,
    onBack: () => {
      setErrorMessage(undefined);
      setFormValues((current) => ({
        ...current,
        step: Math.max(1, current.step - 1),
      }));
    },
    onChangeDescription: (value: string) => {
      setErrorMessage(undefined);
      setFormValues((current) => ({
        ...current,
        description: value,
      }));
    },
    onChangeExerciseField: (
      exerciseId: string,
      field: 'defaultSets' | 'repMin' | 'repMax' | 'supersetGroupKey',
      value: string,
    ) => {
      setErrorMessage(undefined);
      setFormValues((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                [field]: value,
              }
            : exercise,
        ),
      }));
    },
    onChangeName: (value: string) => {
      setErrorMessage(undefined);
      setFormValues((current) => ({
        ...current,
        name: value,
      }));
    },
    onMoveExercise: (exerciseId: string, direction: -1 | 1) => {
      setFormValues((current) => {
        return {
          ...current,
          exercises: moveItem(current.exercises, exerciseId, direction),
        };
      });
    },
    onNext: () => {
      const validationMessage = validateTemplateBuilderStep();
      if (validationMessage) {
        setErrorMessage(validationMessage);
        return;
      }
      setErrorMessage(undefined);
      setFormValues((current) => ({
        ...current,
        step: Math.min(TEMPLATE_BUILDER_STEPS.length, current.step + 1),
      }));
    },
    onSubmit: async () => {
      const validationMessage = validateTemplateBuilderStep(
        TEMPLATE_BUILDER_STEPS.length,
      );
      if (validationMessage) {
        setErrorMessage(validationMessage);
        return;
      }

      try {
        await createMutation.mutateAsync();
      } catch {
        return;
      }
    },
    onToggleExercise: (exerciseId: string) => {
      setErrorMessage(undefined);
      setFormValues((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? { ...exercise, selected: !exercise.selected }
            : exercise,
        ),
      }));
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
      try {
        await startMutation.mutateAsync();
      } catch {
        return;
      }
    },
  };
}

export function useExerciseSelectPageData() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const sessionId = useActiveWorkoutStore((state) => state.sessionId);
  const syncFromServer = useActiveWorkoutStore((state) => state.syncFromServer);
  const [errorMessage, setErrorMessage] = useState<string>();
  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: listExercises,
  });
  const selectedSessionExerciseId = searchParams.get('sessionExerciseId');

  return {
    isLoading: exercisesQuery.isLoading,
    errorMessage: errorMessage ?? asErrorMessage(exercisesQuery.error),
    items:
      exercisesQuery.data?.items.map((item) => ({
        id: item.id,
        name: item.name,
      })) ?? [],
    onSelectExercise: async (exerciseId: string) => {
      setErrorMessage(undefined);

      try {
        if (sessionId && selectedSessionExerciseId) {
          await swapWorkoutExercise(
            sessionId,
            selectedSessionExerciseId,
            exerciseId,
          );
          const activeSession = await fetchActiveSession();
          queryClient.setQueryData(['active-session'], activeSession ?? null);
          if (activeSession) {
            syncFromServer(
              activeSession.id,
              mapSessionExercises(activeSession),
              {
                startedAt: activeSession.startedAt,
              },
            );
            await queryClient.invalidateQueries({
              queryKey: ['active-session'],
            });
            navigate('/workout/active');
            return;
          }

          setErrorMessage('Workout session is no longer available');
          return;
        }

        navigate(`/exercise/${exerciseId}`);
      } catch (error) {
        setErrorMessage(asErrorMessage(error) ?? 'Failed to update exercise');
      }
    },
    onCreateExercise: () => {
      navigate('/exercise/create');
    },
  };
}

export function useCompletionFlowData() {
  const progressQuery = useQuery({
    queryKey: ['progress', 'weekly'],
    queryFn: () => fetchWeeklyProgress(),
  });
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: fetchWorkoutTemplates,
  });
  const streakQuery = useQuery({
    queryKey: ['streak', 'workout'],
    queryFn: fetchWorkoutStreak,
  });

  const recommendedTemplate = useMemo(() => {
    const template = selectRecommendedTemplate(
      templatesQuery.data ?? [],
      progressQuery.data,
    );
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
    streakDays: streakQuery.data?.currentStreakDays ?? 0,
  };
}

export function useExerciseDetailPageData() {
  const { id: exerciseId } = useParams<{ id: string }>();
  const userQuery = useQuery({
    enabled: Boolean(exerciseId),
    queryKey: ['user', 'me'],
    queryFn: fetchCurrentUser,
  });
  const exerciseQuery = useQuery({
    enabled: Boolean(exerciseId),
    queryKey: ['exercise', exerciseId, 'detail'],
    queryFn: () => fetchExerciseById(exerciseId ?? ''),
  });
  const historyQuery = useQuery({
    enabled: Boolean(exerciseId),
    queryKey: ['exercise', exerciseId, 'history'],
    queryFn: () => fetchExerciseHistory(exerciseId ?? ''),
  });

  return {
    isLoading:
      Boolean(exerciseId) &&
      (userQuery.isLoading ||
        exerciseQuery.isLoading ||
        historyQuery.isLoading),
    errorMessage: !exerciseId
      ? 'Exercise not found.'
      : (asErrorMessage(exerciseQuery.error) ??
        asErrorMessage(historyQuery.error) ??
        asErrorMessage(userQuery.error)),
    exercise: exerciseQuery.data
      ? {
          defaultSetsLabel: buildDefaultSetsLabel(
            exerciseQuery.data.defaultSets,
          ),
          description:
            exerciseQuery.data.description ?? 'No description available.',
          equipment: exerciseQuery.data.equipment.map(
            (item) => item.equipment.name,
          ),
          exerciseTypeLabel: formatExerciseTypeLabel(
            exerciseQuery.data.exerciseType,
          ),
          name: exerciseQuery.data.name,
          note:
            exerciseQuery.data.notes[0]?.note ??
            exerciseQuery.data.defaultCues ??
            undefined,
          primaryMuscle: exerciseQuery.data.primaryMuscle?.name ?? 'Unassigned',
          repRangeLabel: buildRepRangeLabel(
            exerciseQuery.data.repMin,
            exerciseQuery.data.repMax,
          ),
          secondaryMuscles: exerciseQuery.data.secondaryMuscles.map(
            (item) => item.muscleGroup.name,
          ),
        }
      : undefined,
    historyItems:
      historyQuery.data?.items.map((item) => ({
        id: item.id,
        performanceLabel: buildPerformanceLabel(item),
        startedAt: formatDateInTimezone(
          item.sessionExercise.session.startedAt,
          userQuery.data?.timezone ?? 'UTC',
        ),
      })) ?? [],
  };
}

export function useExerciseWizardPageData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  useEffect(() => {
    const stepParam = searchParams.get('step');
    const normalizedStep = String(step);

    if (stepParam === normalizedStep) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', normalizedStep);
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams, step]);

  const updateStep = (nextStep: number) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(
      'step',
      String(Math.min(WIZARD_STEPS.length, Math.max(1, nextStep))),
    );
    setSearchParams(nextParams, { replace: true });
  };

  const validateCurrentStep = (targetStep = step): string | undefined => {
    if (targetStep === 1 && formValues.name.trim().length === 0) {
      return 'Exercise name is required';
    }
    if (targetStep === 1 && formValues.name.trim().length < 2) {
      return 'Exercise name must be at least 2 characters';
    }
    if (targetStep === 3 && !formValues.primaryMuscleGroupId) {
      return 'Primary muscle is required';
    }
    if (
      targetStep === WIZARD_STEPS.length &&
      formValues.name.trim().length < 2
    ) {
      return 'Exercise name must be at least 2 characters';
    }
    if (
      targetStep === WIZARD_STEPS.length &&
      !formValues.primaryMuscleGroupId
    ) {
      return 'Primary muscle is required';
    }
    if (
      formValues.repMin.trim() &&
      formValues.repMax.trim() &&
      Number(formValues.repMin) > Number(formValues.repMax)
    ) {
      return 'Rep max must be greater than or equal to rep min';
    }

    return undefined;
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
      setErrorMessage(undefined);
      updateStep(step - 1);
    },
    onNext: () => {
      const validationMessage = validateCurrentStep();
      if (validationMessage) {
        setErrorMessage(validationMessage);
        return;
      }
      setErrorMessage(undefined);
      updateStep(step + 1);
    },
    onSubmit: async () => {
      const validationMessage = validateCurrentStep(WIZARD_STEPS.length);
      if (validationMessage) {
        setErrorMessage(validationMessage);
        return;
      }

      try {
        const created = await createMutation.mutateAsync();
        if (created?.id) {
          await queryClient.invalidateQueries({ queryKey: ['exercises'] });
          navigate(`/exercise/${created.id}`);
        }
      } catch {
        return;
      }
    },
    onChangeField: <K extends keyof WizardFormValues>(
      field: K,
      value: WizardFormValues[K],
    ) => {
      setErrorMessage(undefined);
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
  const clearWorkout = useActiveWorkoutStore((store) => store.clear);
  const sessionId = useActiveWorkoutStore((store) => store.sessionId);
  const syncFromServer = useActiveWorkoutStore((store) => store.syncFromServer);
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
  const [showNotes, setShowNotes] = useState(false);
  const [notesErrorMessage, setNotesErrorMessage] = useState<string>();
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState('');
  const activeSessionQuery = useQuery({
    queryKey: ['active-session'],
    queryFn: fetchActiveSession,
  });

  useEffect(() => {
    if (state === 'COMPLETED') {
      return;
    }

    if (activeSessionQuery.isSuccess && activeSessionQuery.data === null) {
      if (state !== 'IDLE') {
        clearWorkout();
        setErrorMessage('Workout session is no longer available');
      }
      return;
    }

    if (!activeSessionQuery.data) {
      return;
    }

    const mappedExercises = mapSessionExercises(activeSessionQuery.data);
    if (activeSessionQuery.data.id === sessionId && startedAt) {
      syncFromServer(activeSessionQuery.data.id, mappedExercises, {
        startedAt: activeSessionQuery.data.startedAt,
      });
      return;
    }

    start(activeSessionQuery.data.id, mappedExercises, {
      startedAt: activeSessionQuery.data.startedAt,
    });
  }, [
    activeSessionQuery.data,
    activeSessionQuery.isSuccess,
    clearWorkout,
    sessionId,
    start,
    startedAt,
    state,
    syncFromServer,
  ]);

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
    queryClient.setQueryData(['active-session'], session ?? null);
    if (!session) {
      clearWorkout();
      setErrorMessage('Workout session is no longer available');
      return;
    }

    syncFromServer(session.id, mapSessionExercises(session), {
      startedAt: session.startedAt,
    });
  };

  const invalidateFinishedWorkoutQueries = async () => {
    queryClient.setQueryData(['active-session'], null);
    await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    await queryClient.invalidateQueries({ queryKey: ['active-session'] });
    await queryClient.invalidateQueries({ queryKey: ['streak', 'workout'] });
    await queryClient.invalidateQueries({ queryKey: ['progress'] });
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
      const previousSet = exercises
        .find((exercise) => exercise.id === sessionExerciseId)
        ?.sets.find((set) => set.id === setId);
      if (!previousSet) {
        return;
      }

      updateSet(sessionExerciseId, setId, {
        isCompleted,
      });
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
        updateSet(sessionExerciseId, setId, {
          durationSeconds: previousSet.durationSeconds,
          isCompleted: previousSet.isCompleted,
          reps: previousSet.reps,
          weight: previousSet.weight,
        });
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
        await invalidateFinishedWorkoutQueries();
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
        setNotesErrorMessage(undefined);
        setNotesDraft(selectedOverflowExercise.notes ?? '');
        setShowNotes(true);
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
        try {
          await deleteWorkoutExercise(sessionId, selectedOverflowExercise.id);
          removeExercise(selectedOverflowExercise.id);
          setShowOverflow(false);
        } catch (error) {
          setErrorMessage(asErrorMessage(error) ?? 'Failed to remove exercise');
        }
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
        try {
          await reorderWorkoutExercises(sessionId, items);
          reorderExercises(items);
          setShowReorder(false);
        } catch (error) {
          setErrorMessage(
            asErrorMessage(error) ?? 'Failed to reorder exercises',
          );
        }
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
        try {
          const session = await applyWorkoutSuperset(
            sessionId,
            selectedSupersetExerciseIds,
          );
          syncFromServer(session.id, mapSessionExercises(session), {
            startedAt: session.startedAt,
          });
          setShowSuperset(false);
        } catch (error) {
          setErrorMessage(asErrorMessage(error) ?? 'Failed to update superset');
        }
      },
    },
    notes: {
      open: showNotes,
      exerciseName: selectedOverflowExercise?.name,
      errorMessage: notesErrorMessage,
      isSaving: isSavingNotes,
      notes: notesDraft,
      onChange: (value: string) => {
        setNotesDraft(value);
      },
      onClose: () => {
        setNotesErrorMessage(undefined);
        setShowNotes(false);
      },
      onSave: async () => {
        if (!sessionId || !selectedOverflowExercise) {
          return;
        }

        try {
          setNotesErrorMessage(undefined);
          setIsSavingNotes(true);
          await updateWorkoutExercise(sessionId, selectedOverflowExercise.id, {
            notes: notesDraft,
          });
          await syncActiveSession();
          setShowNotes(false);
        } catch (error) {
          setNotesErrorMessage(asErrorMessage(error) ?? 'Failed to save notes');
        } finally {
          setIsSavingNotes(false);
        }
      },
    },
    incomplete: {
      open: showIncomplete,
      onClose: () => {
        setShowIncomplete(false);
      },
      onConfirm: async () => {
        setShowIncomplete(false);
        if (sessionId) {
          try {
            const summary = await finishWorkoutSession(sessionId);
            finish({
              totalVolume: summary.totalVolume,
              durationSeconds: summary.durationSeconds ?? 0,
              prs: summary.newPrs.length,
            });
            await invalidateFinishedWorkoutQueries();
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

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDurationLabel(totalSeconds: number): string {
  if (!totalSeconds) {
    return '0m';
  }

  if (totalSeconds < 60) {
    return `${Math.max(1, Math.round(totalSeconds))}s`;
  }

  const totalMinutes = Math.round(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatDateInTimezone(value: Date | string, timezone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  const formatter = createDateFormatter(timezone) ?? createDateFormatter('UTC');
  if (!formatter) {
    return date.toISOString().slice(0, 10);
  }
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
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

function buildDefaultSetsLabel(defaultSets?: number | null): string {
  return `${defaultSets ?? 3} sets`;
}

function buildRepRangeLabel(
  repMin?: number | null,
  repMax?: number | null,
): string {
  if (typeof repMin === 'number' && typeof repMax === 'number') {
    return `${repMin}-${repMax} reps`;
  }
  if (typeof repMin === 'number') {
    return `${repMin}+ reps`;
  }
  if (typeof repMax === 'number') {
    return `Up to ${repMax} reps`;
  }

  return 'Rep range not set';
}

function buildPerformanceLabel(item: {
  reps?: number | null;
  weight?: number | null;
  durationSeconds?: number | null;
}): string {
  if (typeof item.weight === 'number' && typeof item.reps === 'number') {
    return `${item.weight} x ${item.reps}`;
  }
  if (typeof item.reps === 'number') {
    return `${item.reps} reps`;
  }
  if (typeof item.durationSeconds === 'number') {
    return `${item.durationSeconds}s`;
  }

  return 'Logged set';
}

function formatExerciseTypeLabel(exerciseType: string): string {
  const explicitLabel = EXERCISE_TYPE_LABELS[exerciseType];
  if (explicitLabel) {
    return explicitLabel;
  }

  return exerciseType
    .split('_')
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment[0]}${segment.slice(1).toLowerCase()}`)
    .join(' ');
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

function selectRecommendedTemplate(
  templates: WorkoutTemplatePayload[],
  progress: Awaited<ReturnType<typeof fetchWeeklyProgress>> | undefined,
): WorkoutTemplatePayload | undefined {
  const [firstTemplate] = templates;
  if (!firstTemplate || !progress) {
    return firstTemplate;
  }

  const rankedMuscles = progress.perMuscleVolume
    .slice()
    .sort((left, right) => left.volume - right.volume)
    .map((item) => item.name.toLowerCase());

  let selectedTemplate = firstTemplate;
  let selectedScore = Number.POSITIVE_INFINITY;

  for (const template of templates) {
    const coverage = new Set(
      (template.muscleCoverage ?? []).map((muscle) => muscle.toLowerCase()),
    );
    const score = rankedMuscles.findIndex((muscle) => coverage.has(muscle));
    const normalizedScore = score === -1 ? Number.POSITIVE_INFINITY : score;

    if (normalizedScore < selectedScore) {
      selectedTemplate = template;
      selectedScore = normalizedScore;
    }
  }

  return selectedTemplate;
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
  const normalizedTimezone = isValidTimezone(currentTimezone)
    ? currentTimezone
    : 'UTC';
  const cached = SUPPORTED_TIMEZONE_CACHE.get(normalizedTimezone);
  if (cached) {
    return cached;
  }

  const value = Array.from(
    new Set([normalizedTimezone, ...SUPPORTED_TIMEZONES]),
  );
  SUPPORTED_TIMEZONE_CACHE.set(normalizedTimezone, value);
  return value;
}

function resolveSupportedTimezones(): string[] {
  const supportedValuesOf = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: 'timeZone') => string[];
    }
  ).supportedValuesOf;
  const timezones = supportedValuesOf
    ? supportedValuesOf('timeZone')
    : ['America/New_York', 'America/Los_Angeles'];

  return Array.from(new Set(['UTC', ...timezones]));
}

const SUPPORTED_TIMEZONE_CACHE = new Map<string, string[]>();
const EXERCISE_TYPE_LABELS: Record<string, string> = {
  BODYWEIGHT: 'Bodyweight',
  BODYWEIGHT_PLUS_WEIGHT: 'Bodyweight + Weight',
  DURATION: 'Duration',
  REPS_ONLY: 'Reps Only',
  WEIGHT_REPS: 'Weight + Reps',
};

function createDateFormatter(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return undefined;
  }
}

function isValidTimezone(timezone: string): boolean {
  return Boolean(createDateFormatter(timezone));
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
