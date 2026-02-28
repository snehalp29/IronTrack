interface Props {
  open: boolean;
  onClose: () => void;
}

export function SupersetModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="card" style={{ borderColor: '#c27f56' }}>
      <h3>Superset Builder</h3>
      <p className="meta">Link A/B exercises into one superset group.</p>
      <button onClick={onClose}>Apply</button>
    </div>
  );
}
