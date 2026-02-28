interface Props {
  open: boolean;
  onClose: () => void;
}

export function IncompleteWarningModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="card" style={{ borderColor: '#9a3412' }}>
      <h3>Incomplete Workout</h3>
      <p className="meta">You still have unfinished sets. Finish anyway?</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ background: '#9a3412' }}>Finish Anyway</button>
        <button className="secondary" onClick={onClose}>
          Continue Workout
        </button>
      </div>
    </div>
  );
}
