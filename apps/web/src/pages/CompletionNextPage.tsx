import { Link } from 'react-router-dom';

import { useCompletionFlowData } from '../lib/web-data';

export function CompletionNextPage() {
  const data = useCompletionFlowData();

  return (
    <div className="card">
      <h1>Up Next</h1>
      <p className="meta">
        Recommended template:{' '}
        {data.recommendedTemplate?.name ?? 'Build a new workout'} (
        {data.recommendedTemplate?.reason ??
          'tailored to your current training'}
        )
      </p>
      {data.recommendedTemplate ? (
        <Link
          to={`/workout/${data.recommendedTemplate.id}/preview`}
          className="button-link secondary"
        >
          Preview Workout
        </Link>
      ) : null}
      <Link to="/workout/complete/streak" className="button-link">
        See Streak
      </Link>
    </div>
  );
}
