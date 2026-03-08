import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import type { ParticipantDTO } from '@heartbeat/shared';
import { Plus, Pencil, Archive, Users } from 'lucide-react';
import { useCanWrite } from '../hooks/useCanWrite.js';

export function ParticipantsPage() {
  const { canWriteParticipants } = useCanWrite();
  const [participants, setParticipants] = useState<ParticipantDTO[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [company, setCompany] = useState('');

  const fetchParticipants = useCallback(async () => {
    const res = await api.get('/participants');
    setParticipants(res.data.data);
  }, []);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  const handleSubmit = async () => {
    if (editId) {
      await api.put(`/participants/${editId}`, { firstName, lastName, company });
    } else {
      await api.post('/participants', { firstName, lastName, company });
    }
    resetForm();
    fetchParticipants();
  };

  const startEdit = (p: ParticipantDTO) => {
    setEditId(p.id);
    setFirstName(p.firstName);
    setLastName(p.lastName);
    setCompany(p.company);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditId(null);
    setFirstName('');
    setLastName('');
    setCompany('');
    setShowForm(false);
  };

  const handleArchive = async (id: string) => {
    await api.delete(`/participants/${id}`);
    fetchParticipants();
  };

  const activeParticipants = participants.filter((p) => !p.isArchived);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Participants</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">({activeParticipants.length})</span>
        </div>
        {canWriteParticipants && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus className="mr-1 h-4 w-4" /> Add Participant
          </button>
        )}
      </div>

      {canWriteParticipants && showForm && (
        <div className="card space-y-3">
          <h3 className="font-semibold dark:text-gray-100">{editId ? 'Edit' : 'Add'} Participant</h3>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className="input" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            <input className="input" placeholder="Company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="btn-primary">{editId ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              {canWriteParticipants && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {activeParticipants.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-medium">
                  <Link to={`/participants/${p.id}`} className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{p.company}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">Active</span>
                </td>
                {canWriteParticipants && (
                <td className="px-4 py-3 text-right">
                  <button onClick={() => startEdit(p)} className="btn-ghost p-1" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleArchive(p.id)} className="btn-ghost p-1 text-red-400 hover:text-red-600" title="Archive">
                    <Archive className="h-4 w-4" />
                  </button>
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
