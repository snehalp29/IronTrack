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
  const step = Number(searchParams.get('step') ?? '1');

  const next = () =>
    setSearchParams({ step: String(Math.min(steps.length, step + 1)) });
  const prev = () => setSearchParams({ step: String(Math.max(1, step - 1)) });

  return (
    <div className="card">
      <h1>Create / Edit Exercise</h1>
      <p className="meta">
        Step {step} of {steps.length}: {steps[step - 1]}
      </p>
      <textarea rows={5} placeholder="Step form content" />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="secondary" onClick={prev}>
          Back
        </button>
        <button onClick={next}>Next</button>
      </div>
    </div>
  );
}
