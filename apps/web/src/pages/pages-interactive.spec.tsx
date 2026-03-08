import type { ReactNode } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findButtonByLabel,
  findElement,
  findForm,
  nodeText,
} from '../testing/react-tree';
import { ExerciseDetailPage } from './ExerciseDetailPage';
import { ExerciseWizardPage } from './ExerciseWizardPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import {
  TOTAL_TEMPLATE_STEPS,
  TemplateBuilderPage,
} from './TemplateBuilderPage';

const submittedValuesState = vi.hoisted(() => ({
  value: {} as Record<string, unknown>,
}));
const useStateMock = vi.hoisted(() => vi.fn());
const useEffectMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const setSearchParamsMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));
const formStateState = vi.hoisted(() => ({
  value: {
    errors: {} as Record<string, { message?: string }>,
    isSubmitting: false,
  },
}));
const registerMock = vi.hoisted(() => vi.fn(() => ({})));
const watchMock = vi.hoisted(() =>
  vi.fn((field: string) => submittedValuesState.value[field]),
);
const clearErrorsMock = vi.hoisted(() => vi.fn());
const handleSubmitMock = vi.hoisted(() =>
  vi.fn(
    (onValid: (values: Record<string, unknown>) => unknown) =>
      (event?: { preventDefault?: () => void }) => {
        event?.preventDefault?.();
        return onValid(submittedValuesState.value);
      },
  ),
);
const setErrorMock = vi.hoisted(() => vi.fn());
const useFormMock = vi.hoisted(() =>
  vi.fn(() => ({
    clearErrors: clearErrorsMock,
    formState: formStateState.value,
    handleSubmit: handleSubmitMock,
    register: registerMock,
    setError: setErrorMock,
    watch: watchMock,
  })),
);
const loginWithPasswordMock = vi.hoisted(() => vi.fn());
const registerWithPasswordMock = vi.hoisted(() => vi.fn());
const signInWithGoogleMock = vi.hoisted(() => vi.fn());
const useExerciseDetailPageDataMock = vi.hoisted(() => vi.fn());
const useTemplateBuilderPageDataMock = vi.hoisted(() => vi.fn());
const useExerciseWizardPageDataMock = vi.hoisted(() => vi.fn());
const useSettingsPageDataMock = vi.hoisted(() => vi.fn());

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: useEffectMock,
    useState: useStateMock,
  };
});

vi.mock('react-router-dom', () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => navigateMock,
  useSearchParams: () => [searchParamsState.value, setSearchParamsMock],
}));

vi.mock('react-hook-form', () => ({
  useForm: useFormMock,
}));

vi.mock('../auth/auth-service', () => ({
  loginWithPassword: loginWithPasswordMock,
  registerWithPassword: registerWithPasswordMock,
  signInWithGoogle: signInWithGoogleMock,
}));

vi.mock('../lib/web-data', () => ({
  useExerciseDetailPageData: useExerciseDetailPageDataMock,
  useTemplateBuilderPageData: useTemplateBuilderPageDataMock,
  useExerciseWizardPageData: useExerciseWizardPageDataMock,
  useSettingsPageData: useSettingsPageDataMock,
}));

describe('interactive pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEffectMock.mockImplementation(() => undefined);
    formStateState.value = {
      errors: {},
      isSubmitting: false,
    };
    searchParamsState.value = new URLSearchParams();
    submittedValuesState.value = {};
    watchMock.mockImplementation(
      (field: string) => submittedValuesState.value[field],
    );
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Name and description',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: '',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [
          { id: 'eq-1', name: 'Barbell' },
          { id: 'eq-2', name: 'Bench' },
        ],
        muscleGroups: [
          { id: 'mg-1', name: 'Chest' },
          { id: 'mg-2', name: 'Shoulders' },
        ],
      },
      step: 1,
      totalSteps: 7,
    });
    useExerciseDetailPageDataMock.mockReturnValue({
      errorMessage: undefined,
      exercise: {
        defaultSetsLabel: '4 sets',
        description: 'Pause on the chest and drive through the bar.',
        equipment: ['Barbell', 'Bench'],
        exerciseTypeLabel: 'Weight + Reps',
        name: 'Bench Press',
        note: 'Keep wrists stacked over elbows.',
        primaryMuscle: 'Chest',
        repRangeLabel: '6-8 reps',
        secondaryMuscles: ['Shoulders', 'Triceps'],
      },
      historyItems: [],
      isLoading: false,
    });
    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Template Name',
      description: '',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '',
          repMin: '',
          selected: false,
          supersetGroupKey: '',
        },
      ],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: '',
      onBack: vi.fn(),
      onChangeDescription: vi.fn(),
      onChangeExerciseField: vi.fn(),
      onChangeName: vi.fn(),
      onMoveExercise: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise: vi.fn(),
      step: 1,
      totalSteps: 4,
    });
    useSettingsPageDataMock.mockReturnValue({
      errorMessage: undefined,
      isDirty: false,
      isSaving: false,
      name: 'Iron Lifter',
      timezone: 'America/New_York',
      unitPreference: 'METRIC',
      restTimerDefaultSeconds: '120',
      timezones: ['UTC', 'America/New_York'],
      onDeleteAccount: vi.fn(),
      onLogout: vi.fn(),
      onNameChange: vi.fn(),
      onRestTimerDefaultSecondsChange: vi.fn(),
      onSave: vi.fn(),
      onTimezoneChange: vi.fn(),
      onUnitPreferenceChange: vi.fn(),
    });
  });

  it('TemplateBuilderPage renders step-specific content and submit controls', () => {
    const onBack = vi.fn();
    const onSubmit = vi.fn();
    const onToggleExercise = vi.fn();
    const onMoveExercise = vi.fn();
    const onChangeDescription = vi.fn();
    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Final review and notes',
      description: 'Controlled tempo and full range.',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '4',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '8',
          repMin: '6',
          selected: true,
          supersetGroupKey: 'A',
        },
      ],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: true,
      name: 'Push Day A',
      onBack,
      onChangeDescription,
      onChangeExerciseField: vi.fn(),
      onChangeName: vi.fn(),
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit,
      onToggleExercise,
      step: 4,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const view = TemplateBuilderPage();
    const html = renderToStaticMarkup(view);

    expect(html).toContain(`Step 4 of ${TOTAL_TEMPLATE_STEPS}`);
    expect(html).toContain('Push Day A');
    expect(html).toContain('Bench Press');
    expect(html).toContain('Create Template');
    expect(html).not.toContain('Template Name');

    findButtonByLabel(view, 'Back')?.props.onClick?.();
    findButtonByLabel(view, 'Create Template')?.props.onClick?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Select exercises and set defaults',
      description: '',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '4',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '8',
          repMin: '6',
          selected: true,
          supersetGroupKey: '',
        },
      ],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: 'Push Day A',
      onBack,
      onChangeDescription,
      onChangeExerciseField: vi.fn(),
      onChangeName: vi.fn(),
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit,
      onToggleExercise,
      step: 2,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const selectionHtml = renderToStaticMarkup(TemplateBuilderPage());
    expect(selectionHtml).toContain('Bench Press');
    expect(selectionHtml).toContain('Default Sets for Bench Press');
  });

  it('ExerciseWizardPage renders controlled form inputs and submits on the final step', () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    const onSubmit = vi.fn();
    const onChangeField = vi.fn();
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Review',
      formValues: {
        defaultCues: 'Brace the core',
        defaultSets: '4',
        description: 'Primary chest press',
        equipmentIds: ['eq-1'],
        exerciseType: 'WEIGHT_REPS',
        name: 'Bench Press',
        primaryMuscleGroupId: 'mg-1',
        repMax: '8',
        repMin: '6',
        secondaryMuscleGroupIds: ['mg-2'],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: true,
      onBack,
      onChangeField,
      onNext,
      onSubmit,
      options: {
        equipment: [{ id: 'eq-1', name: 'Barbell' }],
        muscleGroups: [{ id: 'mg-1', name: 'Chest' }],
      },
      step: 7,
      totalSteps: 7,
    });

    const view = ExerciseWizardPage();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('Step 7 of 7');
    expect(html).toContain('Bench Press');
    expect(html).toContain('Brace the core');
    expect(html).not.toContain('Primary Muscle');
    expect(html).toContain('Submit Exercise');

    findButtonByLabel(view, 'Back')?.props.onClick?.();
    findButtonByLabel(view, 'Submit Exercise')?.props.onClick?.();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('ExerciseWizardPage only renders the current step fields', () => {
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Primary muscle',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: 'Primary chest press',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: 'Bench Press',
        primaryMuscleGroupId: '',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [{ id: 'eq-1', name: 'Barbell' }],
        muscleGroups: [{ id: 'mg-1', name: 'Chest' }],
      },
      step: 3,
      totalSteps: 7,
    });

    const html = renderToStaticMarkup(ExerciseWizardPage());

    expect(html).toContain('Primary Muscle');
    expect(html).not.toContain('Secondary Muscles');
    expect(html).not.toContain('Equipment');
    expect(html).not.toContain('Default Cues');
  });

  it('ExerciseDetailPage normalizes invalid tab query params back to guide', () => {
    searchParamsState.value = new URLSearchParams('tab=invalid');
    useEffectMock.mockImplementation((effect: () => void) => effect());

    const view = ExerciseDetailPage();
    expect(renderToStaticMarkup(view)).toContain('Bench Press');

    const normalizedParams = setSearchParamsMock.mock.calls[0]?.[0] as
      | URLSearchParams
      | undefined;
    const normalizedOptions = setSearchParamsMock.mock.calls[0]?.[1] as
      | { replace?: boolean }
      | undefined;

    expect(normalizedParams?.get('tab')).toBe('guide');
    expect(normalizedOptions).toEqual({ replace: true });
  });

  it('ExerciseDetailPage does not mutate search params during render', () => {
    searchParamsState.value = new URLSearchParams('tab=invalid');

    ExerciseDetailPage();

    expect(setSearchParamsMock).not.toHaveBeenCalled();
  });

  it('ExerciseDetailPage renders fetched guide data', () => {
    const html = renderToStaticMarkup(ExerciseDetailPage());

    expect(html).toContain('Bench Press');
    expect(html).toContain('Pause on the chest and drive through the bar.');
    expect(html).toContain('Weight + Reps');
    expect(html).toContain('Keep wrists stacked over elbows.');
  });

  it('ExerciseDetailPage renders history items for the history tab', () => {
    searchParamsState.value = new URLSearchParams('tab=history');
    useExerciseDetailPageDataMock.mockReturnValue({
      errorMessage: undefined,
      exercise: {
        defaultSetsLabel: '4 sets',
        description: 'Pause on the chest and drive through the bar.',
        equipment: ['Barbell', 'Bench'],
        exerciseTypeLabel: 'Weight + Reps',
        name: 'Bench Press',
        note: undefined,
        primaryMuscle: 'Chest',
        repRangeLabel: '6-8 reps',
        secondaryMuscles: ['Shoulders', 'Triceps'],
      },
      historyItems: [
        {
          id: 'set-1',
          performanceLabel: '100 x 8',
          startedAt: '2026-03-05',
        },
      ],
      isLoading: false,
    });

    const html = renderToStaticMarkup(ExerciseDetailPage());

    expect(html).toContain('2026-03-05');
    expect(html).toContain('100 x 8');
    expect(html).not.toContain('Pause on the chest and drive through the bar.');
  });

  it('LoginPage submits credentials to auth API and then navigates to dashboard', async () => {
    submittedValuesState.value = {
      email: 'demo@irontrack.local',
      password: 'DemoPass123!',
    };
    loginWithPasswordMock.mockResolvedValue({
      accessToken: 'access-token-123',
    });

    const view = LoginPage();
    const form = findForm(view);
    expect(form).toBeDefined();

    await form?.props.onSubmit?.({ preventDefault: vi.fn() });
    expect(loginWithPasswordMock).toHaveBeenCalledWith({
      email: 'demo@irontrack.local',
      password: 'DemoPass123!',
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
    const registerCalls = registerMock.mock.calls as unknown as Array<
      [string, unknown?]
    >;
    expect(registerCalls.map((call) => call[0])).toEqual(['email', 'password']);
  });

  it('LoginPage uses semantic auth input attributes', () => {
    const view = LoginPage();

    const emailLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'login-email',
    );
    const passwordLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'login-password',
    );
    const emailInput = findElement(
      view,
      (element) =>
        element.type === 'input' && element.props.id === 'login-email',
    );
    const passwordInput = findElement(
      view,
      (element) =>
        element.type === 'input' && element.props.id === 'login-password',
    );

    expect(emailLabel).toBeDefined();
    expect(passwordLabel).toBeDefined();
    expect(emailInput).toBeDefined();
    expect(passwordInput).toBeDefined();

    expect(emailInput?.props.type).toBe('email');
    expect(emailInput?.props.autoComplete).toBe('email');
    expect(passwordInput?.props.type).toBe('password');
    expect(passwordInput?.props.autoComplete).toBe('current-password');
  });

  it('LoginPage registers client-side validation for email and password fields', () => {
    LoginPage();

    const registerCalls = registerMock.mock.calls as unknown as Array<
      [string, unknown?]
    >;
    const emailCall = registerCalls.find((call) => call[0] === 'email');
    const passwordCall = registerCalls.find((call) => call[0] === 'password');
    const emailOptions = emailCall?.[1] as
      | {
          pattern?: { message?: string; value?: RegExp };
          required?: string;
        }
      | undefined;
    const passwordOptions = passwordCall?.[1] as
      | {
          minLength?: { message?: string; value?: number };
          required?: string;
        }
      | undefined;

    expect(emailOptions?.required).toBe('Email is required');
    expect(emailOptions?.pattern?.message).toBe('Enter a valid email address');
    expect(emailOptions?.pattern?.value).toBeInstanceOf(RegExp);
    expect(passwordOptions?.required).toBe('Password is required');
    expect(passwordOptions?.minLength).toEqual({
      value: 8,
      message: 'Password must be at least 8 characters',
    });
  });

  it('RegisterPage validates confirmation and submits to auth API', async () => {
    submittedValuesState.value = {
      email: 'demo@irontrack.local',
      name: 'Demo User',
      password: 'DemoPass123!',
      confirmPassword: 'DemoPass123!',
    };
    registerWithPasswordMock.mockResolvedValue({
      accessToken: 'access-token-123',
    });

    const view = RegisterPage();
    const form = findForm(view);
    expect(form).toBeDefined();

    await form?.props.onSubmit?.({ preventDefault: vi.fn() });
    expect(registerWithPasswordMock).toHaveBeenCalledWith({
      email: 'demo@irontrack.local',
      name: 'Demo User',
      password: 'DemoPass123!',
    });
    expect(navigateMock).toHaveBeenCalledWith('/');
  });

  it('RegisterPage wires confirm password validation and Google sign-in', async () => {
    submittedValuesState.value = {
      password: 'DemoPass123!',
    };
    const view = RegisterPage();
    const registerCalls = registerMock.mock.calls as unknown as Array<
      [string, unknown?]
    >;

    const confirmPasswordCall = registerCalls.find(
      (call) => call[0] === 'confirmPassword',
    );
    expect(confirmPasswordCall?.[1]).toEqual({
      required: 'Confirm your password',
      validate: expect.any(Function),
    });

    const validate = (
      confirmPasswordCall?.[1] as {
        validate: (value: string) => true | string;
      }
    ).validate;
    expect(validate('DemoPass123!')).toBe(true);
    expect(validate('DifferentPass123!')).toBe('Passwords do not match');

    const googleButton = findButtonByLabel(view, 'Continue with Google');
    expect(googleButton).toBeDefined();
    await googleButton?.props.onClick?.();
    expect(signInWithGoogleMock).toHaveBeenCalledTimes(1);
  });

  it('RegisterPage renders semantic auth input labels', () => {
    const view = RegisterPage();
    const nameLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'register-name',
    );
    const emailLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'register-email',
    );
    const passwordLabel = findElement(
      view,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'register-password',
    );
    const confirmPasswordLabel = findElement(
      view,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'register-confirm-password',
    );

    expect(nodeText((nameLabel?.props.children ?? null) as ReactNode)).toBe(
      'Name',
    );
    expect(nodeText((emailLabel?.props.children ?? null) as ReactNode)).toBe(
      'Email',
    );
    expect(nodeText((passwordLabel?.props.children ?? null) as ReactNode)).toBe(
      'Password',
    );
    expect(
      nodeText((confirmPasswordLabel?.props.children ?? null) as ReactNode),
    ).toBe('Confirm Password');
  });

  it('ExerciseWizardPage wires intermediate step controls and next navigation', () => {
    const onChangeField = vi.fn();
    const onNext = vi.fn();

    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Name and description',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: '',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField,
      onNext,
      onSubmit: vi.fn(),
      options: {
        equipment: [
          { id: 'eq-1', name: 'Barbell' },
          { id: 'eq-2', name: 'Bench' },
        ],
        muscleGroups: [
          { id: 'mg-1', name: 'Chest' },
          { id: 'mg-2', name: 'Shoulders' },
        ],
      },
      step: 1,
      totalSteps: 7,
    });

    const nameStep = ExerciseWizardPage();
    const nameInput = findElement(
      nameStep,
      (element) => element.type === 'input' && element.props.value === '',
    );
    const descriptionInput = findElement(
      nameStep,
      (element) => element.type === 'textarea',
    );

    nameInput?.props.onChange?.({ target: { value: 'Bench Press' } });
    descriptionInput?.props.onChange?.({
      target: { value: 'Pause on the chest' },
    });
    findButtonByLabel(nameStep, 'Next')?.props.onClick?.();

    expect(onChangeField).toHaveBeenNthCalledWith(1, 'name', 'Bench Press');
    expect(onChangeField).toHaveBeenNthCalledWith(
      2,
      'description',
      'Pause on the chest',
    );
    expect(onNext).toHaveBeenCalledTimes(1);

    onChangeField.mockClear();
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Exercise type',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: '',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [],
        muscleGroups: [],
      },
      step: 2,
      totalSteps: 7,
    });

    findElement(
      ExerciseWizardPage(),
      (element) => element.type === 'select',
    )?.props.onChange?.({ target: { value: 'BODYWEIGHT' } });
    expect(onChangeField).toHaveBeenCalledWith('exerciseType', 'BODYWEIGHT');

    onChangeField.mockClear();
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Secondary muscles',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: 'mg-1',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [],
        muscleGroups: [
          { id: 'mg-1', name: 'Chest' },
          { id: 'mg-2', name: 'Shoulders' },
          { id: 'mg-3', name: 'Triceps' },
        ],
      },
      step: 4,
      totalSteps: 7,
    });

    findElement(
      ExerciseWizardPage(),
      (element) => element.type === 'select',
    )?.props.onChange?.({
      target: {
        selectedOptions: [{ value: 'mg-2' }, { value: 'mg-3' }],
      },
    });
    expect(onChangeField).toHaveBeenCalledWith('secondaryMuscleGroupIds', [
      'mg-2',
      'mg-3',
    ]);

    onChangeField.mockClear();
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Equipment',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: 'mg-1',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [
          { id: 'eq-1', name: 'Barbell' },
          { id: 'eq-2', name: 'Bench' },
        ],
        muscleGroups: [],
      },
      step: 5,
      totalSteps: 7,
    });

    findElement(
      ExerciseWizardPage(),
      (element) => element.type === 'select',
    )?.props.onChange?.({
      target: {
        selectedOptions: [{ value: 'eq-1' }, { value: 'eq-2' }],
      },
    });
    expect(onChangeField).toHaveBeenCalledWith('equipmentIds', [
      'eq-1',
      'eq-2',
    ]);

    onChangeField.mockClear();
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Defaults',
      formValues: {
        defaultCues: '',
        defaultSets: '3',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: '',
        repMax: '12',
        repMin: '8',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [],
        muscleGroups: [],
      },
      step: 6,
      totalSteps: 7,
    });

    const defaultsStep = ExerciseWizardPage();
    const inputs = [
      { expected: ['defaultSets', '4'], index: 0, value: '4' },
      { expected: ['repMin', '6'], index: 1, value: '6' },
      { expected: ['repMax', '10'], index: 2, value: '10' },
    ] as const;

    const stepInputs = [
      findElement(
        defaultsStep,
        (element) => element.type === 'input' && element.props.value === '3',
      ),
      findElement(
        defaultsStep,
        (element) => element.type === 'input' && element.props.value === '8',
      ),
      findElement(
        defaultsStep,
        (element) => element.type === 'input' && element.props.value === '12',
      ),
    ];

    inputs.forEach(({ expected, index, value }) => {
      stepInputs[index]?.props.onChange?.({ target: { value } });
      expect(onChangeField).toHaveBeenCalledWith(expected[0], expected[1]);
    });

    findElement(
      defaultsStep,
      (element) => element.type === 'textarea' && element.props.rows === 4,
    )?.props.onChange?.({ target: { value: 'Brace the core' } });
    expect(onChangeField).toHaveBeenCalledWith('defaultCues', 'Brace the core');
  });

  it('TemplateBuilderPage wires step controls across the builder flow', () => {
    const onChangeName = vi.fn();
    const onToggleExercise = vi.fn();
    const onChangeExerciseField = vi.fn();
    const onMoveExercise = vi.fn();
    const onChangeDescription = vi.fn();
    const onNext = vi.fn();

    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Template Name',
      description: '',
      errorMessage: undefined,
      exercises: [],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: '',
      onBack: vi.fn(),
      onChangeDescription,
      onChangeExerciseField,
      onChangeName,
      onMoveExercise,
      onNext,
      onSubmit: vi.fn(),
      onToggleExercise,
      step: 1,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const nameStep = TemplateBuilderPage();
    findElement(
      nameStep,
      (element) =>
        element.type === 'input' && element.props.id === 'template-name',
    )?.props.onChange?.({ target: { value: 'Push Day A' } });
    findButtonByLabel(nameStep, 'Next')?.props.onClick?.();

    expect(onChangeName).toHaveBeenCalledWith('Push Day A');
    expect(onNext).toHaveBeenCalledTimes(1);

    onToggleExercise.mockClear();
    onChangeExerciseField.mockClear();
    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Select exercises',
      description: '',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '4',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '8',
          repMin: '6',
          selected: true,
          supersetGroupKey: '',
        },
      ],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: 'Push Day A',
      onBack: vi.fn(),
      onChangeDescription,
      onChangeExerciseField,
      onChangeName,
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise,
      step: 2,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const selectionStep = TemplateBuilderPage();
    findElement(
      selectionStep,
      (element) =>
        element.type === 'input' && element.props.type === 'checkbox',
    )?.props.onChange?.();
    const numericInputs = [
      findElement(
        selectionStep,
        (element) =>
          element.type === 'input' &&
          element.props.id === 'template-default-sets-exercise-bench',
      ),
      findElement(
        selectionStep,
        (element) =>
          element.type === 'input' &&
          element.props.id === 'template-rep-min-exercise-bench',
      ),
      findElement(
        selectionStep,
        (element) =>
          element.type === 'input' &&
          element.props.id === 'template-rep-max-exercise-bench',
      ),
    ];
    numericInputs[0]?.props.onChange?.({ target: { value: '5' } });
    numericInputs[1]?.props.onChange?.({ target: { value: '7' } });
    numericInputs[2]?.props.onChange?.({ target: { value: '9' } });

    expect(onToggleExercise).toHaveBeenCalledWith('exercise-bench');
    expect(onChangeExerciseField).toHaveBeenNthCalledWith(
      1,
      'exercise-bench',
      'defaultSets',
      '5',
    );
    expect(onChangeExerciseField).toHaveBeenNthCalledWith(
      2,
      'exercise-bench',
      'repMin',
      '7',
    );
    expect(onChangeExerciseField).toHaveBeenNthCalledWith(
      3,
      'exercise-bench',
      'repMax',
      '9',
    );

    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Select exercises',
      description: '',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '4',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '8',
          repMin: '6',
          selected: false,
          supersetGroupKey: '',
        },
      ],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: 'Push Day A',
      onBack: vi.fn(),
      onChangeDescription,
      onChangeExerciseField,
      onChangeName,
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise,
      step: 2,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });
    expect(renderToStaticMarkup(TemplateBuilderPage())).not.toContain(
      'Default Sets for Bench Press',
    );

    onMoveExercise.mockClear();
    onChangeExerciseField.mockClear();
    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Order and supersets',
      description: '',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '4',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '8',
          repMin: '6',
          selected: true,
          supersetGroupKey: '',
        },
      ],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: 'Push Day A',
      onBack: vi.fn(),
      onChangeDescription,
      onChangeExerciseField,
      onChangeName,
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise,
      step: 3,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const orderStep = TemplateBuilderPage();
    findButtonByLabel(orderStep, 'Move Bench Press Up')?.props.onClick?.();
    findButtonByLabel(orderStep, 'Move Bench Press Down')?.props.onClick?.();
    findElement(
      orderStep,
      (element) =>
        element.type === 'input' &&
        element.props.id === 'template-superset-exercise-bench',
    )?.props.onChange?.({ target: { value: 'A' } });

    expect(onMoveExercise).toHaveBeenNthCalledWith(1, 'exercise-bench', -1);
    expect(onMoveExercise).toHaveBeenNthCalledWith(2, 'exercise-bench', 1);
    expect(onChangeExerciseField).toHaveBeenCalledWith(
      'exercise-bench',
      'supersetGroupKey',
      'A',
    );

    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Order and supersets',
      description: '',
      errorMessage: undefined,
      exercises: [],
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      name: 'Push Day A',
      onBack: vi.fn(),
      onChangeDescription,
      onChangeExerciseField,
      onChangeName,
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise,
      step: 3,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    expect(renderToStaticMarkup(TemplateBuilderPage())).toContain(
      'Select exercises on the previous step first.',
    );

    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Final review and notes',
      description: '',
      errorMessage: undefined,
      exercises: [
        {
          defaultSets: '4',
          id: 'exercise-bench',
          name: 'Bench Press',
          repMax: '8',
          repMin: '6',
          selected: true,
          supersetGroupKey: 'A',
        },
      ],
      isLoading: false,
      isSubmitting: true,
      isSubmitStep: true,
      name: 'Push Day A',
      onBack: vi.fn(),
      onChangeDescription,
      onChangeExerciseField,
      onChangeName,
      onMoveExercise,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise,
      step: 4,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const reviewStep = TemplateBuilderPage();
    findElement(
      reviewStep,
      (element) =>
        element.type === 'textarea' &&
        element.props.id === 'template-description',
    )?.props.onChange?.({ target: { value: 'Controlled tempo' } });
    expect(onChangeDescription).toHaveBeenCalledWith('Controlled tempo');
    expect(
      findButtonByLabel(reviewStep, 'Create Template')?.props.disabled,
    ).toBe(true);
  });

  it('TemplateBuilderPage renders review fallbacks and loading/error chrome', () => {
    useTemplateBuilderPageDataMock.mockReturnValue({
      currentStepLabel: 'Final review and notes',
      description: '',
      errorMessage: 'Builder unavailable',
      exercises: [],
      isLoading: true,
      isSubmitting: false,
      isSubmitStep: false,
      name: '',
      onBack: vi.fn(),
      onChangeDescription: vi.fn(),
      onChangeExerciseField: vi.fn(),
      onChangeName: vi.fn(),
      onMoveExercise: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      onToggleExercise: vi.fn(),
      step: 4,
      totalSteps: TOTAL_TEMPLATE_STEPS,
    });

    const html = renderToStaticMarkup(TemplateBuilderPage());
    expect(html).toContain('Unnamed template');
    expect(html).toContain('Builder unavailable');
    expect(html).toContain('Loading exercises…');
  });

  it('ExerciseDetailPage supports tab switching and empty history fallback', () => {
    const historyView = ExerciseDetailPage();
    findButtonByLabel(historyView, 'History')?.props.onClick?.();
    findButtonByLabel(historyView, 'Form Guide')?.props.onClick?.();

    const historyParams = setSearchParamsMock.mock.calls[0]?.[0] as
      | URLSearchParams
      | undefined;
    const guideParams = setSearchParamsMock.mock.calls[1]?.[0] as
      | URLSearchParams
      | undefined;
    expect(historyParams?.get('tab')).toBe('history');
    expect(guideParams?.get('tab')).toBe('guide');

    searchParamsState.value = new URLSearchParams('tab=history');
    useExerciseDetailPageDataMock.mockReturnValue({
      errorMessage: 'History unavailable',
      exercise: {
        defaultSetsLabel: '4 sets',
        description: 'Pause on the chest and drive through the bar.',
        equipment: [],
        exerciseTypeLabel: 'Weight + Reps',
        name: 'Bench Press',
        note: undefined,
        primaryMuscle: 'Chest',
        repRangeLabel: '6-8 reps',
        secondaryMuscles: [],
      },
      historyItems: [],
      isLoading: true,
    });

    const html = renderToStaticMarkup(ExerciseDetailPage());
    expect(html).toContain('History unavailable');
    expect(html).toContain('Loading exercise…');
    expect(html).toContain('No exercise history yet.');
  });

  it('LoginPage renders submitting and validation error states, and handles Google failures', async () => {
    formStateState.value = {
      errors: {
        email: { message: 'Email is required' },
        password: { message: 'Password is required' },
        root: { message: 'Login failed' },
      },
      isSubmitting: true,
    };

    const view = LoginPage();
    expect(renderToStaticMarkup(view)).toContain('Login failed');
    expect(renderToStaticMarkup(view)).toContain('Email is required');
    expect(renderToStaticMarkup(view)).toContain('Password is required');
    expect(findButtonByLabel(view, 'Signing In...')?.props.disabled).toBe(true);
    expect(
      findButtonByLabel(view, 'Continue with Google')?.props.disabled,
    ).toBe(true);

    formStateState.value = {
      errors: {},
      isSubmitting: false,
    };
    signInWithGoogleMock.mockRejectedValueOnce(new Error('GIS unavailable'));

    await findButtonByLabel(
      LoginPage(),
      'Continue with Google',
    )?.props.onClick?.();

    expect(clearErrorsMock).toHaveBeenCalledWith('root');
    expect(setErrorMock).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({
        type: 'server',
      }),
    );
  });

  it('RegisterPage renders submitting and validation error states, and handles Google failures', async () => {
    formStateState.value = {
      errors: {
        email: { message: 'Email is required' },
        password: { message: 'Password is required' },
        confirmPassword: { message: 'Confirm your password' },
        root: { message: 'Register failed' },
      },
      isSubmitting: true,
    };

    const view = RegisterPage();
    const html = renderToStaticMarkup(view);
    expect(html).toContain('Register failed');
    expect(html).toContain('Email is required');
    expect(html).toContain('Password is required');
    expect(html).toContain('Confirm your password');
    expect(findButtonByLabel(view, 'Creating Account...')?.props.disabled).toBe(
      true,
    );
    expect(
      findButtonByLabel(view, 'Continue with Google')?.props.disabled,
    ).toBe(true);

    formStateState.value = {
      errors: {},
      isSubmitting: false,
    };
    signInWithGoogleMock.mockRejectedValueOnce(new Error('GIS unavailable'));

    await findButtonByLabel(
      RegisterPage(),
      'Continue with Google',
    )?.props.onClick?.();

    expect(clearErrorsMock).toHaveBeenCalledWith('root');
    expect(setErrorMock).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({
        type: 'server',
      }),
    );
  });

  it('covers the remaining page event and error branches', async () => {
    const onChangeField = vi.fn();
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Primary muscle',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: [] as string[],
        exerciseType: 'WEIGHT_REPS',
        name: 'Bench Press',
        primaryMuscleGroupId: '',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [] as string[],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: false,
      onBack: vi.fn(),
      onChangeField,
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [],
        muscleGroups: [{ id: 'mg-1', name: 'Chest' }],
      },
      step: 3,
      totalSteps: 7,
    });

    findElement(
      ExerciseWizardPage(),
      (element) => element.type === 'select',
    )?.props.onChange?.({ target: { value: 'mg-1' } });
    expect(onChangeField).toHaveBeenCalledWith('primaryMuscleGroupId', 'mg-1');

    searchParamsState.value = new URLSearchParams('tab=guide');
    useEffectMock.mockImplementation((effect: () => void) => effect());
    useExerciseDetailPageDataMock.mockReturnValue({
      errorMessage: undefined,
      exercise: {
        defaultSetsLabel: '4 sets',
        description: 'Pause on the chest and drive through the bar.',
        equipment: [],
        exerciseTypeLabel: 'Weight + Reps',
        name: 'Bench Press',
        note: undefined,
        primaryMuscle: 'Chest',
        repRangeLabel: '6-8 reps',
        secondaryMuscles: [],
      },
      historyItems: [],
      isLoading: false,
    });
    const detailHtml = renderToStaticMarkup(ExerciseDetailPage());
    expect(detailHtml).toContain('Equipment: None');
    expect(detailHtml).toContain('Secondary muscles: None');
    expect(setSearchParamsMock).not.toHaveBeenCalled();

    submittedValuesState.value = {
      email: 'demo@irontrack.local',
      password: 'wrong-password',
    };
    loginWithPasswordMock.mockRejectedValueOnce(new Error('invalid'));
    await findForm(LoginPage())?.props.onSubmit?.({ preventDefault: vi.fn() });
    expect(setErrorMock).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({
        type: 'server',
      }),
    );

    signInWithGoogleMock.mockResolvedValueOnce(undefined);
    await findButtonByLabel(
      LoginPage(),
      'Continue with Google',
    )?.props.onClick?.();
    expect(navigateMock).toHaveBeenCalledWith('/');

    submittedValuesState.value = {
      email: 'demo@irontrack.local',
      name: 'Demo User',
      password: 'DemoPass123!',
      confirmPassword: 'DemoPass123!',
    };
    registerWithPasswordMock.mockRejectedValueOnce(new Error('duplicate'));
    await findForm(RegisterPage())?.props.onSubmit?.({
      preventDefault: vi.fn(),
    });
    expect(setErrorMock).toHaveBeenCalledWith(
      'root',
      expect.objectContaining({
        type: 'server',
      }),
    );

    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Review',
      errorMessage: 'Review unavailable',
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: '',
        equipmentIds: ['eq-missing'],
        exerciseType: 'WEIGHT_REPS',
        name: '',
        primaryMuscleGroupId: '',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: ['mg-missing'],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: true,
      onBack: vi.fn(),
      onChangeField: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [],
        muscleGroups: [],
      },
      step: 7,
      totalSteps: 7,
    });
    const reviewHtml = renderToStaticMarkup(ExerciseWizardPage());
    expect(reviewHtml).toContain('Unnamed exercise');
    expect(reviewHtml).toContain('No description');
    expect(reviewHtml).toContain('No primary muscle selected');
    expect(reviewHtml).toContain('mg-missing');
    expect(reviewHtml).toContain('eq-missing');
    expect(reviewHtml).toContain('No cues');
    expect(reviewHtml).toContain('Review unavailable');

    searchParamsState.value = new URLSearchParams('tab=guide');
    useEffectMock.mockImplementation(() => undefined);
    useExerciseDetailPageDataMock.mockReturnValue({
      errorMessage: 'Exercise unavailable',
      exercise: undefined,
      historyItems: [],
      isLoading: false,
    });
    const missingExerciseHtml = renderToStaticMarkup(ExerciseDetailPage());
    expect(missingExerciseHtml).toContain('Exercise Detail');
    expect(missingExerciseHtml).toContain('Exercise unavailable');
  });

  it('ExerciseWizardPage review shows empty secondary and equipment fallbacks', () => {
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Review',
      errorMessage: undefined,
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: 'Primary chest press',
        equipmentIds: [],
        exerciseType: 'WEIGHT_REPS',
        name: 'Bench Press',
        primaryMuscleGroupId: 'mg-1',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: [],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: true,
      onBack: vi.fn(),
      onChangeField: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [{ id: 'eq-1', name: 'Barbell' }],
        muscleGroups: [{ id: 'mg-1', name: 'Chest' }],
      },
      step: 7,
      totalSteps: 7,
    });

    const html = renderToStaticMarkup(ExerciseWizardPage());
    expect(html).toContain('No secondary muscles selected');
    expect(html).toContain('No equipment selected');
  });

  it('ExerciseWizardPage review resolves known secondary muscle labels', () => {
    useExerciseWizardPageDataMock.mockReturnValue({
      currentStepLabel: 'Review',
      errorMessage: undefined,
      formValues: {
        defaultCues: '',
        defaultSets: '',
        description: 'Primary chest press',
        equipmentIds: [],
        exerciseType: 'WEIGHT_REPS',
        name: 'Bench Press',
        primaryMuscleGroupId: 'mg-1',
        repMax: '',
        repMin: '',
        secondaryMuscleGroupIds: ['mg-2'],
      },
      isLoading: false,
      isSubmitting: false,
      isSubmitStep: true,
      onBack: vi.fn(),
      onChangeField: vi.fn(),
      onNext: vi.fn(),
      onSubmit: vi.fn(),
      options: {
        equipment: [],
        muscleGroups: [
          { id: 'mg-1', name: 'Chest' },
          { id: 'mg-2', name: 'Shoulders' },
        ],
      },
      step: 7,
      totalSteps: 7,
    });

    expect(renderToStaticMarkup(ExerciseWizardPage())).toContain('Shoulders');
  });
});
