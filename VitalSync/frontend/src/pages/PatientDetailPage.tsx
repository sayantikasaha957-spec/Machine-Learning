import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  Heart,
  Droplets,
  Calendar,
  User,
  MapPin,
  Clock,
  BrainCircuit,
  AlertTriangle,
  FileText,
  Download,
  Plus,
  Send,
  CheckCircle,
  ShieldCheck,
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

export const PatientDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const { timeRange, showForecast } = useAppStore();

  const [newNoteContent, setNewNoteContent] = useState('');

  // 1. Fetch Patient Record
  const { data: patient, isLoading: patientLoading } = useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: () => api.getPatient(patientId),
    enabled: !!patientId,
  });

  // 2. Fetch Historical Vitals
  const vitalsLimit = timeRange === '1h' ? 60 : timeRange === '6h' ? 360 : 500;
  const { data: vitalsData, isLoading: vitalsLoading } = useQuery({
    queryKey: ['patient-vitals', patientId, timeRange],
    queryFn: () => api.getVitals(patientId, { limit: vitalsLimit }),
    enabled: !!patientId,
    refetchInterval: 15000,
  });

  // 3. Fetch LSTM Multi-Horizon Forecast
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['patient-forecast', patientId],
    queryFn: () => api.getForecast(patientId, 12),
    enabled: !!patientId,
    refetchInterval: 30000,
  });

  // 4. Fetch Patient Alerts History
  const { data: alertsData } = useQuery({
    queryKey: ['patient-alerts', patientId],
    queryFn: () => api.getAlerts({ patientId, limit: 10 }),
    enabled: !!patientId,
    refetchInterval: 8000,
  });

  // 5. Fetch Patient Clinical Notes
  const { data: notesData } = useQuery({
    queryKey: ['patient-notes', patientId],
    queryFn: () => api.getPatientNotes(patientId),
    enabled: !!patientId,
  });

  // 6. Connect Real-time WebSocket Telemetry for this patient
  const [liveVitals, setLiveVitals] = useState<{
    hr: number;
    sbp: number;
    dbp: number;
    timestamp: string;
  } | null>(null);

  const { isConnected: isLiveConnected } = useWebSocketVitals({
    patientId,
    onUpdate: (data) => {
      setLiveVitals({
        hr: data.heart_rate,
        sbp: data.systolic_bp,
        dbp: data.diastolic_bp,
        timestamp: data.timestamp,
      });
      if (data.alerts_triggered?.length) {
        queryClient.invalidateQueries({ queryKey: ['patient-alerts', patientId] });
      }
    },
  });

  // Create Note Mutation
  const noteMutation = useMutation({
    mutationFn: (content: string) => api.createPatientNote(patientId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', patientId] });
      setNewNoteContent('');
      addToast({
        title: 'Note Recorded',
        message: 'Clinical progress note saved to patient record.',
        type: 'success',
      });
    },
    onError: (err: any) => {
      addToast({
        title: 'Failed to Save Note',
        message: err.message,
        type: 'error',
      });
    },
  });

  // Alert Actions Mutations
  const ackMutation = useMutation({
    mutationFn: (alertId: number) => api.acknowledgeAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts', patientId] });
      addToast({ title: 'Alert Acknowledged', type: 'info' });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (alertId: number) => api.resolveAlert(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patient-alerts', patientId] });
      addToast({ title: 'Alert Resolved', type: 'success' });
    },
  });

  // Calculate dynamic clinical risk score (0-100)
  const latestHistorical = vitalsData?.data?.[vitalsData.data.length - 1];
  const currentHR = liveVitals?.hr ?? latestHistorical?.hr ?? 75;
  const currentSBP = liveVitals?.sbp ?? latestHistorical?.sbp ?? 120;
  const currentDBP = liveVitals?.dbp ?? latestHistorical?.dbp ?? 80;

  const calculateRiskScore = () => {
    let score = 15; // baseline
    if (currentHR > 120 || currentHR < 50) score += 35;
    else if (currentHR > 100 || currentHR < 60) score += 15;

    if (currentSBP > 160 || currentSBP < 85) score += 30;
    else if (currentSBP > 140 || currentSBP < 90) score += 15;

    if (forecastData?.alert_predicted) score += 20;
    return Math.min(100, score);
  };

  const riskScore = calculateRiskScore();
  const riskVariant = riskScore > 65 ? 'critical' : riskScore > 35 ? 'attention' : 'stable';

  // Format chart series
  const chartData = React.useMemo(() => {
    const points: any[] = [];
    const historical = vitalsData?.data || [];

    const stride = historical.length > 120 ? Math.ceil(historical.length / 100) : 1;
    for (let i = 0; i < historical.length; i += stride) {
      const v = historical[i];
      const timeLabel = new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      points.push({
        time: timeLabel,
        hr: v.hr,
        sbp: v.sbp,
        dbp: v.dbp,
      });
    }

    if (showForecast && forecastData?.forecast_timestamps) {
      const lastPoint = points[points.length - 1];
      if (lastPoint) {
        lastPoint.hr_forecast = lastPoint.hr;
        lastPoint.hr_lower = lastPoint.hr;
        lastPoint.hr_upper = lastPoint.hr;
        lastPoint.sbp_forecast = lastPoint.sbp;
        lastPoint.sbp_lower = lastPoint.sbp;
        lastPoint.sbp_upper = lastPoint.sbp;
      }

      forecastData.forecast_timestamps.forEach((ts, idx) => {
        const timeLabel = new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const hrMean = forecastData.mean.heart_rate[idx];
        const hrLower = forecastData.lower_90.heart_rate[idx];
        const hrUpper = forecastData.upper_90.heart_rate[idx];

        const sbpMean = forecastData.mean.systolic_bp[idx];
        const sbpLower = forecastData.lower_90.systolic_bp[idx];
        const sbpUpper = forecastData.upper_90.systolic_bp[idx];

        points.push({
          time: timeLabel,
          isForecast: true,
          hr_forecast: hrMean,
          hr_lower: hrLower,
          hr_upper: hrUpper,
          hr_band: [hrLower, hrUpper],
          sbp_forecast: sbpMean,
          sbp_lower: sbpLower,
          sbp_upper: sbpUpper,
          sbp_band: [sbpLower, sbpUpper],
        });
      });
    }

    return points;
  }, [vitalsData, forecastData, showForecast]);

  const handleDownload = (format: 'csv' | 'pdf') => {
    api.downloadReport(patientId, format).catch((err) => {
      addToast({
        title: 'Export Failed',
        message: err.message,
        type: 'error',
      });
    });
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    noteMutation.mutate(newNoteContent);
  };

  if (patientLoading) {
    return <CardSkeleton rows={6} />;
  }

  if (!patient) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Patient Record Not Found"
        description="The requested patient identifier was not found in the hospital registry."
        actionText="Back to Roster"
        onAction={() => navigate('/patients')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => navigate('/patients')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inpatients Roster</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload('csv')}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleDownload('pdf')}
            className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Export Styled PDF</span>
          </button>
        </div>
      </div>

      {/* Patient Profile Card & Live Telemetry Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-2xl flex-shrink-0 border border-teal-200 dark:border-teal-800">
                {patient.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {patient.name}
                  </h2>
                  <Badge variant={patient.status === 'stable' ? 'stable' : patient.status === 'warning' ? 'attention' : 'critical'} dot>
                    {patient.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  UID: <span className="font-mono text-slate-700 dark:text-slate-300">{patient.patient_uid}</span> • Admitted: {new Date(patient.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${isLiveConnected ? 'bg-teal-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {isLiveConnected ? 'Live Bedside Stream' : 'Connecting Stream'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/60 text-xs">
            <div>
              <span className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px]">Demographics</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {patient.age} yrs • {patient.gender}
              </p>
            </div>
            <div>
              <span className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px]">Location</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-500" />
                <span>{patient.room || 'ICU Ward'}</span>
              </p>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400 dark:text-slate-500 uppercase font-semibold text-[10px]">Diagnosis</span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                {patient.conditions || 'General Telemetry Monitoring'}
              </p>
            </div>
          </div>
        </Card>

        {/* Dynamic Risk Score & Instability Gauge */}
        <Card className="flex flex-col justify-between">
          <CardHeader
            title="Clinical Instability Risk"
            subtitle="AI dynamic score (0-100)"
          />

          <div className="flex flex-col items-center justify-center my-auto py-2">
            <div className="relative flex items-center justify-center">
              <div
                className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center transition-colors ${
                  riskVariant === 'critical'
                    ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40'
                    : riskVariant === 'attention'
                    ? 'border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40'
                    : 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                }`}
              >
                <span className="text-3xl font-black">{riskScore}</span>
                <span className="text-[9px] font-bold uppercase tracking-wider">INDEX</span>
              </div>
            </div>

            <div className="mt-3 text-center">
              <Badge variant={riskVariant as any}>
                {riskVariant === 'critical' ? 'HIGH RISK BREACH' : riskVariant === 'attention' ? 'MODERATE ATTENTION' : 'STABLE PATIENT'}
              </Badge>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {forecastData?.alert_predicted
                  ? '⚠️ Forward LSTM forecast anticipates threshold violation.'
                  : 'Vitals consistent with recovery trajectory.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Combined Telemetry & Forecast Chart */}
      <Card>
        <CardHeader
          title="Telemetry Waveforms & 12-Minute Predictive Horizon"
          subtitle="Real-time ECG heart rate (BPM) and arterial blood pressure (mmHg)"
          action={
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  HR ({Math.round(currentHR)} BPM)
                </span>
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  BP ({Math.round(currentSBP)}/{Math.round(currentDBP)})
                </span>
              </div>
            </div>
          }
        />

        <div className="h-80 w-full mt-2">
          {vitalsLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="hrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1FA89A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1FA89A" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="purpleBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333EA" stopOpacity={0.16} />
                    <stop offset="100%" stopColor="#9333EA" stopOpacity={0.04} />
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
                <Area type="monotone" dataKey="hr" stroke="#1FA89A" strokeWidth={2.5} fill="url(#hrFill)" name="Heart Rate (BPM)" isAnimationActive={false} />
                <Line type="monotone" dataKey="sbp" stroke="#4A7BD0" strokeWidth={2} dot={false} name="Systolic BP" isAnimationActive={false} />
                <Line type="monotone" dataKey="dbp" stroke="#0284C7" strokeWidth={1.5} dot={false} name="Diastolic BP" isAnimationActive={false} />

                {/* Forecast 90% Confidence Band */}
                {showForecast && (
                  <Area type="monotone" dataKey="hr_band" stroke="none" fill="url(#purpleBand)" name="90% CI Band" />
                )}

                {/* Forecast Mean Line */}
                {showForecast && (
                  <Line
                    type="monotone"
                    dataKey="hr_forecast"
                    stroke="#9333EA"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: '#9333EA' }}
                    name="LSTM Forecast (HR)"
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Two Column Bottom Grid: Clinical Notes & Alert History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clinical Notes Timeline & Add Form */}
        <Card className="flex flex-col">
          <CardHeader
            title="Clinical Progress Notes"
            subtitle="Provider observations & nursing entries"
          />

          {/* Add Note Input Form */}
          <form onSubmit={handleAddNote} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Append clinical observation or medication update..."
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                type="submit"
                disabled={noteMutation.isPending || !newNoteContent.trim()}
                className="px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </form>

          {/* Notes List */}
          <div className="space-y-3 flex-1 overflow-y-auto max-h-80 pr-1">
            {!notesData?.length ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No clinical notes recorded yet for this patient.
              </p>
            ) : (
              notesData.map((note) => (
                <div
                  key={note.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {note.author_name}
                    </span>
                    <span className="text-[10px]">
                      {new Date(note.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-800 dark:text-slate-100 leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Patient Alert History Card */}
        <Card className="flex flex-col">
          <CardHeader
            title="Patient Alert History"
            subtitle="Recent breaches and forward warnings"
          />

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-80 pr-1">
            {!alertsData?.alerts?.length ? (
              <EmptyState
                icon={CheckCircle}
                title="Zero Active Breaches"
                description="No recent threshold violations recorded for this patient."
              />
            ) : (
              alertsData.alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border flex items-start justify-between gap-3 text-xs transition-colors ${
                    a.predicted
                      ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800'
                      : a.severity === 'critical'
                      ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5">
                      {a.predicted ? (
                        <BrainCircuit className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {a.predicted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 uppercase">
                            AI PREDICTION
                          </span>
                        )}
                        <Badge size="sm" variant={a.severity as any}>
                          {a.severity}
                        </Badge>
                        <span className="text-[10px] text-slate-400">
                          {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">
                        {a.message}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!a.acknowledged_by && (
                      <button
                        onClick={() => ackMutation.mutate(a.id)}
                        disabled={ackMutation.isPending}
                        className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                      >
                        Ack
                      </button>
                    )}
                    {!a.resolved ? (
                      <button
                        onClick={() => resolveMutation.mutate(a.id)}
                        disabled={resolveMutation.isPending}
                        className="px-2 py-1 text-[10px] font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
                      >
                        Resolve
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        Resolved
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
