import type { ChangeEvent } from 'react';

import { focusInitialModalTarget, handleModalKeyDown } from './modal-focus';

interface Props {
  open: boolean;
  exerciseName?: string;
  errorMessage?: string;
  isSaving: boolean;
  notes: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function ExerciseNotesModal({
  open,
  exerciseName,
  errorMessage,
  isSaving,
  notes,
  onChange,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-notes-title"
      ref={focusInitialModalTarget}
      tabIndex={-1}
      onKeyDown={(event) => handleModalKeyDown(event, onClose)}
    >
      <h3 id="exercise-notes-title">Edit Exercise Notes</h3>
      {exerciseName ? <p className="meta">{exerciseName}</p> : null}
      <label className="grid" htmlFor="exercise-notes-input">
        <span className="meta">Notes</span>
        <textarea
          id="exercise-notes-input"
          rows={4}
          value={notes}
          onChange={handleChange}
        />
      </label>
      {errorMessage ? <p className="meta">{errorMessage}</p> : null}
      <div className="modal__actions">
        <button type="button" onClick={onSave} disabled={isSaving}>
          Save Notes
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
