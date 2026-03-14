import { useNavigate } from 'react-router-dom';

import { useCompletionFlowData } from '../lib/web-data';

export function CompletionStreakPage() {
  const navigate = useNavigate();
  const data = useCompletionFlowData();

  return (
    <div className="card">
      <h1>Streak</h1>
      <p style={{ fontSize: 48, margin: '8px 0', fontWeight: 700 }}>
        {data.streakDays} days
      </p>
      <p className="meta">Animated streak celebration placeholder.</p>
      <button
        onClick={() => {
          navigate('/', {
            state: {
              clearCompletedWorkout: true,
            },
          });
        }}
      >
        Back to Dashboard
      </button>
    </div>
  );
}
