import type { Dispatch, ReactNode, SetStateAction } from 'react';

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
    useSettingsPageDataMock.mockReturnValue({
      errorMessage: undefined,
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

  it('TemplateBuilderPage renders each step and button updaters enforce bounds', () => {
    const setStepMock = vi.fn();
    useStateMock
      .mockReturnValueOnce([1, setStepMock] as unknown as [
        number,
        Dispatch<SetStateAction<number>>,
      ])
      .mockReturnValueOnce([
        {
          'template-name': '',
          'template-step-exercises': '',
          'template-step-superset': '',
          'template-step-notes': '',
        },
        vi.fn(),
      ]);

    const stepOne = TemplateBuilderPage();
    expect(renderToStaticMarkup(stepOne)).toContain('Template Name');
    expect(renderToStaticMarkup(stepOne)).toContain(
      `Step 1 of ${TOTAL_TEMPLATE_STEPS}`,
    );
    const stepOneLabel = findElement(
      stepOne,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'template-name',
    );
    const stepOneInput = findElement(
      stepOne,
      (element) =>
        element.type === 'input' && element.props.id === 'template-name',
    );
    expect(stepOneLabel).toBeDefined();
    expect(stepOneInput).toBeDefined();

    findButtonByLabel(stepOne, 'Back')?.props.onClick?.();
    findButtonByLabel(stepOne, 'Next')?.props.onClick?.();

    const backUpdater = setStepMock.mock.calls[0]?.[0] as
      | ((current: number) => number)
      | undefined;
    const nextUpdater = setStepMock.mock.calls[1]?.[0] as
      | ((current: number) => number)
      | undefined;
    expect(backUpdater?.(1)).toBe(1);
    expect(backUpdater?.(3)).toBe(2);
    expect(nextUpdater?.(TOTAL_TEMPLATE_STEPS)).toBe(TOTAL_TEMPLATE_STEPS);
    expect(nextUpdater?.(2)).toBe(3);
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
});
