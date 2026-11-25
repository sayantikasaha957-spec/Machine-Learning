import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus, Clock, BrainCircuit, Activity } from 'lucide-react';
import { useAppStore, TimeRange } from '../../store/useAppStore';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  onQuickAction?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileSidebar,
  onQuickAction,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { timeRange, setTimeRange, showForecast, toggleShowForecast } = useAppStore();

  const getPageMeta = (pathname: string) => {
    if (pathname.startsWith('/dashboard')) {
      return {
        title: 'Physiological Telemetry & Forecasts',
        category: 'ICU Ward Telemetry',
        actionLabel: '+ Admit Patient',
        action: onQuickAction || (() => navigate('/patients?action=new')),
      };
    }
    if (pathname.startsWith('/patients/')) {
      return {
        title: 'Patient Telemetry Chart',
        category: 'Clinical Details',
        actionLabel: 'Export Patient PDF',
        action: onQuickAction || (() => {}),
      };
    }
    if (pathname.startsWith('/patients')) {
      return {
        title: 'Active Inpatients & Roster',
        category: 'Roster Management',
        actionLabel: '+ Admit Patient',
        action: onQuickAction || (() => navigate('/patients?action=new')),
      };
    }
    if (pathname.startsWith('/alerts')) {
      return {
        title: 'Clinical Breaches & Predictions',
        category: 'Alert Center',
        actionLabel: 'Acknowledge All',
        action: onQuickAction || (() => {}),
      };
    }
    if (pathname.startsWith('/analytics')) {
      return {
        title: 'Ward Aggregates & Trends',
        category: 'Clinical Analytics',
        actionLabel: 'Export Ward CSV',
        action: onQuickAction || (() => {}),
      };
    }
    if (pathname.startsWith('/model')) {
      return {
        title: 'LSTM Architecture & Benchmarks',
        category: 'Deep Learning Model',
        actionLabel: 'Model Documentation',
        action: () => window.open('https://vitaldb.net', '_blank'),
      };
    }
    if (pathname.startsWith('/reports')) {
      return {
        title: 'Clinical Report Generation',
        category: 'Documentation',
        actionLabel: 'Generate PDF',
        action: onQuickAction || (() => {}),
      };
    }
    if (pathname.startsWith('/settings')) {
      return {
        title: 'System & Ward Preferences',
        category: 'Preferences',
        actionLabel: 'Save Preferences',
        action: onQuickAction || (() => {}),
      };
    }
    if (pathname.startsWith('/admin')) {
      return {
        title: 'System Administration',
        category: 'Admin Control',
        actionLabel: 'Retrain Model',
        action: onQuickAction || (() => {}),
      };
    }
    return {
      title: 'VitalSync Health Suite',
      category: 'Overview',
      actionLabel: 'Dashboard',
      action: () => navigate('/dashboard'),
    };
  };

  const meta = getPageMeta(location.pathname);

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-4 md:px-6 flex items-center justify-between transition-colors sticky top-0 z-20">
      {/* Left: Mobile hamburger & Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-1.5 sm:p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
          aria-label="Open sidebar navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0 max-w-[130px] sm:max-w-none">
          <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400 block truncate">
            {meta.category}
          </span>
          <h1 className="text-xs sm:text-base md:text-lg font-bold text-slate-800 dark:text-slate-100 leading-tight truncate">
            {meta.title}
          </h1>
        </div>
      </div>

      {/* Right Controls: Time Range, Forecast Toggle, Primary Action */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Forecast Toggle Pill */}
        {(location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/patients/')) && (
          <button
            onClick={toggleShowForecast}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              showForecast
                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 opacity-60'
            }`}
            title="Toggle LSTM forward predictions overlay"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>AI Forecast (90% CI)</span>
            <span
              className={`w-2 h-2 rounded-full ${
                showForecast ? 'bg-purple-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            />
          </button>
        )}

        {/* Time-Range Selector */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700/60">
          <Clock className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 hidden sm:inline" />
          {(['1h', '6h', '24h', '48h'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                timeRange === range
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>

        {/* Action Button */}
        {meta.actionLabel && (
          <button
            onClick={meta.action}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-medium text-xs shadow-sm shadow-teal-500/20 transition-all flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{meta.actionLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
};
