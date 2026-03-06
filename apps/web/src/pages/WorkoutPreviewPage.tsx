import { Link, useParams } from 'react-router-dom';

import { useWorkoutPreviewPageData } from '../lib/web-data';

export function WorkoutPreviewPage() {
  const { templateId } = useParams<'templateId'>();
  const data = useWorkoutPreviewPageData(templateId);

  if (!templateId || !data.template) {
    return (
      <div className="card">
        <h1>Workout Preview</h1>
        <p className="meta">{data.errorMessage ?? 'Template not found.'}</p>
        <Link to="/" className="button-link">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="card">
      <h1>Workout Preview</h1>
      <p className="meta">{data.template.name}</p>
      <ul>
        {data.template.exercises.map((exercise) => (
          <li key={exercise.id}>
            {exercise.name} - {exercise.setsLabel}
          </li>
        ))}
      </ul>
      <button className="button-link" onClick={data.onStartWorkout}>
        Start Workout
      </button>
    </div>
  );
}
