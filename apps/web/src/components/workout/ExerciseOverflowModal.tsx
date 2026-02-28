interface Props {
  open: boolean;
  onClose: () => void;
}

export function ExerciseOverflowModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="card" style={{ borderColor: '#c27f56' }}>
      <h3>Exercise Actions</h3>
      <div className="grid">
        <button className="secondary">Edit Notes</button>
        <button className="secondary">Swap Exercise</button>
        <button style={{ background: '#9a3412' }}>Delete Exercise</button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
