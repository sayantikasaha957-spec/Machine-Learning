import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Activity, Lock, Mail, ArrowRight, UserCheck, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email address and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      addToast({
        title: 'Authentication Successful',
        message: 'Welcome back to VitalSync Telemetry Suite.',
        type: 'success',
      });
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-page dark:bg-page-dark flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <span className="font-extrabold text-2xl tracking-tight text-slate-900 dark:text-white">
            VitalSync
          </span>
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          Provider Sign In
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Access secure patient physiological telemetry and AI forecasts
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white dark:bg-slate-800 py-8 px-6 sm:px-8 shadow-soft-lg rounded-2xl border border-slate-100 dark:border-slate-700">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Medical Staff Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@vitalsync.com"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-60 text-white font-semibold text-sm shadow-sm shadow-teal-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Autofill */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center mb-3">
              Fast Demo Accounts (Click to Fill)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('doctor@vitalsync.com', 'Doctor123!')}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 bg-slate-50 dark:bg-slate-800/80 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Doctor</div>
                <div className="text-[9px] text-teal-600 dark:text-teal-400 truncate">doctor@...</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('nurse@vitalsync.com', 'Nurse123!')}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 bg-slate-50 dark:bg-slate-800/80 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Nurse</div>
                <div className="text-[9px] text-teal-600 dark:text-teal-400 truncate">nurse@...</div>
              </button>

              <button
                type="button"
                onClick={() => handleDemoFill('admin@vitalsync.com', 'Admin123!')}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-400 dark:hover:border-teal-500 bg-slate-50 dark:bg-slate-800/80 text-left transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">Admin</div>
                <div className="text-[9px] text-teal-600 dark:text-teal-400 truncate">admin@...</div>
              </button>
            </div>
          </div>

          <div className="mt-5 text-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              New medical staff?{' '}
            </span>
            <Link
              to="/register"
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
              Register Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
