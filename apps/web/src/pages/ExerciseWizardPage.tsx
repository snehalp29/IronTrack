import { useSearchParams } from 'react-router-dom';

const steps = [
  'Name and description',
  'Exercise type',
  'Primary muscle',
  'Secondary muscles',
  'Equipment',
  'Defaults and cues',
  'Review',
];

export function ExerciseWizardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStep = Number(searchParams.get('step') ?? '1');
  const step = Number.isFinite(rawStep)
    ? Math.min(steps.length, Math.max(1, Math.trunc(rawStep)))
    : 1;
  const currentStepLabel = steps[step - 1];

  const next = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('step', String(Math.min(steps.length, step + 1)));
    setSearchParams(nextParams);
  };
  const prev = () => {
    const prevParams = new URLSearchParams(searchParams);
    prevParams.set('step', String(Math.max(1, step - 1)));
    setSearchParams(prevParams);
  };

  return (
    <div className="card">
      <h1>Create / Edit Exercise</h1>
      <p className="meta">
        Step {step} of {steps.length}: {currentStepLabel}
      </p>
      <label htmlFor="exercise-step-content">{currentStepLabel}</label>
      <textarea
        id="exercise-step-content"
        rows={5}
        placeholder={`${currentStepLabel} details`}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="secondary" onClick={prev}>
          Back
        </button>
        <button onClick={next}>Next</button>
      </div>
    </div>
  );
}
