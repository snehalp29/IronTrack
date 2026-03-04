import { useState } from 'react';

type TemplateStep = {
  id: string;
  label: string;
  placeholder: string;
  rows?: number;
};

const TEMPLATE_STEPS: readonly TemplateStep[] = [
  {
    id: 'template-name',
    label: 'Template Name',
    placeholder: 'Template Name',
  },
  {
    id: 'template-step-exercises',
    label: 'Select exercises and set defaults',
    placeholder: 'Select exercises and set defaults',
    rows: 6,
  },
  {
    id: 'template-step-superset',
    label: 'Superset and order review',
    placeholder: 'Superset and order review',
    rows: 6,
  },
  {
    id: 'template-step-notes',
    label: 'Final review and notes',
    placeholder: 'Final review and notes',
    rows: 6,
  },
] as const;

export const TOTAL_TEMPLATE_STEPS = TEMPLATE_STEPS.length;

export function TemplateBuilderPage() {
  const [step, setStep] = useState(1);
  const clampedStep = Math.min(TOTAL_TEMPLATE_STEPS, Math.max(1, step));
  const currentStep = TEMPLATE_STEPS[clampedStep - 1];

  return (
    <div className="card">
      <h1>Template Builder</h1>
      <p className="meta">
        Step {clampedStep} of {TOTAL_TEMPLATE_STEPS}
      </p>
      <label htmlFor={currentStep.id}>{currentStep.label}</label>
      {typeof currentStep.rows === 'number' ? (
        <textarea
          id={currentStep.id}
          placeholder={currentStep.placeholder}
          rows={currentStep.rows}
        />
      ) : (
        <input id={currentStep.id} placeholder={currentStep.placeholder} />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="secondary"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
        >
          Back
        </button>
        <button
          onClick={() =>
            setStep((current) => Math.min(TOTAL_TEMPLATE_STEPS, current + 1))
          }
        >
          Next
        </button>
      </div>
    </div>
  );
}
