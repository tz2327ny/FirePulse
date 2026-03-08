import { useState } from 'react';
import { X } from 'lucide-react';
import { RehabCheckpointType, CheckpointDisposition } from '@heartbeat/shared';
import type { CreateCheckpointRequest } from '@heartbeat/shared';

interface CheckpointModalProps {
  participantName: string;
  liveHr?: number | null;
  onSave: (data: CreateCheckpointRequest) => Promise<void>;
  onClose: () => void;
}

const CHECKPOINT_TYPES = [
  { value: RehabCheckpointType.REHAB_ROUTINE, label: 'Routine Check' },
  { value: RehabCheckpointType.REHAB_EVAL, label: 'Evaluation' },
];

const DISPOSITIONS = [
  { value: '', label: '-- Select --' },
  { value: CheckpointDisposition.CLEARED, label: 'Cleared' },
  { value: CheckpointDisposition.HOLD_EVAL, label: 'Hold for Evaluation' },
  { value: CheckpointDisposition.NOT_CLEARED, label: 'Not Cleared' },
];

const TEMP_METHODS = [
  { value: '', label: '-- Select --' },
  { value: 'oral', label: 'Oral' },
  { value: 'tympanic', label: 'Tympanic' },
  { value: 'axillary', label: 'Axillary' },
  { value: 'rectal', label: 'Rectal' },
];

export function CheckpointModal({ participantName, liveHr, onSave, onClose }: CheckpointModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    checkpointType: RehabCheckpointType.REHAB_ROUTINE as string,
    manualHr: liveHr?.toString() || '',
    bpSystolic: '',
    bpDiastolic: '',
    respirations: '',
    spo2: '',
    temperature: '',
    temperatureMethod: '',
    note: '',
    disposition: '',
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: CreateCheckpointRequest = {
        checkpointType: form.checkpointType,
      };
      if (form.manualHr) data.manualHr = parseInt(form.manualHr, 10);
      if (form.bpSystolic) data.bpSystolic = parseInt(form.bpSystolic, 10);
      if (form.bpDiastolic) data.bpDiastolic = parseInt(form.bpDiastolic, 10);
      if (form.respirations) data.respirations = parseInt(form.respirations, 10);
      if (form.spo2) data.spo2 = parseInt(form.spo2, 10);
      if (form.temperature) data.temperature = parseFloat(form.temperature);
      if (form.temperatureMethod) data.temperatureMethod = form.temperatureMethod;
      if (form.note.trim()) data.note = form.note.trim();
      if (form.disposition) data.disposition = form.disposition;

      await onSave(data);
      onClose();
    } catch (err) {
      console.error('Failed to save checkpoint', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl my-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Checkpoint</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{participantName}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form id="checkpoint-form" onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Checkpoint Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Checkpoint Type</label>
            <select
              value={form.checkpointType}
              onChange={(e) => handleChange('checkpointType', e.target.value)}
              className="input w-full"
            >
              {CHECKPOINT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Vitals Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Heart Rate (bpm)
                {liveHr != null && (
                  <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">Live: {liveHr}</span>
                )}
              </label>
              <input
                type="number"
                value={form.manualHr}
                onChange={(e) => handleChange('manualHr', e.target.value)}
                placeholder="HR"
                min={20}
                max={300}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SpO2 (%)</label>
              <input
                type="number"
                value={form.spo2}
                onChange={(e) => handleChange('spo2', e.target.value)}
                placeholder="SpO2"
                min={0}
                max={100}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BP Systolic</label>
              <input
                type="number"
                value={form.bpSystolic}
                onChange={(e) => handleChange('bpSystolic', e.target.value)}
                placeholder="Systolic"
                min={50}
                max={300}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">BP Diastolic</label>
              <input
                type="number"
                value={form.bpDiastolic}
                onChange={(e) => handleChange('bpDiastolic', e.target.value)}
                placeholder="Diastolic"
                min={20}
                max={200}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Respirations</label>
              <input
                type="number"
                value={form.respirations}
                onChange={(e) => handleChange('respirations', e.target.value)}
                placeholder="Resp"
                min={0}
                max={100}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature (F)</label>
              <input
                type="number"
                step="0.1"
                value={form.temperature}
                onChange={(e) => handleChange('temperature', e.target.value)}
                placeholder="Temp"
                min={80}
                max={115}
                className="input w-full"
              />
            </div>
          </div>

          {/* Temperature Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Temperature Method</label>
            <select
              value={form.temperatureMethod}
              onChange={(e) => handleChange('temperatureMethod', e.target.value)}
              className="input w-full"
            >
              {TEMP_METHODS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.note}
              onChange={(e) => handleChange('note', e.target.value)}
              rows={2}
              className="input w-full resize-none"
              placeholder="Optional notes..."
            />
          </div>

          {/* Disposition */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Disposition</label>
            <select
              value={form.disposition}
              onChange={(e) => handleChange('disposition', e.target.value)}
              className="input w-full"
            >
              {DISPOSITIONS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

        </form>

        {/* Buttons — fixed at bottom */}
        <div className="flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" form="checkpoint-form" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Checkpoint'}
          </button>
        </div>
      </div>
    </div>
  );
}
