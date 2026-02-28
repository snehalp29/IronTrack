import { useState } from 'react';

export function TemplateBuilderPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="card">
      <h1>Template Builder</h1>
      <p className="meta">Step {step} of 4</p>
      {step === 1 && <input placeholder="Template Name" />}
      {step === 2 && (
        <textarea placeholder="Select exercises and set defaults" rows={6} />
      )}
      {step === 3 && (
        <textarea placeholder="Superset and order review" rows={6} />
      )}
      {step === 4 && <textarea placeholder="Final review and notes" rows={6} />}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="secondary"
          onClick={() => setStep((current) => Math.max(1, current - 1))}
        >
          Back
        </button>
        <button onClick={() => setStep((current) => Math.min(4, current + 1))}>
          Next
        </button>
      </div>
    </div>
  );
}
