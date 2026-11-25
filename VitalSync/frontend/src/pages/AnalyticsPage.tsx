import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Heart,
  Droplets,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader } from '../components/common/Card';
import { CardSkeleton } from '../components/common/LoadingSkeleton';

export const AnalyticsPage: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-summary-page'],
    queryFn: () => api.getAnalyticsSummary(),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return <CardSkeleton rows={8} />;
  }

  const hrStats = data?.averages_24h?.heart_rate;
  const sbpStats = data?.averages_24h?.systolic_bp;
  const dbpStats = data?.averages_24h?.diastolic_bp;
  const alertsOverTime = data?.alerts_over_time || [];

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Inpatients Monitored</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            {data?.total_patients ?? 20}
          </div>
          <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-1">
            {data?.active_monitoring_patients ?? 20} continuous streaming
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">24h Alert Breaches</span>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {data?.total_alerts_24h ?? 0}
          </div>
          <p className="text-[11px] text-rose-500 font-medium mt-1">
            {data?.critical_alerts_unresolved ?? 0} critical unresolved
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ward Mean Heart Rate</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            {hrStats ? Math.round(hrStats.mean) : 75} <span className="text-xs font-normal text-slate-400">BPM</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Range: {hrStats?.min ?? 55} - {hrStats?.max ?? 125} bpm
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Ward Mean Blood Pressure</span>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-1">
            {sbpStats ? Math.round(sbpStats.mean) : 120}/{dbpStats ? Math.round(dbpStats.mean) : 80}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            SBP Range: {sbpStats?.min ?? 90} - {sbpStats?.max ?? 170} mmHg
          </p>
        </div>
      </div>

      {/* 24-Hour Vitals Distribution Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heart Rate Distribution */}
        <Card>
          <CardHeader
            title="Heart Rate Distribution"
            subtitle="24h ward cohort metrics"
            action={<Heart className="w-5 h-5 text-rose-500" />}
          />
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Minimum</span>
                <span className="text-slate-900 dark:text-white font-mono">{hrStats?.min ?? 50} BPM</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, ((hrStats?.min ?? 50) / 180) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Mean (Average)</span>
                <span className="text-teal-600 dark:text-teal-400 font-mono font-bold">{hrStats ? Math.round(hrStats.mean) : 75} BPM</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, ((hrStats?.mean ?? 75) / 180) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Maximum Peak</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono">{hrStats?.max ?? 130} BPM</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, ((hrStats?.max ?? 130) / 180) * 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Systolic BP Distribution */}
        <Card>
          <CardHeader
            title="Systolic BP Distribution"
            subtitle="24h ward cohort metrics"
            action={<Droplets className="w-5 h-5 text-blue-500" />}
          />
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Minimum</span>
                <span className="text-slate-900 dark:text-white font-mono">{sbpStats?.min ?? 85} mmHg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, ((sbpStats?.min ?? 85) / 220) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Mean (Average)</span>
                <span className="text-blue-600 dark:text-blue-400 font-mono font-bold">{sbpStats ? Math.round(sbpStats.mean) : 120} mmHg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, ((sbpStats?.mean ?? 120) / 220) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Maximum Peak</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono">{sbpStats?.max ?? 165} mmHg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, ((sbpStats?.max ?? 165) / 220) * 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>

        {/* Diastolic BP Distribution */}
        <Card>
          <CardHeader
            title="Diastolic BP Distribution"
            subtitle="24h ward cohort metrics"
            action={<Droplets className="w-5 h-5 text-indigo-500" />}
          />
          <div className="space-y-4 mt-2">
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Minimum</span>
                <span className="text-slate-900 dark:text-white font-mono">{dbpStats?.min ?? 50} mmHg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, ((dbpStats?.min ?? 50) / 140) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Mean (Average)</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{dbpStats ? Math.round(dbpStats.mean) : 80} mmHg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, ((dbpStats?.mean ?? 80) / 140) * 100)}%` }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                <span>Maximum Peak</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono">{dbpStats?.max ?? 105} mmHg</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-rose-500" style={{ width: `${Math.min(100, ((dbpStats?.max ?? 105) / 140) * 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* 7-Day Alert Frequency Bar Chart */}
      <Card>
        <CardHeader
          title="Clinical Alerts Over Time (Last 7 Days)"
          subtitle="Daily comparison of total threshold breaches vs critical alarms"
        />

        <div className="h-72 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={alertsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px',
                  border: 'none',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="count" fill="#4A7BD0" radius={[6, 6, 0, 0]} name="Total Breaches" />
              <Bar dataKey="critical" fill="#E5484D" radius={[6, 6, 0, 0]} name="Critical Alarms" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
