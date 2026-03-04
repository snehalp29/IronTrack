interface Props {
  open: boolean;
  onClose: () => void;
}

export function SupersetModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--accent"
      role="dialog"
      aria-modal="true"
      aria-labelledby="superset-modal-title"
    >
      <h3 id="superset-modal-title">Superset Builder</h3>
      <p className="meta">Link A/B exercises into one superset group.</p>
      <button type="button" onClick={onClose}>
        Apply
      </button>
    </div>
  );
}
