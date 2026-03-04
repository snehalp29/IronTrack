interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReorderModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reorder-modal-title"
    >
      <h3 id="reorder-modal-title">Reorder Exercises</h3>
      <p className="meta">Drag-and-drop list placeholder.</p>
      <button type="button" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
