import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import type { SettingDTO } from '@heartbeat/shared';
import { Settings, Save } from 'lucide-react';

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingDTO[]>([]);
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await api.get('/settings');
    setSettings(res.data.data);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleChange = (key: string, value: string) => {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = Array.from(edits.entries()).map(([key, value]) => ({ key, value }));
    if (updates.length > 0) {
      await api.put('/settings', { settings: updates });
    }
    setSaving(false);
    setSaved(true);
    setEdits(new Map());
    fetchSettings();
  };

  const getValue = (key: string, original: string) => {
    return edits.has(key) ? edits.get(key)! : original;
  };

  const groupedSettings = {
    'Heart Rate Thresholds': settings.filter((s) => s.key.startsWith('hr_')),
    'Freshness': settings.filter((s) => s.key.startsWith('freshness_')),
    'Alerts': settings.filter((s) => s.key.startsWith('alert_')),
    'System': settings.filter((s) => !s.key.startsWith('hr_') && !s.key.startsWith('freshness_') && !s.key.startsWith('alert_')),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          {saved && <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>}
          <button onClick={handleSave} className="btn-primary" disabled={saving || edits.size === 0}>
            <Save className="mr-1 h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {Object.entries(groupedSettings).map(([group, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={group} className="card">
            <h3 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">{group}</h3>
            <div className="space-y-3">
              {items.map((s) => (
                <div key={s.key} className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{s.key}</label>
                    {s.description && <p className="text-xs text-gray-400 dark:text-gray-500">{s.description}</p>}
                  </div>
                  <input
                    className="input w-40 text-right"
                    value={getValue(s.key, s.value)}
                    onChange={(e) => handleChange(s.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
