import { useSearchParams } from 'react-router-dom';

export function ExerciseDetailPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') ?? 'guide';

  return (
    <div className="card">
      <h1>Exercise Detail</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <a href="?tab=guide">
          <button className={tab === 'guide' ? undefined : 'secondary'}>
            Form Guide
          </button>
        </a>
        <a href="?tab=history">
          <button className={tab === 'history' ? undefined : 'secondary'}>
            History
          </button>
        </a>
      </div>
      {tab === 'guide' ? (
        <p className="meta">Coaching cues and setup instructions.</p>
      ) : (
        <p className="meta">
          Set history timeline and trend graph placeholder.
        </p>
      )}
    </div>
  );
}
