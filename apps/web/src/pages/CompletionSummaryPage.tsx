import { Link } from 'react-router-dom';

import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';

export function CompletionSummaryPage() {
  const summary = useActiveWorkoutStore((state) => state.completeSummary);

  return (
    <div className="card">
      <h1>Summary</h1>
      <p className="meta">Volume: {summary?.totalVolume ?? 0}</p>
      <p className="meta">Duration: {summary?.durationSeconds ?? 0}s</p>
      <p className="meta">PRs: {summary?.prs ?? 0}</p>
      <Link to="/workout/complete/progress">
        <button>Weekly Progress</button>
      </Link>
    </div>
  );
}
