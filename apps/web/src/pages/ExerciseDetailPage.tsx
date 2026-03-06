import { useSearchParams } from 'react-router-dom';

export function ExerciseDetailPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab = rawTab === 'history' ? 'history' : 'guide';
  const setTab = (nextTab: 'guide' | 'history') => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', nextTab);
    setSearchParams(nextSearchParams, { replace: true });
  };

  if (rawTab && rawTab !== 'guide' && rawTab !== 'history') {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', 'guide');
    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <div className="card">
      <h1>Exercise Detail</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          className={tab === 'guide' ? undefined : 'secondary'}
          onClick={() => setTab('guide')}
          type="button"
        >
          Form Guide
        </button>
        <button
          className={tab === 'history' ? undefined : 'secondary'}
          onClick={() => setTab('history')}
          type="button"
        >
          History
        </button>
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
