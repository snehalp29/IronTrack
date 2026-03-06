import { Link } from 'react-router-dom';

import { useDashboardPageData } from '../lib/web-data';

export function DashboardPage() {
  const data = useDashboardPageData();

  return (
    <div className="two grid">
      <section className="card">
        <h2>Today Overview</h2>
        {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
        <p className="meta">
          Current streak: {data.workoutStreakDays} day
          {data.workoutStreakDays === 1 ? '' : 's'}
        </p>
        <p className="meta">
          Checklist: {data.checklistCompleteCount} / {data.checklistTotalCount}{' '}
          complete
        </p>
        <Link to="/workout/template/new" className="button-link">
          Create Template
        </Link>
      </section>
      <section className="card">
        <h2>Next Workout</h2>
        <p>{data.nextTemplate?.name ?? 'Build your next template'}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            to={
              data.nextTemplate
                ? `/workout/${data.nextTemplate.id}/preview`
                : '/workout/template/new'
            }
            className="button-link secondary"
          >
            Preview
          </Link>
          <Link
            to={
              data.nextTemplate
                ? `/workout/${data.nextTemplate.id}/preview`
                : '/workout/template/new'
            }
            className="button-link"
          >
            Start
          </Link>
        </div>
      </section>
    </div>
  );
}
