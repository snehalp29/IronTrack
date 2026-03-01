import { Link } from 'react-router-dom';

export function DashboardPage() {
  return (
    <div className="two grid">
      <section className="card">
        <h2>Today Overview</h2>
        <p className="meta">Current streak: 7 days</p>
        <p className="meta">Checklist: 3 / 4 complete</p>
        <Link to="/workout/template/new" className="button-link">
          Create Template
        </Link>
      </section>
      <section className="card">
        <h2>Next Workout</h2>
        <p>Push Day A</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/workout/123/preview" className="button-link secondary">
            Preview
          </Link>
          <Link to="/workout/active" className="button-link">
            Start
          </Link>
        </div>
      </section>
    </div>
  );
}
