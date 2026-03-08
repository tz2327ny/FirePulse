import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { FreshnessState } from '@heartbeat/shared';
import { useFreshness } from '../hooks/useFreshness.js';
import { HeartRateCell } from '../components/dashboard/HeartRateCell.js';
import { FreshnessBadge } from '../components/dashboard/FreshnessBadge.js';
import { SignalBarsIndicator } from '../components/dashboard/SignalBarsIndicator.js';
import { formatLocalDateTime, formatDuration, timeAgo } from '../utils/formatTime.js';
import {
  ArrowLeft, Heart, Activity, AlertTriangle, Clock, Watch, Users,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

interface ParticipantInfo {
  id: string;
  firstName: string;
  lastName: string;
  company: string;
  isArchived: boolean;
  createdAt: string;
}

interface DeviceAssignmentHistory {
  id: string;
  assignedAt: string;
  unassignedAt: string | null;
  device: { macAddress: string; shortId: string; deviceName: string | null };
  session?: { name: string } | null;
}

interface SessionHistory {
  id: string;
  sessionId: string;
  status: string;
  session: { name: string; state: string; startedAt: string | null; endedAt: string | null };
}

interface AlertHistory {
  id: string;
  alertSource: string;
  alertLevel: string;
  status: string;
  openedAt: string;
  acknowledgedAt: string | null;
  clearedAt: string | null;
  metadataJson: Record<string, unknown> | null;
}

interface RollupPoint {
  capturedAt: string;
  heartRate: number | null;
  signalScore: number | null;
  freshnessState: string | null;
}

interface LiveTelemetry {
  heartRate: number | null;
  smoothedRssi: number | null;
  signalBars: number;
  lastSeenAt: string;
  bestReceiverName: string | null;
  shortId: string;
  deviceMac: string;
}

export function ParticipantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [assignments, setAssignments] = useState<DeviceAssignmentHistory[]>([]);
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([]);
  const [alerts, setAlerts] = useState<AlertHistory[]>([]);
  const [rollups, setRollups] = useState<RollupPoint[]>([]);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const freshness = useFreshness(liveTelemetry?.lastSeenAt);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      // Fetch participant info
      const pRes = await api.get(`/participants/${id}`);
      setParticipant(pRes.data.data);

      // Fetch device assignment history
      const dRes = await api.get(`/devices`);
      const allDevices = dRes.data.data;

      // Fetch session participation history
      const sRes = await api.get('/sessions');
      const allSessions = sRes.data.data;

      // Fetch alerts for this participant
      const aRes = await api.get(`/alerts?participantId=${id}`);
      setAlerts(aRes.data.data.filter((a: any) => a.participantId === id));

      // Fetch telemetry rollups
      const rRes = await api.get(`/telemetry/participant/${id}`);
      setRollups(rRes.data.data);

      // Fetch current live telemetry - find this participant's current device
      const ctRes = await api.get('/telemetry/current');
      const allTelemetry = ctRes.data.data;
      const myTelemetry = allTelemetry.find((t: any) => t.participantId === id);
      setLiveTelemetry(myTelemetry || null);

      // Fetch detailed participant data (sessions, assignments)
      await fetchParticipantHistory(id);
    } catch (err) {
      console.error('Failed to load participant detail', err);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  const fetchParticipantHistory = async (participantId: string) => {
    try {
      // Get session participations
      const sessionsRes = await api.get('/sessions');
      const allSessions = sessionsRes.data.data;

      // For each session, check if participant is in it
      const history: SessionHistory[] = [];
      for (const session of allSessions.slice(0, 20)) { // limit to 20 recent
        try {
          const detailRes = await api.get(`/sessions/${session.id}`);
          const detail = detailRes.data.data;
          const sp = detail.sessionParticipants?.find((sp: any) => sp.participantId === participantId);
          if (sp) {
            history.push({
              id: sp.id,
              sessionId: session.id,
              status: sp.status,
              session: {
                name: session.name,
                state: session.state,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
              },
            });
          }
        } catch { /* skip */ }
      }
      setSessionHistory(history);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh live telemetry every 3 seconds
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(async () => {
      try {
        const ctRes = await api.get('/telemetry/current');
        const myTelemetry = ctRes.data.data.find((t: any) => t.participantId === id);
        setLiveTelemetry(myTelemetry || null);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [id]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500">Loading...</div>;
  }

  if (!participant) {
    return <div className="py-16 text-center text-gray-400 dark:text-gray-500">Participant not found</div>;
  }

  // Chart data
  const chartData = rollups.map((r) => ({
    time: new Date(r.capturedAt).toLocaleTimeString(),
    hr: r.heartRate,
    signal: r.signalScore,
  }));

  // HR stats from rollups
  const hrValues = rollups.map((r) => r.heartRate).filter((v): v is number => v !== null);
  const hrMin = hrValues.length > 0 ? Math.min(...hrValues) : null;
  const hrMax = hrValues.length > 0 ? Math.max(...hrValues) : null;
  const hrAvg = hrValues.length > 0 ? Math.round(hrValues.reduce((a, b) => a + b, 0) / hrValues.length) : null;

  const stateColors: Record<string, string> = {
    standby: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    paused: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    ended: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  const statusColors: Record<string, string> = {
    present: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    late: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    left_early: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    removed: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  };

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link to="/participants" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {participant.firstName} {participant.lastName}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{participant.company}</p>
        </div>
      </div>

      {/* Live status card */}
      {liveTelemetry ? (
        <div className="card">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Activity className="h-4 w-4" />
            Live Status
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Heart Rate</p>
              <div className="mt-1 text-3xl font-bold">
                <HeartRateCell heartRate={liveTelemetry.heartRate} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Freshness</p>
              <div className="mt-2">
                <FreshnessBadge state={freshness} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Signal</p>
              <div className="mt-2">
                <SignalBarsIndicator bars={liveTelemetry.signalBars} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Device / Receiver</p>
              <p className="mt-1 font-mono text-sm dark:text-gray-300">{liveTelemetry.shortId}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{liveTelemetry.bestReceiverName || '—'}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-400 dark:text-gray-500">
          No live telemetry — device not assigned or offline
        </div>
      )}

      {/* HR Stats */}
      {hrValues.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Min HR</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{hrMin}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <Minus className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg HR</p>
              <p className="text-xl font-bold text-gray-700 dark:text-gray-300">{hrAvg}</p>
            </div>
          </div>
          <div className="card flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Max HR</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">{hrMax}</p>
            </div>
          </div>
        </div>
      )}

      {/* HR Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Heart className="h-4 w-4 text-red-500" />
            Session Heart Rate
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" strokeOpacity={0.3} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} interval="preserveStartEnd" />
              <YAxis domain={[40, 220]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid var(--tooltip-border, #e5e7eb)' }}
                labelStyle={{ fontWeight: 600 }}
              />
              <ReferenceLine y={160} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Warning', fontSize: 10, fill: '#f59e0b' }} />
              <ReferenceLine y={180} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Alarm', fontSize: 10, fill: '#ef4444' }} />
              <Line
                type="monotone"
                dataKey="hr"
                name="Heart Rate"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length === 0 && (
        <div className="card bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-400 dark:text-gray-500">
          No session HR data yet. Data appears when a session is active and telemetry is flowing.
        </div>
      )}

      {/* Alert History */}
      <div className="card">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          Alert History ({alerts.length})
        </h3>
        {alerts.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {alerts.slice(0, 20).map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{formatLocalDateTime(a.openedAt)}</td>
                    <td className="px-3 py-2 dark:text-gray-300">{a.alertSource}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        a.alertLevel === 'alarm'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400'
                      }`}>{a.alertLevel}</span>
                    </td>
                    <td className="px-3 py-2 capitalize text-gray-500 dark:text-gray-400">{a.status}</td>
                    <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">
                      {a.metadataJson && (a.metadataJson as any).heartRate && `HR: ${(a.metadataJson as any).heartRate}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No alerts recorded for this participant.</p>
        )}
      </div>

      {/* Session History */}
      <div className="card">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Clock className="h-4 w-4 text-blue-500" />
          Session History ({sessionHistory.length})
        </h3>
        {sessionHistory.length > 0 ? (
          <div className="space-y-2">
            {sessionHistory.map((sh) => (
              <div key={sh.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
                <div>
                  <span className="font-medium dark:text-gray-200">{sh.session.name}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${stateColors[sh.session.state] || 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {sh.session.state}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`rounded-full px-2 py-0.5 font-medium capitalize ${statusColors[sh.status] || 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
                    {sh.status.replace('_', ' ')}
                  </span>
                  {sh.session.startedAt && <span>{formatLocalDateTime(sh.session.startedAt)}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">No session participation history.</p>
        )}
      </div>
    </div>
  );
}
