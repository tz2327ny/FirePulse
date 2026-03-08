import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useSocket } from '../../context/SocketContext.js';
import { useTheme } from '../../hooks/useTheme.js';
import { cn } from '../../utils/cn.js';
import {
  LayoutDashboard,
  Users,
  Radio,
  Watch,
  BookOpen,
  PlayCircle,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  Heart,
  ShieldCheck,
  FileText,
  Moon,
  Sun,
} from 'lucide-react';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    // Rehab: admin + medical only (instructors can send to rehab from dashboard but can't manage)
    ...(user?.role === 'admin' || user?.role === 'medical'
      ? [{ to: '/rehab', icon: Heart, label: 'Rehab' }]
      : []),
    { to: '/sessions', icon: PlayCircle, label: 'Sessions' },
    { to: '/classes', icon: BookOpen, label: 'Classes' },
    { to: '/participants', icon: Users, label: 'Participants' },
    { to: '/devices', icon: Watch, label: 'Devices' },
    { to: '/receivers', icon: Radio, label: 'Receivers' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    ...(user?.role === 'admin'
      ? [
          { to: '/users', icon: ShieldCheck, label: 'Users' },
          { to: '/audit-log', icon: FileText, label: 'Audit Log' },
        ]
      : []),
  ];
  const { isConnected } = useSocket();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Logo */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <img src="/logo.png" alt="FirePulse" className="h-8 w-8 object-contain" />
        <span className="text-lg font-bold text-gray-900 dark:text-gray-100">FirePulse</span>
      </div>

      {/* Connection status */}
      <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-4 py-2 text-xs">
        {isConnected ? (
          <>
            <Wifi className="h-3 w-3 text-green-500" />
            <span className="text-green-700 dark:text-green-400">Live Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="h-3 w-3 text-red-500" />
            <span className="text-red-700 dark:text-red-400">Disconnected</span>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user?.displayName}</p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.role}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
