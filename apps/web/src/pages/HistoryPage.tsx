import { useHistoryPageData } from '../lib/web-data';

export function HistoryPage() {
  const data = useHistoryPageData();

  return (
    <div className="card">
      <h1>Workout History</h1>
      {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
      <div className="grid">
        {data.items.map((item) => (
          <article key={item.id} className="card">
            <h3>{item.templateName}</h3>
            <p className="meta">{item.startedAt}</p>
            <p className="meta">Duration: {item.durationLabel}</p>
            <p className="meta">Volume: {item.volumeLabel}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
