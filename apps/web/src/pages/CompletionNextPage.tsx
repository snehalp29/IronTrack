import { Link } from 'react-router-dom';

export function CompletionNextPage() {
  return (
    <div className="card">
      <h1>Up Next</h1>
      <p className="meta">
        Recommended template: Pull Day B (targets underworked lats and rear
        delts)
      </p>
      <Link to="/workout/complete/streak">
        <button>See Streak</button>
      </Link>
    </div>
  );
}
