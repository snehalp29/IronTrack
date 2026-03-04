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

const useStateMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const setSearchParamsMock = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({
  value: new URLSearchParams(),
}));
const registerMock = vi.hoisted(() => vi.fn(() => ({})));
const handleSubmitMock = vi.hoisted(() =>
  vi.fn((onValid: () => void) => (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    onValid();
  }),
);
const useFormMock = vi.hoisted(() =>
  vi.fn(() => ({
    register: registerMock,
    handleSubmit: handleSubmitMock,
  })),
);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
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

describe('interactive pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.value = new URLSearchParams();
  });

  it('TemplateBuilderPage renders each step and button updaters enforce bounds', () => {
    const setStepMock = vi.fn();
    useStateMock.mockReturnValue([1, setStepMock] as unknown as [
      number,
      Dispatch<SetStateAction<number>>,
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
    expect(stepOneInput?.props['aria-label']).toBeUndefined();
    const backButton = findButtonByLabel(stepOne, 'Back');
    const nextButton = findButtonByLabel(stepOne, 'Next');
    expect(backButton).toBeDefined();
    expect(nextButton).toBeDefined();

    backButton?.props.onClick?.();
    nextButton?.props.onClick?.();

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

    useStateMock.mockReturnValue([2, setStepMock] as unknown as [
      number,
      Dispatch<SetStateAction<number>>,
    ]);
    const stepTwo = TemplateBuilderPage();
    expect(renderToStaticMarkup(stepTwo)).toContain(
      'Select exercises and set defaults',
    );
    const stepTwoLabel = findElement(
      stepTwo,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'template-step-exercises',
    );
    const stepTwoTextarea = findElement(
      stepTwo,
      (element) =>
        element.type === 'textarea' &&
        element.props.id === 'template-step-exercises',
    );
    expect(stepTwoLabel).toBeDefined();
    expect(stepTwoTextarea).toBeDefined();
    expect(stepTwoTextarea?.props['aria-label']).toBeUndefined();

    useStateMock.mockReturnValue([3, setStepMock] as unknown as [
      number,
      Dispatch<SetStateAction<number>>,
    ]);
    const stepThree = TemplateBuilderPage();
    expect(renderToStaticMarkup(stepThree)).toContain(
      'Superset and order review',
    );
    const stepThreeLabel = findElement(
      stepThree,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'template-step-superset',
    );
    const stepThreeTextarea = findElement(
      stepThree,
      (element) =>
        element.type === 'textarea' &&
        element.props.id === 'template-step-superset',
    );
    expect(stepThreeLabel).toBeDefined();
    expect(stepThreeTextarea).toBeDefined();
    expect(stepThreeTextarea?.props['aria-label']).toBeUndefined();

    useStateMock.mockReturnValue([
      TOTAL_TEMPLATE_STEPS,
      setStepMock,
    ] as unknown as [number, Dispatch<SetStateAction<number>>]);
    const stepFour = TemplateBuilderPage();
    expect(renderToStaticMarkup(stepFour)).toContain('Final review and notes');
    const stepFourLabel = findElement(
      stepFour,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'template-step-notes',
    );
    const stepFourTextarea = findElement(
      stepFour,
      (element) =>
        element.type === 'textarea' &&
        element.props.id === 'template-step-notes',
    );
    expect(stepFourLabel).toBeDefined();
    expect(stepFourTextarea).toBeDefined();
    expect(stepFourTextarea?.props['aria-label']).toBeUndefined();
  });

  it('ExerciseWizardPage respects step boundaries and updates search params', () => {
    searchParamsState.value = new URLSearchParams();
    expect(renderToStaticMarkup(ExerciseWizardPage())).toContain('Step 1 of 7');

    searchParamsState.value = new URLSearchParams('step=abc');
    expect(renderToStaticMarkup(ExerciseWizardPage())).toContain('Step 1 of 7');

    searchParamsState.value = new URLSearchParams('step=999');
    expect(renderToStaticMarkup(ExerciseWizardPage())).toContain('Step 7 of 7');

    searchParamsState.value = new URLSearchParams('step=-2');
    expect(renderToStaticMarkup(ExerciseWizardPage())).toContain('Step 1 of 7');

    searchParamsState.value = new URLSearchParams('step=1');
    const stepOne = ExerciseWizardPage();
    expect(renderToStaticMarkup(stepOne)).toContain('Step 1 of 7');

    findButtonByLabel(stepOne, 'Back')?.props.onClick?.();
    findButtonByLabel(stepOne, 'Next')?.props.onClick?.();
    const firstStepOneParams = setSearchParamsMock.mock
      .calls[0]?.[0] as URLSearchParams;
    const secondStepOneParams = setSearchParamsMock.mock
      .calls[1]?.[0] as URLSearchParams;
    expect(firstStepOneParams).toBeInstanceOf(URLSearchParams);
    expect(firstStepOneParams.get('step')).toBe('1');
    expect(secondStepOneParams).toBeInstanceOf(URLSearchParams);
    expect(secondStepOneParams.get('step')).toBe('2');

    setSearchParamsMock.mockClear();
    searchParamsState.value = new URLSearchParams('step=7');
    const stepSeven = ExerciseWizardPage();
    expect(renderToStaticMarkup(stepSeven)).toContain('Step 7 of 7');

    findButtonByLabel(stepSeven, 'Next')?.props.onClick?.();
    findButtonByLabel(stepSeven, 'Back')?.props.onClick?.();
    const firstStepSevenParams = setSearchParamsMock.mock
      .calls[0]?.[0] as URLSearchParams;
    const secondStepSevenParams = setSearchParamsMock.mock
      .calls[1]?.[0] as URLSearchParams;
    expect(firstStepSevenParams).toBeInstanceOf(URLSearchParams);
    expect(firstStepSevenParams.get('step')).toBe('7');
    expect(secondStepSevenParams).toBeInstanceOf(URLSearchParams);
    expect(secondStepSevenParams.get('step')).toBe('6');
  });

  it('ExerciseWizardPage renders a labeled step field for accessibility', () => {
    searchParamsState.value = new URLSearchParams('step=1');
    const stepOne = ExerciseWizardPage();
    const stepOneLabel = findElement(
      stepOne,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'exercise-step-content',
    );
    const stepOneTextarea = findElement(
      stepOne,
      (element) =>
        element.type === 'textarea' &&
        element.props.id === 'exercise-step-content',
    );
    expect(stepOneLabel).toBeDefined();
    expect(stepOneTextarea).toBeDefined();
    expect(nodeText((stepOneLabel?.props.children ?? null) as ReactNode)).toBe(
      'Name and description',
    );

    searchParamsState.value = new URLSearchParams('step=7');
    const stepSeven = ExerciseWizardPage();
    const stepSevenLabel = findElement(
      stepSeven,
      (element) =>
        element.type === 'label' &&
        element.props.htmlFor === 'exercise-step-content',
    );
    expect(stepSevenLabel).toBeDefined();
    expect(
      nodeText((stepSevenLabel?.props.children ?? null) as ReactNode),
    ).toBe('Review');
  });

  it('ExerciseDetailPage renders both tabs and updates query param', () => {
    searchParamsState.value = new URLSearchParams();
    const guideView = ExerciseDetailPage();
    expect(renderToStaticMarkup(guideView)).toContain(
      'Coaching cues and setup instructions.',
    );

    findButtonByLabel(guideView, 'History')?.props.onClick?.();
    const firstParams = setSearchParamsMock.mock
      .calls[0]?.[0] as URLSearchParams;
    const firstOptions = setSearchParamsMock.mock.calls[0]?.[1] as
      | { replace?: boolean }
      | undefined;
    expect(firstParams).toBeInstanceOf(URLSearchParams);
    expect(firstParams.get('tab')).toBe('history');
    expect(firstOptions).toEqual({ replace: true });

    setSearchParamsMock.mockClear();
    searchParamsState.value = new URLSearchParams('tab=history');
    const historyView = ExerciseDetailPage();
    expect(renderToStaticMarkup(historyView)).toContain(
      'Set history timeline and trend graph placeholder.',
    );

    findButtonByLabel(historyView, 'Form Guide')?.props.onClick?.();
    const secondParams = setSearchParamsMock.mock
      .calls[0]?.[0] as URLSearchParams;
    expect(secondParams.get('tab')).toBe('guide');
  });

  it('LoginPage submits form and navigates to dashboard', () => {
    const view = LoginPage();
    const form = findForm(view);
    expect(form).toBeDefined();

    form?.props.onSubmit?.({ preventDefault: vi.fn() });
    expect(navigateMock).toHaveBeenCalledWith('/');
    expect(registerMock).toHaveBeenCalledWith('email');
    expect(registerMock).toHaveBeenCalledWith('password');
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

  it('RegisterPage uses labels and semantic auth input attributes', () => {
    const view = RegisterPage();

    const nameLabel = findElement(
      view,
      (element) => element.type === 'label' && element.props.htmlFor === 'name',
    );
    const emailLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'email',
    );
    const passwordLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'password',
    );
    const confirmPasswordLabel = findElement(
      view,
      (element) =>
        element.type === 'label' && element.props.htmlFor === 'confirmPassword',
    );
    const nameInput = findElement(
      view,
      (element) => element.type === 'input' && element.props.id === 'name',
    );
    const emailInput = findElement(
      view,
      (element) => element.type === 'input' && element.props.id === 'email',
    );
    const passwordInput = findElement(
      view,
      (element) => element.type === 'input' && element.props.id === 'password',
    );
    const confirmPasswordInput = findElement(
      view,
      (element) =>
        element.type === 'input' && element.props.id === 'confirmPassword',
    );

    expect(nameLabel).toBeDefined();
    expect(emailLabel).toBeDefined();
    expect(passwordLabel).toBeDefined();
    expect(confirmPasswordLabel).toBeDefined();
    expect(nameInput).toBeDefined();
    expect(emailInput).toBeDefined();
    expect(passwordInput).toBeDefined();
    expect(confirmPasswordInput).toBeDefined();

    expect(nameInput?.props.type).toBe('text');
    expect(nameInput?.props.autoComplete).toBe('name');
    expect(emailInput?.props.type).toBe('email');
    expect(emailInput?.props.autoComplete).toBe('email');
    expect(passwordInput?.props.type).toBe('password');
    expect(passwordInput?.props.autoComplete).toBe('new-password');
    expect(confirmPasswordInput?.props.type).toBe('password');
    expect(confirmPasswordInput?.props.autoComplete).toBe('new-password');
  });

  it('RegisterPage submits form and navigates to dashboard', () => {
    const view = RegisterPage();
    const form = findForm(view);
    expect(form).toBeDefined();

    form?.props.onSubmit?.({ preventDefault: vi.fn() });
    expect(navigateMock).toHaveBeenCalledWith('/');
    expect(registerMock).toHaveBeenCalledWith('name');
    expect(registerMock).toHaveBeenCalledWith('email');
    expect(registerMock).toHaveBeenCalledWith('password');
    expect(registerMock).toHaveBeenCalledWith('confirmPassword');
  });
});
