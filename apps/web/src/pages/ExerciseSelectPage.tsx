import { useExerciseSelectPageData } from '../lib/web-data';

export function ExerciseSelectPage() {
  const data = useExerciseSelectPageData();

  return (
    <div className="card">
      <h1>Select Exercise</h1>
      {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
      <div className="grid">
        {data.items.map((item) => (
          <button
            key={item.id}
            className="secondary"
            onClick={() => data.onSelectExercise(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <button
        className="button-link"
        style={{ marginTop: 12 }}
        onClick={data.onCreateExercise}
      >
        Create New Exercise
      </button>
    </div>
  );
}
