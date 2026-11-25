import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Filter,
  CheckCircle2,
  AlertTriangle,
  BrainCircuit,
  Clock,
  ShieldCheck,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { CardSkeleton } from '../components/common/LoadingSkeleton';
import { useToastStore } from '../store/useToastStore';
import { AlertSeverity } from '../types';

export const AlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved' | 'predicted'>('unresolved');

  // Query alerts list
  const { data, isLoading } = useQuery({
    queryKey: ['alerts-full-list', severityFilter, statusFilter],
    queryFn: () =>
      api.getAlerts({
        severity: severityFilter !== 'all' ? severityFilter : undefined,
        resolved: statusFilter === 'unresolved' ? false : statusFilter === 'resolved' ? true : undefined,
        predicted: statusFilter === 'predicted' ? true : undefined,
        limit: 100,
      }),
    refetchInterval: 6000,
  });

  // Acknowledge Alert Mutation
  const ackMutation = useMutation({
    mutationFn: (id: number) => api.acknowledgeAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-full-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-summary-count'] });
      addToast({
        title: 'Alert Acknowledged',
        message: 'Clinical team notified of acknowledgment signature.',
        type: 'info',
      });
    },
  });

  // Resolve Alert Mutation
  const resolveMutation = useMutation({
    mutationFn: (id: number) => api.resolveAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-full-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-summary-count'] });
      addToast({
        title: 'Alert Resolved',
        message: 'Patient physiological breach marked as addressed.',
        type: 'success',
      });
    },
  });

  const alerts = data?.alerts || [];

  return (
    <div className="space-y-6">
      {/* Top Filter Pills & Metrics Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Breaches</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {data?.total ?? 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-rose-100 dark:border-rose-950/60 shadow-soft">
          <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider">Critical Active</span>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {data?.critical_count ?? 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-amber-100 dark:border-amber-950/60 shadow-soft">
          <span className="text-[11px] font-semibold text-amber-500 uppercase tracking-wider">Unresolved</span>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {data?.unresolved_count ?? 0}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-purple-100 dark:border-purple-950/60 shadow-soft">
          <span className="text-[11px] font-semibold text-purple-500 uppercase tracking-wider">AI Forecast Warnings</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {alerts.filter((a) => a.predicted).length}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl text-xs font-semibold">
          {(['unresolved', 'all', 'predicted', 'resolved'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {s === 'predicted' ? '✨ AI Predicted' : s}
            </button>
          ))}
        </div>

        {/* Severity Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Severity:</span>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Alerts Feed */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <CardSkeleton rows={5} />
          </div>
        ) : !alerts.length ? (
          <EmptyState
            icon={CheckCircle2}
            title="No Clinical Breaches"
            description="There are currently no physiological threshold violations matching your filters."
          />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 md:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                  alert.resolved
                    ? 'opacity-65 bg-slate-50/40 dark:bg-slate-900/20'
                    : alert.predicted
                    ? 'bg-purple-50/40 dark:bg-purple-950/20 hover:bg-purple-50/70'
                    : alert.severity === 'critical'
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70'
                    : 'hover:bg-slate-50/60 dark:hover:bg-slate-700/30'
                }`}
              >
                {/* Left: Icon & Description */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">
                    {alert.predicted ? (
                      <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 animate-pulse" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {alert.predicted && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider px-2 py-0.5 rounded-full bg-purple-200 dark:bg-purple-900 text-purple-800 dark:text-purple-200 uppercase">
                          <Sparkles className="w-3 h-3" />
                          PREDICTED 12-MIN
                        </span>
                      )}
                      <Badge variant={alert.severity as any} size="sm">
                        {alert.severity.toUpperCase()}
                      </Badge>
                      <button
                        onClick={() => navigate(`/patients/${alert.patient_id}`)}
                        className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline"
                      >
                        Patient #{alert.patient_id}
                      </button>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-xs md:text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
                      {alert.message}
                    </p>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      <span>Type: <strong className="text-slate-600 dark:text-slate-300 uppercase">{alert.type.replace('_', ' ')}</strong></span>
                      {alert.acknowledged_by && (
                        <span className="text-teal-600 dark:text-teal-400 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Staff Acknowledged
                        </span>
                      )}
                      {alert.resolved && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved at {new Date(alert.resolved_at || alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                  {!alert.acknowledged_by && !alert.resolved && (
                    <button
                      onClick={() => ackMutation.mutate(alert.id)}
                      disabled={ackMutation.isPending}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  )}

                  {!alert.resolved ? (
                    <button
                      onClick={() => resolveMutation.mutate(alert.id)}
                      disabled={resolveMutation.isPending}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Resolve</span>
                    </button>
                  ) : (
                    <Badge variant="stable" size="sm">
                      Resolved
                    </Badge>
                  )}

                  <button
                    onClick={() => navigate(`/patients/${alert.patient_id}`)}
                    className="p-1.5 text-slate-400 hover:text-teal-600 transition-colors"
                    title="Open Patient Telemetry Chart"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
