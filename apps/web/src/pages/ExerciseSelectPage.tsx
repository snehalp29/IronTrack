import { Link } from 'react-router-dom';

const exercises = ['Barbell Bench Press', 'Pull-Up', 'Barbell Back Squat'];

export function ExerciseSelectPage() {
  return (
    <div className="card">
      <h1>Select Exercise</h1>
      <div className="grid">
        {exercises.map((item) => (
          <button key={item} className="secondary">
            {item}
          </button>
        ))}
      </div>
      <Link to="/exercise/create">
        <button style={{ marginTop: 12 }}>Create New Exercise</button>
      </Link>
    </div>
  );
}
