interface Props {
  open: boolean;
  onClose: () => void;
}

export function ReorderModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="card" style={{ borderColor: '#c27f56' }}>
      <h3>Reorder Exercises</h3>
      <p className="meta">Drag-and-drop list placeholder.</p>
      <button onClick={onClose}>Done</button>
    </div>
  );
}
