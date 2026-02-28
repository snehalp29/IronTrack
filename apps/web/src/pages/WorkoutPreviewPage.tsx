import { Link, useParams } from 'react-router-dom';

export function WorkoutPreviewPage() {
  const { templateId } = useParams();

  return (
    <div className="card">
      <h1>Workout Preview</h1>
      <p className="meta">Template ID: {templateId}</p>
      <ul>
        <li>Barbell Bench Press - 4 x 8</li>
        <li>Incline Dumbbell Press - 3 x 10</li>
        <li>Cable Fly - 3 x 12</li>
      </ul>
      <Link to="/workout/active">
        <button>Start Workout</button>
      </Link>
    </div>
  );
}
