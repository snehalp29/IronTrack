import { Link } from 'react-router-dom';

import { useCompletionFlowData } from '../lib/web-data';

export function CompletionProgressPage() {
  const data = useCompletionFlowData();

  return (
    <div className="card">
      <h1>Weekly Progress</h1>
      <p className="meta">{data.weeklyCoverageLabel}</p>
      <div className="two grid">
        {data.progressCards.map((card) => (
          <div key={card} className="card">
            {card}
          </div>
        ))}
      </div>
      <Link to="/workout/complete/next" className="button-link">
        Up Next
      </Link>
    </div>
  );
}
