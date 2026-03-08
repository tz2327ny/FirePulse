import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client.js';
import type { DeviceDTO, ParticipantDTO } from '@heartbeat/shared';
import { Watch, Link, Unlink, EyeOff } from 'lucide-react';
import { useCanWrite } from '../hooks/useCanWrite.js';

export function DevicesPage() {
  const { canWriteDevices } = useCanWrite();
  const [devices, setDevices] = useState<DeviceDTO[]>([]);
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [assignDeviceId, setAssignDeviceId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState('');

  const fetchDevices = useCallback(async () => {
    const res = await api.get('/devices');
    setDevices(res.data.data);
  }, []);

  const fetchParticipants = useCallback(async () => {
    const res = await api.get('/participants?active=true');
    setParticipants(res.data.data);
  }, []);

  useEffect(() => { fetchDevices(); fetchParticipants(); }, [fetchDevices, fetchParticipants]);

  const handleAssign = async (deviceId: string) => {
    if (!selectedParticipant) return;
    await api.post(`/devices/${deviceId}/assign`, { participantId: selectedParticipant });
    setAssignDeviceId(null);
    setSelectedParticipant('');
    fetchDevices();
  };

  const handleUnassign = async (deviceId: string) => {
    await api.post(`/devices/${deviceId}/unassign`);
    fetchDevices();
  };

  const handleIgnore = async (deviceId: string) => {
    await api.post(`/devices/${deviceId}/ignore`, { ignored: true });
    fetchDevices();
  };

  const activeDevices = devices.filter((d) => !d.isArchived && !d.isIgnored);
  const ignoredDevices = devices.filter((d) => d.isIgnored);

  const participantDeviceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of devices) {
      if (d.currentParticipantId) {
        map.set(d.currentParticipantId, d.shortId);
      }
    }
    return map;
  }, [devices]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Watch className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Devices</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">({activeDevices.length} active)</span>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3">Short ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Assigned To</th>
              {canWriteDevices && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {activeDevices.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-mono font-medium dark:text-gray-200">{d.shortId}</td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{d.deviceName || '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{d.deviceType.replace('_', ' ')}</td>
                <td className="px-4 py-3">
                  {canWriteDevices && assignDeviceId === d.id ? (
                    <div className="flex gap-2">
                      <select
                        className="input text-xs"
                        value={selectedParticipant}
                        onChange={(e) => setSelectedParticipant(e.target.value)}
                      >
                        <option value="">Select participant...</option>
                        {[...participants]
                          .sort((a, b) => {
                            const aAssigned = participantDeviceMap.has(a.id) ? 1 : 0;
                            const bAssigned = participantDeviceMap.has(b.id) ? 1 : 0;
                            if (aAssigned !== bAssigned) return aAssigned - bAssigned;
                            return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
                          })
                          .map((p) => {
                            const assignedDevice = participantDeviceMap.get(p.id);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.firstName} {p.lastName}{assignedDevice ? ` — Device ${assignedDevice}` : ''}
                              </option>
                            );
                          })}
                      </select>
                      <button onClick={() => handleAssign(d.id)} className="btn-primary text-xs py-1">Assign</button>
                      <button onClick={() => setAssignDeviceId(null)} className="btn-secondary text-xs py-1">Cancel</button>
                    </div>
                  ) : (
                    <span className="dark:text-gray-300">
                      {d.currentParticipantName || <span className="text-gray-400 dark:text-gray-500 italic">Unassigned</span>}
                    </span>
                  )}
                </td>
                {canWriteDevices && (
                  <td className="px-4 py-3 text-right space-x-1">
                    {d.currentParticipantId ? (
                      <button onClick={() => handleUnassign(d.id)} className="btn-ghost p-1" title="Unassign">
                        <Unlink className="h-4 w-4" />
                      </button>
                    ) : (
                      <button onClick={() => setAssignDeviceId(d.id)} className="btn-ghost p-1" title="Assign">
                        <Link className="h-4 w-4" />
                      </button>
                    )}
                    <button onClick={() => handleIgnore(d.id)} className="btn-ghost p-1 text-gray-400" title="Ignore">
                      <EyeOff className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ignoredDevices.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium text-gray-500 dark:text-gray-400">
            {ignoredDevices.length} ignored device{ignoredDevices.length > 1 ? 's' : ''}
          </summary>
          <ul className="mt-2 space-y-1 text-sm text-gray-400 dark:text-gray-500">
            {ignoredDevices.map((d) => (
              <li key={d.id}>{d.shortId} — {d.deviceName || d.macAddress}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
