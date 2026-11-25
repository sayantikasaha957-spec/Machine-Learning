import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Heart,
  Droplets,
  AlertTriangle,
  Users,
  BrainCircuit,
  Radio,
  Clock,
  ArrowUpRight,
  CheckCircle,
  Eye,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { useWebSocketVitals } from '../services/useWebSocketVitals';
import { Card, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { useToastStore } from '../store/useToastStore';
import { Patient, Alert } from '../types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { activePatientId, setActivePatientId, timeRange, showForecast } = useAppStore();

  // 1. Fetch Patients roster
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-list-summary'],
    queryFn: () => api.getPatients({ page: 1, pageSize: 6 }),
  });

  const activePatient = patientsData?.patients?.find((p) => p.id === activePatientId) || patientsData?.patients?.[0];

  // If active patient not set, sync with first patient
  useEffect(() => {
    if (patientsData?.patients?.length && !patientsData.patients.some((p) => p.id === activePatientId)) {
      setActivePatientId(patientsData.patients[0].id);
    }
  }, [patientsData, activePatientId, setActivePatientId]);

  // 2. Fetch Historical Vitals for active patient
  const vitalsLimit = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : 500;
  const { data: vitalsData, isLoading: vitalsLoading } = useQuery({
    queryKey: ['patient-vitals', activePatientId, timeRange],
    queryFn: () => api.getVitals(activePatientId, { limit: vitalsLimit }),
    enabled: !!activePatientId,
    refetchInterval: 15000,
  });

  // 3. Fetch LSTM Forecast for active patient
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['patient-forecast', activePatientId],
    queryFn: () => api.getForecast(activePatientId, 12),
    enabled: !!activePatientId,
    refetchInterval: 30000,
  });

  // 4. Fetch Active Unresolved Alerts
  const { data: alertsData } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: () => api.getAlerts({ resolved: false, limit: 5 }),
    refetchInterval: 8000,
  });

  // 5. Fetch Analytics Ward Overview
  const { data: analyticsData } = useQuery({
    queryKey: ['analytics-summary-dashboard'],
    queryFn: () => api.getAnalyticsSummary(),
    refetchInterval: 20000,
  });

  // 6. Connect Real-time WebSocket Telemetry for active patient
  const [liveVitals, setLiveVitals] = useState<{
    hr: number;
    sbp: number;
    dbp: number;
    timestamp: string;
  } | null>(null);

  const { isConnected: isLiveConnected } = useWebSocketVitals({
    patientId: activePatientId,
    onUpdate: (data) => {
      setLiveVitals({
        hr: data.heart_rate,
        sbp: data.systolic_bp,
        dbp: data.diastolic_bp,
        timestamp: data.timestamp,
      });
      // Invalidate alerts query if alert was triggered
      if (data.alerts_triggered?.length) {
        queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      }
    },
  });

  // Latest vital values (prefer WebSocket, fallback to latest historical)
  const latestHistorical = vitalsData?.data?.[vitalsData.data.length - 1];
  const currentHR = liveVitals?.hr ?? latestHistorical?.hr ?? 72;
  const currentSBP = liveVitals?.sbp ?? latestHistorical?.sbp ?? 120;
  const currentDBP = liveVitals?.dbp ?? latestHistorical?.dbp ?? 80;

  // Acknowledge Alert Mutation
  const ackMutation = useMutation({
    mutationFn: (alertId: number) => api.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      addToast({
        title: 'Alert Acknowledged',
        message: 'Clinical team notified of acknowledgment.',
        type: 'info',
      });
    },
  });

  // Merge historical readings + forecast predictions into continuous chart data
  const chartData = React.useMemo(() => {
    const points: any[] = [];
    const historical = vitalsData?.data || [];

    // Add historical readings (subsample for smoothness if many)
    const stride = historical.length > 120 ? Math.ceil(historical.length / 100) : 1;
    for (let i = 0; i < historical.length; i += stride) {
      const v = historical[i];
      const timeLabel = new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      points.push({
        time: timeLabel,
        rawTimestamp: v.timestamp,
        hr: v.hr,
        sbp: v.sbp,
        dbp: v.dbp,
        isForecast: false,
      });
    }

    // Append forecast readings if enabled
    if (showForecast && forecastData?.forecast_timestamps) {
      const lastPoint = points[points.length - 1];
      // Bridge the last actual point with the forecast start
      if (lastPoint) {
        lastPoint.hr_forecast = lastPoint.hr;
        lastPoint.hr_lower = lastPoint.hr;
        lastPoint.hr_upper = lastPoint.hr;
        lastPoint.sbp_forecast = lastPoint.sbp;
        lastPoint.sbp_lower = lastPoint.sbp;
        lastPoint.sbp_upper = lastPoint.sbp;
        lastPoint.dbp_forecast = lastPoint.dbp;
        lastPoint.dbp_lower = lastPoint.dbp;
        lastPoint.dbp_upper = lastPoint.dbp;
      }

      forecastData.forecast_timestamps.forEach((ts, idx) => {
        const timeLabel = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const hrMean = forecastData.mean.heart_rate[idx];
        const hrLower = forecastData.lower_90.heart_rate[idx];
        const hrUpper = forecastData.upper_90.heart_rate[idx];

        const sbpMean = forecastData.mean.systolic_bp[idx];
        const sbpLower = forecastData.lower_90.systolic_bp[idx];
        const sbpUpper = forecastData.upper_90.systolic_bp[idx];

        const dbpMean = forecastData.mean.diastolic_bp[idx];
        const dbpLower = forecastData.lower_90.diastolic_bp[idx];
        const dbpUpper = forecastData.upper_90.diastolic_bp[idx];

        points.push({
          time: timeLabel,
          rawTimestamp: ts,
          isForecast: true,
          hr_forecast: hrMean,
          hr_lower: hrLower,
          hr_upper: hrUpper,
          hr_band: [hrLower, hrUpper],
          sbp_forecast: sbpMean,
          sbp_lower: sbpLower,
          sbp_upper: sbpUpper,
          sbp_band: [sbpLower, sbpUpper],
          dbp_forecast: dbpMean,
          dbp_lower: dbpLower,
          dbp_upper: dbpUpper,
          dbp_band: [dbpLower, dbpUpper],
        });
      });
    }

    return points;
  }, [vitalsData, forecastData, showForecast]);

  return (
    <div className="space-y-6">
      {/* Active Patient Selector & Live Status Header Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 md:p-5 border border-slate-100 dark:border-slate-700/60 shadow-soft flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-lg flex-shrink-0 border border-teal-100 dark:border-teal-800">
            {activePatient?.name?.charAt(0) || 'P'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-white">
                {activePatient?.name || 'Loading Patient...'}
              </h2>
              {activePatient && (
                <Badge variant={activePatient.status === 'stable' ? 'stable' : activePatient.status === 'warning' ? 'attention' : 'critical'} dot>
                  {activePatient.status.toUpperCase()}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              UID: <span className="font-mono text-slate-700 dark:text-slate-300">{activePatient?.patient_uid}</span> • Room: {activePatient?.room || 'ICU-Bed'} • Age: {activePatient?.age} y/o ({activePatient?.gender})
            </p>
          </div>
        </div>

        {/* Live Indicator Pill & Patient Switching Pills */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLiveConnected ? 'bg-teal-400' : 'bg-amber-400'} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isLiveConnected ? 'bg-teal-500' : 'bg-amber-500'}`} />
            </span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {isLiveConnected ? 'Telemetry Live' : 'Connecting WS'}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              (2.5s tick)
            </span>
          </div>

          <button
            onClick={() => navigate(`/patients/${activePatientId}`)}
            className="px-3.5 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/40 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>Patient Chart</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ward Summary Metric Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tile 1: Current Heart Rate */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Heart Rate (Current)
            </span>
            <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {Math.round(currentHR)}
            </span>
            <span className="text-xs font-semibold text-slate-400 uppercase">BPM</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              Target: 60 - 100 bpm
            </span>
            <Badge size="sm" variant={currentHR > 100 ? 'attention' : currentHR < 50 ? 'critical' : 'stable'}>
              {currentHR > 100 ? 'Elevated' : currentHR < 50 ? 'Low' : 'Normal'}
            </Badge>
          </div>
        </Card>

        {/* Tile 2: Blood Pressure */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Blood Pressure
            </span>
            <Droplets className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {Math.round(currentSBP)}/{Math.round(currentDBP)}
            </span>
            <span className="text-xs font-semibold text-slate-400 uppercase">mmHg</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400">
              MAP: {Math.round(currentDBP + (currentSBP - currentDBP) / 3)} mmHg
            </span>
            <Badge size="sm" variant={currentSBP > 140 ? 'attention' : 'stable'}>
              {currentSBP > 140 ? 'Hypertensive' : 'Normotensive'}
            </Badge>
          </div>
        </Card>

        {/* Tile 3: Active Monitoring Patients */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Active Ward Inpatients
            </span>
            <Users className="w-4 h-4 text-teal-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {analyticsData?.active_monitoring_patients ?? 20}
            </span>
            <span className="text-xs font-semibold text-slate-400">patients</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 truncate">
            100% active telemetry streaming
          </div>
        </Card>

        {/* Tile 4: Active Clinical Alerts */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Unresolved Alerts
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {alertsData?.unresolved_count ?? 0}
            </span>
            <span className="text-xs font-semibold text-rose-500 font-medium">
              ({alertsData?.critical_count ?? 0} Critical)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-teal-600 dark:text-teal-400 font-medium flex items-center gap-1">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>AI Forecaster Armed</span>
          </div>
        </Card>
      </div>

      {/* Main Telemetry Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Heart Rate with 90% Confidence Band */}
        <Card className="flex flex-col">
          <CardHeader
            title="Heart Rate (BPM)"
            subtitle={
              <span className="flex items-center gap-2">
                <span>Continuous ECG telemetry</span>
                {showForecast && (
                  <span className="text-purple-600 dark:text-purple-400 font-semibold text-[11px]">
                    • 12-min AI Trajectory & 90% CI
                  </span>
                )}
              </span>
            }
            action={
              <div className="text-right">
                <span className="text-xl font-black text-rose-600 dark:text-rose-400">
                  {Math.round(currentHR)}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">BPM</span>
              </div>
            }
          />

          <div className="h-64 w-full mt-2">
            {vitalsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1FA89A" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1FA89A" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="forecastHrBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#9333EA" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#9333EA" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={30} />
                  <YAxis domain={['dataMin - 10', 'dataMax + 10']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  {/* Historical Real Telemetry */}
                  <Area
                    type="monotone"
                    dataKey="hr"
                    stroke="#1FA89A"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#hrGradient)"
                    name="Observed HR"
                    isAnimationActive={false}
                  />

                  {/* 90% Confidence Interval Band (Area) */}
                  {showForecast && (
                    <Area
                      type="monotone"
                      dataKey="hr_band"
                      stroke="none"
                      fill="url(#forecastHrBand)"
                      name="90% Confidence Interval"
                    />
                  )}

                  {/* Forecast Mean (Dashed Line) */}
                  {showForecast && (
                    <Line
                      type="monotone"
                      dataKey="hr_forecast"
                      stroke="#9333EA"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: '#9333EA' }}
                      name="LSTM Forecast"
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Chart 2: Blood Pressure (Systolic & Diastolic) */}
        <Card className="flex flex-col">
          <CardHeader
            title="Blood Pressure (mm Hg)"
            subtitle="Arterial SBP / DBP telemetry"
            action={
              <div className="text-right">
                <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                  {Math.round(currentSBP)}/{Math.round(currentDBP)}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">mmHg</span>
              </div>
            }
          />

          <div className="h-64 w-full mt-2">
            {vitalsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="sbpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4A7BD0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4A7BD0" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.5} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} minTickGap={30} />
                  <YAxis domain={[40, 180]} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  {/* Systolic Line & Diastolic Line */}
                  <Area
                    type="monotone"
                    dataKey="sbp"
                    stroke="#4A7BD0"
                    strokeWidth={2}
                    fill="url(#sbpGradient)"
                    name="Systolic BP"
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="dbp"
                    stroke="#0284C7"
                    strokeWidth={2}
                    dot={false}
                    name="Diastolic BP"
                    isAnimationActive={false}
                  />

                  {/* SBP Forecast */}
                  {showForecast && (
                    <Line
                      type="monotone"
                      dataKey="sbp_forecast"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: '#8B5CF6' }}
                      name="SBP Forecast"
                      isAnimationActive={false}
                    />
                  )}

                  {/* DBP Forecast */}
                  {showForecast && (
                    <Line
                      type="monotone"
                      dataKey="dbp_forecast"
                      stroke="#A78BFA"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={{ r: 2, fill: '#A78BFA' }}
                      name="DBP Forecast"
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Two Column Bottom Grid: Inpatients Roster & Live Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inpatients Card */}
        <Card>
          <CardHeader
            title="Ward Inpatients Roster"
            subtitle="Click patient to focus telemetry"
            action={
              <button
                onClick={() => navigate('/patients')}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
              >
                <span>View All ({patientsData?.total ?? 20})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          <div className="space-y-2 mt-2">
            {patientsLoading ? (
              <CardSkeleton rows={3} />
            ) : (
              patientsData?.patients?.slice(0, 5).map((p) => {
                const isSelected = p.id === activePatientId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePatientId(p.id)}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-teal-50/70 dark:bg-teal-950/40 border-teal-300 dark:border-teal-700 shadow-xs'
                        : 'bg-slate-50/60 dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/60 hover:bg-slate-100/60 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {p.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {p.name}
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {p.room || 'ICU'} • {p.conditions || 'General Monitoring'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        size="sm"
                        variant={p.status === 'stable' ? 'stable' : p.status === 'warning' ? 'attention' : 'critical'}
                        dot
                      >
                        {p.status}
                      </Badge>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/patients/${p.id}`);
                        }}
                        className="p-1 text-slate-400 hover:text-teal-600 transition-colors"
                        title="View Full Patient Chart"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Active Alerts Card */}
        <Card>
          <CardHeader
            title="Active Clinical Alerts"
            subtitle="Threshold breaches & forward predictions"
            action={
              <button
                onClick={() => navigate('/alerts')}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
              >
                <span>Alert Center</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            }
          />

          <div className="space-y-2 mt-2">
            {!alertsData?.alerts?.length ? (
              <EmptyState
                icon={CheckCircle}
                title="All Clear in Ward"
                description="No active threshold breaches or predictive alerts raised."
              />
            ) : (
              alertsData.alerts.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                    a.predicted
                      ? 'bg-purple-50/60 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
                      : a.severity === 'critical'
                      ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5">
                      {a.predicted ? (
                        <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {a.predicted && (
                          <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 uppercase">
                            PREDICTED
                          </span>
                        )}
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                          Patient #{a.patient_id}
                        </span>
                        <Badge size="sm" variant={a.severity as any}>
                          {a.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                        {a.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {!a.acknowledged_by ? (
                      <button
                        onClick={() => ackMutation.mutate(a.id)}
                        disabled={ackMutation.isPending}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        Acknowledged
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
