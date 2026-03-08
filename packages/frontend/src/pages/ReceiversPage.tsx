import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.js';
import { api } from '../api/client.js';
import type { ReceiverStatusDTO } from '@heartbeat/shared';
import { Radio, Wifi, WifiOff, Pencil, Check, X } from 'lucide-react';
import { useCanWrite } from '../hooks/useCanWrite.js';
import { timeAgo } from '../utils/formatTime.js';

export function ReceiversPage() {
  const { canWriteReceivers } = useCanWrite();
  const { socket } = useSocket();
  const [receivers, setReceivers] = useState<ReceiverStatusDTO[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const fetchReceivers = useCallback(async () => {
    const res = await api.get('/receivers');
    setReceivers(res.data.data);
  }, []);

  useEffect(() => { fetchReceivers(); }, [fetchReceivers]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data: ReceiverStatusDTO) => {
      setReceivers((prev) => prev.map((r) =>
        r.receiverHwId === data.receiverHwId ? { ...r, ...data } : r
      ));
    };
    socket.on('receiver:heartbeat', handler);
    socket.on('receiver:status', handler);
    return () => { socket.off('receiver:heartbeat', handler); socket.off('receiver:status', handler); };
  }, [socket]);

  const startEdit = (r: ReceiverStatusDTO) => {
    setEditId(r.id);
    setEditName(r.name);
    setEditLocation(r.locationLabel || '');
  };

  const handleSave = async () => {
    if (editId) {
      await api.put(`/receivers/${editId}`, { name: editName, locationLabel: editLocation || undefined });
      setEditId(null);
      fetchReceivers();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Radio className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Receivers</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">({receivers.length})</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {receivers.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {r.isOnline ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-gray-400" />
                )}
                {canWriteReceivers && editId === r.id ? (
                  <input className="input text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
                ) : (
                  <h3 className="font-semibold dark:text-gray-100">{r.name}</h3>
                )}
              </div>
              {canWriteReceivers && (editId === r.id ? (
                <div className="flex gap-1">
                  <button onClick={handleSave} className="btn-ghost p-1 text-green-600"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditId(null)} className="btn-ghost p-1"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <button onClick={() => startEdit(r)} className="btn-ghost p-1"><Pencil className="h-3 w-3" /></button>
              ))}
            </div>

            {canWriteReceivers && editId === r.id && (
              <input className="input mt-2 text-sm" placeholder="Location Label" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            )}

            <div className="mt-3 space-y-1 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Status</span>
                <span className={r.isOnline ? 'text-green-600 dark:text-green-400 font-medium' : 'text-gray-400 dark:text-gray-500'}>{r.isOnline ? 'Online' : 'Offline'}</span>
              </div>
              {r.locationLabel && (
                <div className="flex justify-between">
                  <span>Location</span>
                  <span className="text-gray-700 dark:text-gray-300">{r.locationLabel}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>HW ID</span>
                <span className="font-mono">{r.receiverHwId}</span>
              </div>
              {r.ipAddress && (
                <div className="flex justify-between">
                  <span>IP</span>
                  <span className="font-mono">{r.ipAddress}</span>
                </div>
              )}
              {r.firmwareVersion && (
                <div className="flex justify-between">
                  <span>Firmware</span>
                  <span>{r.firmwareVersion}</span>
                </div>
              )}
              {r.wifiRssi !== null && (
                <div className="flex justify-between">
                  <span>WiFi RSSI</span>
                  <span>{r.wifiRssi} dBm</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Last Heartbeat</span>
                <span>{timeAgo(r.lastHeartbeatAt)}</span>
              </div>
            </div>
          </div>
        ))}
        {receivers.length === 0 && (
          <p className="col-span-full py-8 text-center text-gray-400 dark:text-gray-500">
            No receivers detected. ESP32 receivers will auto-register when they send their first packet.
          </p>
        )}
      </div>
    </div>
  );
}
