import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import type { AuditLogDTO } from '@heartbeat/shared';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const ENTITY_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'user', label: 'User' },
  { value: 'participant', label: 'Participant' },
  { value: 'class', label: 'Class' },
  { value: 'session', label: 'Session' },
  { value: 'device', label: 'Device' },
  { value: 'settings', label: 'Settings' },
  { value: 'alert', label: 'Alert' },
];

export function AuditLogPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<AuditLogDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  // Admin-only page guard
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (entityTypeFilter) params.set('entityType', entityTypeFilter);

    const res = await api.get(`/audit-log?${params.toString()}`);
    setEntries(res.data.data);
    setTotal(res.data.total);
  }, [page, pageSize, entityTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatAction = (action: string) => {
    return action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const truncateDetails = (details: Record<string, unknown> | null): string => {
    if (!details) return '—';
    const str = JSON.stringify(details);
    return str.length > 60 ? str.substring(0, 57) + '...' : str;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-gray-700 dark:text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        <span className="text-sm text-gray-500 dark:text-gray-400">({total} entries)</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div>
          <label className="mr-2 text-xs font-medium text-gray-500 dark:text-gray-400">Entity Type</label>
          <select
            className="input"
            value={entityTypeFilter}
            onChange={(e) => {
              setEntityTypeFilter(e.target.value);
              setPage(1);
            }}
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity Type</th>
              <th className="px-4 py-3">Entity ID</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                  No audit log entries found
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(entry.occurredAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">
                    {entry.userName || <span className="text-gray-400 dark:text-gray-500">System</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    {formatAction(entry.action)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {entry.entityType ? (
                      <span className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-medium capitalize text-gray-600 dark:text-gray-400">
                        {entry.entityType}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-400 dark:text-gray-500">
                    {entry.entityId ? entry.entityId.substring(0, 8) + '...' : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400" title={entry.details ? JSON.stringify(entry.details) : undefined}>
                    {truncateDetails(entry.details)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages} ({total} total entries)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
