import { useNavigate } from 'react-router-dom';

import { useActiveWorkoutStore } from '../stores/activeWorkoutStore';

export function CompletionStreakPage() {
  const navigate = useNavigate();
  const clear = useActiveWorkoutStore((state) => state.clear);

  return (
    <div className="card">
      <h1>Streak</h1>
      <p style={{ fontSize: 48, margin: '8px 0', fontWeight: 700 }}>8 days</p>
      <p className="meta">Animated streak celebration placeholder.</p>
      <button
        onClick={() => {
          clear();
          navigate('/');
        }}
      >
        Back to Dashboard
      </button>
    </div>
  );
}
