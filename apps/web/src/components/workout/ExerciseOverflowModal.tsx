interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExerciseOverflowModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-overflow-title"
    >
      <h3 id="exercise-overflow-title">Exercise Actions</h3>
      <div className="grid">
        <button type="button" className="secondary">
          Edit Notes
        </button>
        <button type="button" className="secondary">
          Swap Exercise
        </button>
        <button type="button" className="danger">
          Delete Exercise
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
