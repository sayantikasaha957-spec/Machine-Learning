import React, { useState } from 'react';
import {
  Settings,
  User,
  Bell,
  Sliders,
  Moon,
  Sun,
  Shield,
  Save,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { useToastStore } from '../store/useToastStore';
import { Card, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export const SettingsPage: React.FC = () => {
  const { user, role } = useAuthStore();
  const { darkMode, toggleDarkMode, setDarkMode } = useAppStore();
  const addToast = useToastStore((s) => s.addToast);

  // Ward threshold states
  const [hrHigh, setHrHigh] = useState(120);
  const [hrLow, setHrLow] = useState(50);
  const [sbpHigh, setSbpHigh] = useState(140);
  const [sbpLow, setSbpLow] = useState(90);
  const [dbpHigh, setDbpHigh] = useState(90);

  // Unit settings
  const [tempUnit, setTempUnit] = useState<'c' | 'f'>('c');
  const [pressUnit, setPressUnit] = useState<'mmHg' | 'kPa'>('mmHg');

  // Notification toggles
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [toastAlerts, setToastAlerts] = useState(true);
  const [predictiveNotice, setPredictiveNotice] = useState(true);

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    addToast({
      title: 'Preferences Saved',
      message: 'Ward telemetry thresholds and display settings updated.',
      type: 'success',
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* User Profile Card */}
      <Card>
        <CardHeader
          title="Medical Staff Profile"
          subtitle="Provider credential details and ward permissions"
        />
        <div className="flex flex-wrap items-center gap-4 mt-2">
          <div className="w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xl uppercase border border-teal-200 dark:border-teal-800">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {user?.full_name || 'Staff User'}
              </h3>
              <Badge variant="stable" size="sm">
                {role?.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Email: {user?.email} • ID: #{user?.id}
            </p>
          </div>
        </div>
      </Card>

      <form onSubmit={handleSavePreferences} className="space-y-6">
        {/* Ward Alert Thresholds */}
        <Card>
          <CardHeader
            title="Clinical Alert Thresholds"
            subtitle="Trigger parameters for tachycardia, hypotension, and hypertensive urgency"
            action={<Sliders className="w-5 h-5 text-teal-500" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Heart Rate High Alert Limit (BPM)
              </label>
              <input
                type="number"
                value={hrHigh}
                onChange={(e) => setHrHigh(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400">Default: &gt; 120 bpm (Tachycardia)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Heart Rate Low Alert Limit (BPM)
              </label>
              <input
                type="number"
                value={hrLow}
                onChange={(e) => setHrLow(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400">Default: &lt; 50 bpm (Bradycardia)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Systolic BP High Limit (mmHg)
              </label>
              <input
                type="number"
                value={sbpHigh}
                onChange={(e) => setSbpHigh(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400">Default: &gt; 140 mmHg (Hypertension)</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Systolic BP Low Limit (mmHg)
              </label>
              <input
                type="number"
                value={sbpLow}
                onChange={(e) => setSbpLow(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400">Default: &lt; 90 mmHg (Hypotension)</span>
            </div>
          </div>
        </Card>

        {/* Display & Dark Theme */}
        <Card>
          <CardHeader
            title="Display Theme & Units"
            subtitle="Customize interface lighting and physiological units"
          />

          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700/60">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Color Mode
                </span>
                <span className="text-[11px] text-slate-400">
                  Switch between light and dark clinical ward mode
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDarkMode(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    !darkMode
                      ? 'bg-teal-50 border-teal-500 text-teal-700'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDarkMode(true)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                    darkMode
                      ? 'bg-slate-800 border-teal-500 text-teal-400'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">
                  Blood Pressure Units
                </span>
                <span className="text-[11px] text-slate-400">Unit of arterial pressure</span>
              </div>
              <select
                value={pressUnit}
                onChange={(e) => setPressUnit(e.target.value as any)}
                className="px-3 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              >
                <option value="mmHg">Millimeters of Mercury (mmHg)</option>
                <option value="kPa">Kilopascals (kPa)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Notifications & Audio Alert Toggles */}
        <Card>
          <CardHeader
            title="Notifications & Dispatches"
            subtitle="Configure real-time auditory and visual alarms"
          />

          <div className="space-y-3 mt-2 text-xs">
            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Real-Time Toast Alerts
                </span>
                <span className="text-[11px] text-slate-400">Show floating toast notifications for instant threshold breaches</span>
              </div>
              <input
                type="checkbox"
                checked={toastAlerts}
                onChange={(e) => setToastAlerts(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  AI Forward Prediction Alerts
                </span>
                <span className="text-[11px] text-slate-400">Dispatch anticipatory alerts when LSTM forecast projects instability</span>
              </div>
              <input
                type="checkbox"
                checked={predictiveNotice}
                onChange={(e) => setPredictiveNotice(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </label>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs shadow-sm flex items-center gap-2 cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save All Preferences</span>
          </button>
        </div>
      </form>
    </div>
  );
};
