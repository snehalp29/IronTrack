import { useTemplateBuilderPageData } from '../lib/web-data';

export const TOTAL_TEMPLATE_STEPS = 4;

export function TemplateBuilderPage() {
  const data = useTemplateBuilderPageData();
  const selectedExercises = data.exercises.filter(
    (exercise) => exercise.selected,
  );

  const renderStepContent = () => {
    switch (data.step) {
      case 1:
        return (
          <label htmlFor="template-name">
            Template Name
            <input
              id="template-name"
              placeholder="Template Name"
              value={data.name}
              onChange={(event) => data.onChangeName(event.target.value)}
            />
          </label>
        );
      case 2:
        return (
          <>
            {data.exercises.map((exercise) => (
              <div key={exercise.id} className="card">
                <label>
                  <input
                    type="checkbox"
                    checked={exercise.selected}
                    onChange={() => data.onToggleExercise(exercise.id)}
                  />
                  {exercise.name}
                </label>
                {exercise.selected ? (
                  <div className="grid" style={{ marginTop: 12 }}>
                    <label htmlFor={`template-default-sets-${exercise.id}`}>
                      Default Sets for {exercise.name}
                      <input
                        id={`template-default-sets-${exercise.id}`}
                        type="number"
                        value={exercise.defaultSets}
                        onChange={(event) =>
                          data.onChangeExerciseField(
                            exercise.id,
                            'defaultSets',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label htmlFor={`template-rep-min-${exercise.id}`}>
                      Rep Min for {exercise.name}
                      <input
                        id={`template-rep-min-${exercise.id}`}
                        type="number"
                        value={exercise.repMin}
                        onChange={(event) =>
                          data.onChangeExerciseField(
                            exercise.id,
                            'repMin',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label htmlFor={`template-rep-max-${exercise.id}`}>
                      Rep Max for {exercise.name}
                      <input
                        id={`template-rep-max-${exercise.id}`}
                        type="number"
                        value={exercise.repMax}
                        onChange={(event) =>
                          data.onChangeExerciseField(
                            exercise.id,
                            'repMax',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </div>
            ))}
          </>
        );
      case 3:
        return selectedExercises.length ? (
          <>
            {selectedExercises.map((exercise) => (
              <div key={exercise.id} className="card">
                <p className="meta">{exercise.name}</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => data.onMoveExercise(exercise.id, -1)}
                  >
                    Move {exercise.name} Up
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => data.onMoveExercise(exercise.id, 1)}
                  >
                    Move {exercise.name} Down
                  </button>
                </div>
                <label htmlFor={`template-superset-${exercise.id}`}>
                  Superset group for {exercise.name}
                  <input
                    id={`template-superset-${exercise.id}`}
                    value={exercise.supersetGroupKey}
                    onChange={(event) =>
                      data.onChangeExerciseField(
                        exercise.id,
                        'supersetGroupKey',
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>
            ))}
          </>
        ) : (
          <p className="meta">Select exercises on the previous step first.</p>
        );
      default:
        return (
          <>
            <div className="card">
              <p className="meta">{data.name || 'Unnamed template'}</p>
              {selectedExercises.map((exercise) => (
                <p key={exercise.id} className="meta">
                  {exercise.name}
                </p>
              ))}
            </div>
            <label htmlFor="template-description">
              Final review and notes
              <textarea
                id="template-description"
                placeholder="Final review and notes"
                rows={6}
                value={data.description}
                onChange={(event) =>
                  data.onChangeDescription(event.target.value)
                }
              />
            </label>
          </>
        );
    }
  };

  return (
    <div className="card">
      <h1>Template Builder</h1>
      <p className="meta">
        Step {data.step} of {data.totalSteps}: {data.currentStepLabel}
      </p>
      {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
      {data.isLoading ? <p className="meta">Loading exercises…</p> : null}
      <div className="grid">{renderStepContent()}</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="secondary" type="button" onClick={data.onBack}>
          Back
        </button>
        {data.isSubmitStep ? (
          <button
            type="button"
            onClick={data.onSubmit}
            disabled={data.isSubmitting}
          >
            Create Template
          </button>
        ) : (
          <button type="button" onClick={data.onNext}>
            Next
          </button>
        )}
      </div>
    </div>
  );
}
