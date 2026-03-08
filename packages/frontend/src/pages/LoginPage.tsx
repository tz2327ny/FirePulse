import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { AlertTriangle } from 'lucide-react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!accepted) {
      setError('You must accept the terms below to continue.');
      return;
    }
    try {
      await login(username, password);
      navigate('/');
    } catch {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 dark:bg-gray-900 px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/logo.png" alt="FirePulse" className="mx-auto h-20 w-20 object-contain" />
          <h1 className="mt-3 text-2xl font-bold text-gray-900 dark:text-gray-100">FirePulse</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Firefighter HR Monitoring</p>
        </div>

        {/* Demo / Disclaimer Banner */}
        <div className="mb-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm font-semibold">Demo / Evaluation Only</span>
          </div>
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
            This software is provided for <strong>demonstration and evaluation purposes only</strong>.
            FirePulse is <strong>not a medical device</strong> and must not be used as the sole basis
            for any medical or safety decision. All data displayed is for informational purposes only.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
            Use of this system is governed by the FirePulse{' '}
            <strong>Terms of Service</strong>,{' '}
            <strong>Privacy Policy</strong>, and{' '}
            <strong>Disclaimer</strong>.
            Unauthorized use is strictly prohibited and may result in legal action.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 p-3 text-sm text-red-700 dark:text-red-400">{error}</div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input mt-1"
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input mt-1"
              required
            />
          </div>

          {/* TOS Acknowledgment Checkbox */}
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-red-600 focus:ring-red-500 accent-red-600"
            />
            <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              I acknowledge this is a <strong>demo system</strong>, not a medical device. I agree to
              the <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and{' '}
              <strong>Disclaimer</strong>.
            </span>
          </label>

          <button
            type="submit"
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading || !accepted}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          Default: admin / admin123
        </p>
      </div>
    </div>
  );
}
