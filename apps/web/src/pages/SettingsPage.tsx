import { useRef } from 'react';

import { unstable_usePrompt, useBeforeUnload } from 'react-router-dom';

import { useSettingsPageData } from '../lib/web-data';

export function SettingsPage() {
  const data = useSettingsPageData();
  const isDirtyRef = useRef(data.isDirty);
  isDirtyRef.current = data.isDirty;

  unstable_usePrompt({
    message: 'You have unsaved changes. Leave this page?',
    when: ({ currentLocation, nextLocation }) =>
      data.isDirty &&
      currentLocation.pathname !== nextLocation.pathname &&
      !['/login', '/register'].includes(nextLocation.pathname),
  });
  useBeforeUnload((event) => {
    if (!isDirtyRef.current) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  });

  return (
    <div className="card">
      <h1>Settings</h1>
      {data.errorMessage ? <p className="meta">{data.errorMessage}</p> : null}
      {data.isDirty ? <p className="meta">You have unsaved changes.</p> : null}
      <form className="grid" onSubmit={data.onSave}>
        <label>
          Name
          <input value={data.name} onChange={data.onNameChange} />
        </label>
        <label>
          Timezone
          <select value={data.timezone} onChange={data.onTimezoneChange}>
            {data.timezones.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>
        </label>
        <label>
          Units
          <select
            value={data.unitPreference}
            onChange={data.onUnitPreferenceChange}
          >
            <option value="METRIC">Metric (kg)</option>
            <option value="IMPERIAL">Imperial (lb)</option>
          </select>
        </label>
        <label>
          Default Rest (seconds)
          <input
            type="number"
            min="1"
            value={data.restTimerDefaultSeconds}
            onChange={data.onRestTimerDefaultSecondsChange}
          />
        </label>
        <button type="submit" disabled={data.isSaving}>
          Save Settings
        </button>
        <button type="button" className="secondary" onClick={data.onLogout}>
          Logout
        </button>
        <button
          type="button"
          style={{ background: '#7f1d1d' }}
          onClick={data.onDeleteAccount}
        >
          Delete Account
        </button>
      </form>
    </div>
  );
}
