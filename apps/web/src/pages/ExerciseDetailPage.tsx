import { useEffect } from 'react';

import { useSearchParams } from 'react-router-dom';

import { useExerciseDetailPageData } from '../lib/web-data';

export function ExerciseDetailPage() {
  const data = useExerciseDetailPageData();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab = rawTab === 'history' ? 'history' : 'guide';
  const setTab = (nextTab: 'guide' | 'history') => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', nextTab);
    setSearchParams(nextSearchParams, { replace: true });
  };

  useEffect(() => {
    if (!rawTab || rawTab === 'guide' || rawTab === 'history') {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.set('tab', 'guide');
    setSearchParams(nextSearchParams, { replace: true });
  }, [rawTab, searchParams, setSearchParams]);

  return (
    <div className="card">
      <h1>{data.exercise?.name ?? 'Exercise Detail'}</h1>
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
      {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
      {data.isLoading ? <p className="meta">Loading exercise…</p> : null}
      {tab === 'guide' && data.exercise ? (
        <div className="grid">
          <p className="meta">{data.exercise.description}</p>
          <p className="meta">Type: {data.exercise.exerciseTypeLabel}</p>
          <p className="meta">Primary muscle: {data.exercise.primaryMuscle}</p>
          <p className="meta">
            Secondary muscles:{' '}
            {data.exercise.secondaryMuscles.join(', ') || 'None'}
          </p>
          <p className="meta">
            Equipment: {data.exercise.equipment.join(', ') || 'None'}
          </p>
          <p className="meta">Defaults: {data.exercise.defaultSetsLabel}</p>
          <p className="meta">Rep range: {data.exercise.repRangeLabel}</p>
          {data.exercise.note ? (
            <p className="meta">{data.exercise.note}</p>
          ) : null}
        </div>
      ) : null}
      {tab === 'history' ? (
        data.historyItems.length ? (
          <div className="grid">
            {data.historyItems.map((item) => (
              <p key={item.id} className="meta">
                {item.startedAt} · {item.performanceLabel}
              </p>
            ))}
          </div>
        ) : (
          <p className="meta">No exercise history yet.</p>
        )
      ) : null}
    </div>
  );
}
