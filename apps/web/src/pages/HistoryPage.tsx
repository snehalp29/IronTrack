const mockHistory = [
  { date: '2026-02-27', name: 'Push Day A', duration: '52m', volume: '12,450' },
  { date: '2026-02-25', name: 'Pull Day A', duration: '49m', volume: '11,230' },
  { date: '2026-02-23', name: 'Leg Day A', duration: '67m', volume: '15,900' },
];

export function HistoryPage() {
  return (
    <div className="card">
      <h1>Workout History</h1>
      <div className="grid">
        {mockHistory.map((item) => (
          <article key={item.date + item.name} className="card">
            <h3>{item.name}</h3>
            <p className="meta">{item.date}</p>
            <p className="meta">Duration: {item.duration}</p>
            <p className="meta">Volume: {item.volume}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
