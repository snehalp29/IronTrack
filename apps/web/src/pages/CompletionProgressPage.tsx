import { Link } from 'react-router-dom';

export function CompletionProgressPage() {
  return (
    <div className="card">
      <h1>Weekly Progress</h1>
      <p className="meta">Muscle coverage: 71%</p>
      <div className="two grid">
        <div className="card">Chest +2 sessions</div>
        <div className="card">Back +1 session</div>
      </div>
      <Link to="/workout/complete/next" className="button-link">
        Up Next
      </Link>
    </div>
  );
}
