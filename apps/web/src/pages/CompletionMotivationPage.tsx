import { Link } from 'react-router-dom';

export function CompletionMotivationPage() {
  return (
    <div className="card">
      <h1>Workout Complete</h1>
      <p className="meta">Consistency compounds. You showed up again.</p>
      <Link to="/workout/complete/summary" className="button-link">
        View Summary
      </Link>
    </div>
  );
}
