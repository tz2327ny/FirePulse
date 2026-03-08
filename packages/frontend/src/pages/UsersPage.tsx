import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import type { AdminUserDTO } from '@heartbeat/shared';
import { UserRole } from '@heartbeat/shared';
import { Plus, Pencil, UserX, UserCheck, ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn.js';

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
  instructor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  medical: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
};

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUserDTO[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.INSTRUCTOR);
  const [error, setError] = useState('');

  // Admin-only page guard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const fetchUsers = useCallback(async () => {
    const res = await api.get('/users');
    setUsers(res.data.data);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = async () => {
    setError('');
    try {
      if (editId) {
        const body: Record<string, string> = {};
        if (displayName) body.displayName = displayName;
        if (role) body.role = role;
        if (password) body.password = password;
        await api.put(`/users/${editId}`, body);
      } else {
        if (!username || !password || !displayName) {
          setError('All fields are required');
          return;
        }
        await api.post('/users', { username, password, displayName, role });
      }
      resetForm();
      fetchUsers();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError('Username already exists');
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('An error occurred');
      }
    }
  };

  const startEdit = (u: AdminUserDTO) => {
    setEditId(u.id);
    setUsername(u.username);
    setDisplayName(u.displayName);
    setRole(u.role as UserRole);
    setPassword('');
    setError('');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditId(null);
    setUsername('');
    setPassword('');
    setDisplayName('');
    setRole(UserRole.INSTRUCTOR);
    setError('');
    setShowForm(false);
  };

  const handleDeactivate = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      }
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await api.post(`/users/${id}/reactivate`);
      fetchUsers();
    } catch (err: any) {
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      }
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">({users.filter((u) => u.isActive).length} active)</span>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary"
        >
          <Plus className="mr-1 h-4 w-4" /> Add User
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{editId ? 'Edit' : 'Add'} User</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Username</label>
              <input
                className="input"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!!editId}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">
                {editId ? 'New Password (leave blank to keep)' : 'Password'}
              </label>
              <input
                className="input"
                type="password"
                placeholder={editId ? 'Leave blank to keep' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Display Name</label>
              <input
                className="input"
                placeholder="Display Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400">Role</label>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value={UserRole.ADMIN}>Admin</option>
                <option value={UserRole.INSTRUCTOR}>Instructor</option>
                <option value={UserRole.MEDICAL}>Medical</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="btn-primary">
              {editId ? 'Update' : 'Create'}
            </button>
            <button onClick={resetForm} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3">Display Name</th>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {users.map((u) => (
              <tr
                key={u.id}
                className={cn(
                  'transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50',
                  !u.isActive && 'opacity-50'
                )}
              >
                <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {u.displayName}
                  {u.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">(you)</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-gray-600 dark:text-gray-400 text-xs">
                  {u.username}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      ROLE_STYLES[u.role] || 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    )}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {u.isActive ? (
                    <span className="inline-flex rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-gray-200 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                  {formatDate(u.createdAt)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    {u.isActive && (
                      <button
                        onClick={() => startEdit(u)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {u.isActive && u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        title="Deactivate"
                      >
                        <UserX className="h-4 w-4" />
                      </button>
                    )}
                    {!u.isActive && (
                      <button
                        onClick={() => handleReactivate(u.id)}
                        className="rounded p-1 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-900/30 dark:hover:text-green-400"
                        title="Reactivate"
                      >
                        <UserCheck className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
