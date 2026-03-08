import { Link } from 'react-router-dom';

import { formatDurationLabel, formatNumber } from '../lib/web-data';
import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';

export function CompletionSummaryPage() {
  const summary = useActiveWorkoutStore((state) => state.completeSummary);

  if (!summary) {
    return (
      <div className="card">
        <h1>Summary</h1>
        <p className="meta">No completed workout summary is available.</p>
        <Link to="/" className="button-link">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Summary</h1>
      <p className="meta">Volume: {formatNumber(summary.totalVolume)}</p>
      <p className="meta">
        Duration: {formatDurationLabel(summary.durationSeconds)}
      </p>
      <p className="meta">PRs: {summary.prs}</p>
      <Link to="/workout/complete/progress" className="button-link">
        Weekly Progress
      </Link>
    </div>
  );
}
