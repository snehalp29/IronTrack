import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findButtonByLabel, findForm } from '../testing/react-tree';
import { ExerciseDetailPage } from './ExerciseDetailPage';
import { ExerciseWizardPage } from './ExerciseWizardPage';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { TemplateBuilderPage } from './TemplateBuilderPage';

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
    expect(nextUpdater?.(4)).toBe(4);
    expect(nextUpdater?.(2)).toBe(3);

    useStateMock.mockReturnValue([2, setStepMock] as unknown as [
      number,
      Dispatch<SetStateAction<number>>,
    ]);
    expect(renderToStaticMarkup(TemplateBuilderPage())).toContain(
      'Select exercises and set defaults',
    );

    useStateMock.mockReturnValue([3, setStepMock] as unknown as [
      number,
      Dispatch<SetStateAction<number>>,
    ]);
    expect(renderToStaticMarkup(TemplateBuilderPage())).toContain(
      'Superset and order review',
    );

    useStateMock.mockReturnValue([4, setStepMock] as unknown as [
      number,
      Dispatch<SetStateAction<number>>,
    ]);
    expect(renderToStaticMarkup(TemplateBuilderPage())).toContain(
      'Final review and notes',
    );
  });

  it('ExerciseWizardPage respects step boundaries and updates search params', () => {
    searchParamsState.value = new URLSearchParams();
    expect(renderToStaticMarkup(ExerciseWizardPage())).toContain('Step 1 of 7');

    searchParamsState.value = new URLSearchParams('step=1');
    const stepOne = ExerciseWizardPage();
    expect(renderToStaticMarkup(stepOne)).toContain('Step 1 of 7');

    findButtonByLabel(stepOne, 'Back')?.props.onClick?.();
    findButtonByLabel(stepOne, 'Next')?.props.onClick?.();
    expect(setSearchParamsMock).toHaveBeenNthCalledWith(1, { step: '1' });
    expect(setSearchParamsMock).toHaveBeenNthCalledWith(2, { step: '2' });

    setSearchParamsMock.mockClear();
    searchParamsState.value = new URLSearchParams('step=7');
    const stepSeven = ExerciseWizardPage();
    expect(renderToStaticMarkup(stepSeven)).toContain('Step 7 of 7');

    findButtonByLabel(stepSeven, 'Next')?.props.onClick?.();
    findButtonByLabel(stepSeven, 'Back')?.props.onClick?.();
    expect(setSearchParamsMock).toHaveBeenNthCalledWith(1, { step: '7' });
    expect(setSearchParamsMock).toHaveBeenNthCalledWith(2, { step: '6' });
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
