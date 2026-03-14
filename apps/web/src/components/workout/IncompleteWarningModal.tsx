import { focusInitialModalTarget, handleModalKeyDown } from './modal-focus';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function IncompleteWarningModal({ open, onClose, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div
      className="card modal modal--warning"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="incomplete-warning-title"
      aria-describedby="incomplete-warning-description"
      ref={focusInitialModalTarget}
      tabIndex={-1}
      onKeyDown={(event) => handleModalKeyDown(event, onClose)}
    >
      <h3 id="incomplete-warning-title">Incomplete Workout</h3>
      <p id="incomplete-warning-description" className="meta">
        You still have unfinished sets. Finish anyway?
      </p>
      <div className="modal__actions">
        <button type="button" className="danger" onClick={onConfirm}>
          Finish Anyway
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Continue Workout
        </button>
      </div>
    </div>
  );
}
