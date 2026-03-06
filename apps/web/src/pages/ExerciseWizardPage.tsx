import { useExerciseWizardPageData } from '../lib/web-data';

export function ExerciseWizardPage() {
  const data = useExerciseWizardPageData();

  return (
    <div className="card">
      <h1>Create / Edit Exercise</h1>
      <p className="meta">
        Step {data.step} of {data.totalSteps}: {data.currentStepLabel}
      </p>
      {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
      <div className="grid">
        <label>
          Name
          <input
            value={data.formValues.name}
            onChange={(event) => data.onChangeField('name', event.target.value)}
          />
        </label>
        <label>
          Description
          <textarea
            id="exercise-step-content"
            rows={4}
            value={data.formValues.description}
            onChange={(event) =>
              data.onChangeField('description', event.target.value)
            }
          />
        </label>
        <label>
          Exercise Type
          <select
            value={data.formValues.exerciseType}
            onChange={(event) =>
              data.onChangeField('exerciseType', event.target.value)
            }
          >
            <option value="WEIGHT_REPS">Weight + Reps</option>
            <option value="BODYWEIGHT">Bodyweight</option>
            <option value="DURATION">Duration</option>
            <option value="REPS_ONLY">Reps Only</option>
            <option value="BODYWEIGHT_PLUS_WEIGHT">Bodyweight + Weight</option>
          </select>
        </label>
        <label>
          Primary Muscle
          <select
            value={data.formValues.primaryMuscleGroupId}
            onChange={(event) =>
              data.onChangeField('primaryMuscleGroupId', event.target.value)
            }
          >
            <option value="">Select one</option>
            {data.options.muscleGroups.map((muscle) => (
              <option key={muscle.id} value={muscle.id}>
                {muscle.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Secondary Muscles
          <select
            multiple
            value={data.formValues.secondaryMuscleGroupIds}
            onChange={(event) =>
              data.onChangeField(
                'secondaryMuscleGroupIds',
                Array.from(event.target.selectedOptions).map(
                  (option) => option.value,
                ),
              )
            }
          >
            {data.options.muscleGroups.map((muscle) => (
              <option key={muscle.id} value={muscle.id}>
                {muscle.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Equipment
          <select
            multiple
            value={data.formValues.equipmentIds}
            onChange={(event) =>
              data.onChangeField(
                'equipmentIds',
                Array.from(event.target.selectedOptions).map(
                  (option) => option.value,
                ),
              )
            }
          >
            {data.options.equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Default Sets
          <input
            type="number"
            value={data.formValues.defaultSets}
            onChange={(event) =>
              data.onChangeField('defaultSets', event.target.value)
            }
          />
        </label>
        <label>
          Rep Min
          <input
            type="number"
            value={data.formValues.repMin}
            onChange={(event) =>
              data.onChangeField('repMin', event.target.value)
            }
          />
        </label>
        <label>
          Rep Max
          <input
            type="number"
            value={data.formValues.repMax}
            onChange={(event) =>
              data.onChangeField('repMax', event.target.value)
            }
          />
        </label>
        <label>
          Default Cues
          <textarea
            rows={4}
            value={data.formValues.defaultCues}
            onChange={(event) =>
              data.onChangeField('defaultCues', event.target.value)
            }
          />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="secondary" onClick={data.onBack}>
          Back
        </button>
        {data.isSubmitStep ? (
          <button onClick={data.onSubmit} disabled={data.isSubmitting}>
            Submit Exercise
          </button>
        ) : (
          <button onClick={data.onNext}>Next</button>
        )}
      </div>
    </div>
  );
}
