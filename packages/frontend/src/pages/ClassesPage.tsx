import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client.js';
import type { ParticipantDTO } from '@heartbeat/shared';
import { BookOpen, Plus, Pencil, Archive, Users, UserPlus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useCanWrite } from '../hooks/useCanWrite.js';

interface ClassParticipantItem {
  id: string;
  participantId: string;
  participant: {
    id: string;
    firstName: string;
    lastName: string;
    company: string;
  };
}

interface ClassDetail {
  id: string;
  name: string;
  courseType: string | null;
  description: string | null;
  isArchived: boolean;
  classParticipants: ClassParticipantItem[];
}

interface ClassItem {
  id: string;
  name: string;
  courseType: string | null;
  description: string | null;
  participantCount: number;
  isArchived: boolean;
}

export function ClassesPage() {
  const { canWriteClasses } = useCanWrite();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [courseType, setCourseType] = useState('');
  const [description, setDescription] = useState('');

  // Roster management
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [allParticipants, setAllParticipants] = useState<ParticipantDTO[]>([]);
  const [addParticipantId, setAddParticipantId] = useState('');

  const fetchClasses = useCallback(async () => {
    const res = await api.get('/classes');
    setClasses(res.data.data);
  }, []);

  const fetchAllParticipants = useCallback(async () => {
    const res = await api.get('/participants?active=true');
    setAllParticipants(res.data.data);
  }, []);

  const fetchClassDetail = useCallback(async (classId: string) => {
    const res = await api.get(`/classes/${classId}`);
    setClassDetail(res.data.data);
  }, []);

  useEffect(() => { fetchClasses(); fetchAllParticipants(); }, [fetchClasses, fetchAllParticipants]);

  const toggleExpand = async (classId: string) => {
    if (expandedClassId === classId) {
      setExpandedClassId(null);
      setClassDetail(null);
    } else {
      setExpandedClassId(classId);
      await fetchClassDetail(classId);
    }
  };

  const handleSubmit = async () => {
    if (editId) {
      await api.put(`/classes/${editId}`, { name, courseType: courseType || undefined, description: description || undefined });
    } else {
      await api.post('/classes', { name, courseType: courseType || undefined, description: description || undefined });
    }
    resetForm();
    fetchClasses();
  };

  const startEdit = (c: ClassItem) => {
    setEditId(c.id);
    setName(c.name);
    setCourseType(c.courseType || '');
    setDescription(c.description || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditId(null);
    setName('');
    setCourseType('');
    setDescription('');
    setShowForm(false);
  };

  const handleArchive = async (id: string) => {
    await api.delete(`/classes/${id}`);
    fetchClasses();
  };

  const handleAddParticipant = async (classId: string) => {
    if (!addParticipantId) return;
    await api.post(`/classes/${classId}/participants`, { participantIds: [addParticipantId] });
    setAddParticipantId('');
    await fetchClassDetail(classId);
    fetchClasses();
  };

  const handleRemoveParticipant = async (classId: string, participantId: string) => {
    await api.delete(`/classes/${classId}/participants/${participantId}`);
    await fetchClassDetail(classId);
    fetchClasses();
  };

  const activeClasses = classes.filter((c) => !c.isArchived);

  // Participants not already in the expanded class
  const availableParticipants = classDetail
    ? allParticipants.filter(
        (p) => !classDetail.classParticipants.some((cp) => cp.participantId === p.id)
      )
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Classes</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">({activeClasses.length})</span>
        </div>
        {canWriteClasses && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus className="mr-1 h-4 w-4" /> New Class
          </button>
        )}
      </div>

      {canWriteClasses && showForm && (
        <div className="card space-y-3">
          <h3 className="font-semibold dark:text-gray-100">{editId ? 'Edit' : 'Create'} Class</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Class Name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Course Type (e.g. Live Fire)" value={courseType} onChange={(e) => setCourseType(e.target.value)} />
          </div>
          <textarea className="input" placeholder="Description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="btn-primary" disabled={!name}>{editId ? 'Update' : 'Create'}</button>
            <button onClick={resetForm} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {activeClasses.map((c) => (
          <div key={c.id} className="card">
            <div className="flex items-center justify-between">
              <button onClick={() => toggleExpand(c.id)} className="flex items-center gap-2 text-left">
                {expandedClassId === c.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                <div>
                  <h3 className="font-semibold dark:text-gray-100">{c.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {c.courseType && `${c.courseType} · `}
                    {c.participantCount} participants
                    {c.description && ` · ${c.description}`}
                  </p>
                </div>
              </button>
              {canWriteClasses && (
                <div className="flex gap-1">
                  <button onClick={() => startEdit(c)} className="btn-ghost p-1" title="Edit">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleArchive(c.id)} className="btn-ghost p-1 text-red-400" title="Archive">
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Expanded roster view */}
            {expandedClassId === c.id && classDetail && (
              <div className="mt-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Users className="h-4 w-4" />
                    Roster ({classDetail.classParticipants.length})
                  </div>
                </div>

                {/* Add participant (admin + instructor only) */}
                {canWriteClasses && (
                  <div className="mb-3 flex gap-2">
                    <select
                      className="input flex-1 text-sm"
                      value={addParticipantId}
                      onChange={(e) => setAddParticipantId(e.target.value)}
                    >
                      <option value="">Add participant to roster...</option>
                      {availableParticipants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.firstName} {p.lastName} — {p.company}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAddParticipant(c.id)}
                      className="btn-primary text-xs"
                      disabled={!addParticipantId}
                    >
                      <UserPlus className="mr-1 h-3 w-3" /> Add
                    </button>
                  </div>
                )}

                {/* Roster list */}
                {classDetail.classParticipants.length > 0 ? (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700 rounded-lg border border-gray-100 dark:border-gray-700">
                    {classDetail.classParticipants.map((cp) => (
                      <div key={cp.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div>
                          <span className="font-medium dark:text-gray-200">{cp.participant.firstName} {cp.participant.lastName}</span>
                          <span className="ml-2 text-gray-500 dark:text-gray-400">{cp.participant.company}</span>
                        </div>
                        {canWriteClasses && (
                          <button
                            onClick={() => handleRemoveParticipant(c.id, cp.participantId)}
                            className="rounded p-1 text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                            title="Remove from roster"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                    No participants in this class roster yet.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
        {activeClasses.length === 0 && (
          <p className="py-8 text-center text-gray-400 dark:text-gray-500">No classes yet. Create a class template to organize your training.</p>
        )}
      </div>
    </div>
  );
}
