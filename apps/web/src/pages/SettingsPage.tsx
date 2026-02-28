export function SettingsPage() {
  return (
    <div className="card">
      <h1>Settings</h1>
      <div className="grid">
        <label>
          Name
          <input defaultValue="Iron Lifter" />
        </label>
        <label>
          Timezone
          <select defaultValue="UTC">
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
          </select>
        </label>
        <label>
          Units
          <select defaultValue="METRIC">
            <option value="METRIC">Metric (kg)</option>
            <option value="IMPERIAL">Imperial (lb)</option>
          </select>
        </label>
        <button>Save Settings</button>
        <button className="secondary">Logout</button>
        <button style={{ background: '#7f1d1d' }}>Delete Account</button>
      </div>
    </div>
  );
}
