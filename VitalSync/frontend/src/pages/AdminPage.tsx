import React, { useState } from 'react';
import {
  Shield,
  Users,
  RefreshCw,
  Cpu,
  Database,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Play,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { useToastStore } from '../store/useToastStore';

export const AdminPage: React.FC = () => {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  // Retrain configuration state
  const [epochs, setEpochs] = useState(5);
  const [batchSize, setBatchSize] = useState(64);

  // 1. Fetch Backend System Health
  const { data: healthData } = useQuery({
    queryKey: ['admin-health-check'],
    queryFn: () => api.checkHealth(),
    refetchInterval: 10000,
  });

  // 2. Fetch Retraining Job Status
  const { data: retrainStatus } = useQuery({
    queryKey: ['admin-retrain-status'],
    queryFn: () => api.getRetrainStatus(),
    refetchInterval: 3000,
  });

  // Retraining Mutation
  const retrainMutation = useMutation({
    mutationFn: () =>
      api.triggerRetrain({
        epochs: Number(epochs),
        batch_size: Number(batchSize),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-retrain-status'] });
      addToast({
        title: 'Retraining Pipeline Launched',
        message: `Task ${res.task_id} initialized in background worker thread.`,
        type: 'info',
      });
    },
    onError: (err: any) => {
      addToast({
        title: 'Retraining Launch Failed',
        message: err.message,
        type: 'error',
      });
    },
  });

  const isRetraining = retrainStatus?.status === 'running' || retrainStatus?.status === 'pending';

  return (
    <div className="space-y-6">
      {/* Admin Privilege Header */}
      <div className="bg-gradient-to-r from-teal-600 to-blue-700 text-white rounded-2xl p-6 shadow-soft flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-teal-200" />
            <span className="text-xs font-bold uppercase tracking-wider text-teal-200">
              Chief Medical Administrator Portal
            </span>
          </div>
          <h2 className="text-2xl font-black">
            System Infrastructure & Model Orchestration
          </h2>
          <p className="text-xs text-teal-100 mt-1 max-w-xl">
            Trigger asynchronous background neural network retraining, inspect database telemetry counts, and audit connected clinical staff accounts.
          </p>
        </div>

        <Badge variant="stable">
          DATABASE ONLINE
        </Badge>
      </div>

      {/* System Health & Telemetry Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">FastAPI Backend</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{healthData?.status || 'OK'} ({healthData?.version || '0.1.0'})</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Uvicorn ASGI Engine</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Relational Database</span>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-500" />
            <span>SQLite (vitalsync.db)</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">SQLAlchemy ORM + Indices</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active ML Model</span>
          <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            <span>Stacked LSTM v1.0.0</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Keras + Monte Carlo Dropout</p>
        </div>
      </div>

      {/* Model Retraining Pipeline Card */}
      <Card>
        <CardHeader
          title="Neural Network Retraining Pipeline"
          subtitle="Fine-tune or re-estimate LSTM parameters on updated ward telemetry sequences"
          action={
            <Badge variant={isRetraining ? 'attention' : 'stable'}>
              {isRetraining ? 'TRAINING IN PROGRESS' : 'IDLE / READY'}
            </Badge>
          }
        />

        <div className="space-y-4 mt-2">
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Epochs to Train:
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={epochs}
                disabled={isRetraining}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400">Re-fits scaler and early stopping checkpoint</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mini-Batch Size:
              </label>
              <select
                value={batchSize}
                disabled={isRetraining}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              >
                <option value={32}>32 sequences</option>
                <option value={64}>64 sequences (recommended)</option>
                <option value={128}>128 sequences</option>
              </select>
            </div>
          </div>

          {/* Trigger Button */}
          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => retrainMutation.mutate()}
              disabled={isRetraining || retrainMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold text-xs shadow-sm flex items-center gap-2 cursor-pointer transition-all"
            >
              {isRetraining ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Retraining Active...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Launch Asynchronous Retrain</span>
                </>
              )}
            </button>

            {retrainStatus?.started_at && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Last run: {new Date(retrainStatus.started_at).toLocaleTimeString()}</span>
              </span>
            )}
          </div>

          {/* Progress Tracker Box */}
          {retrainStatus && retrainStatus.status !== 'idle' && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold">
                <span className="text-slate-700 dark:text-slate-200">
                  Job ID: {retrainStatus.job_id} • Status: <span className="uppercase text-teal-600 dark:text-teal-400">{retrainStatus.status}</span>
                </span>
                <span className="text-slate-500 font-mono">
                  Epoch {retrainStatus.current_epoch} / {retrainStatus.total_epochs}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-teal-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (retrainStatus.current_epoch / Math.max(1, retrainStatus.total_epochs)) * 100
                    )}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {retrainStatus.message}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Demo Accounts Reference */}
      <Card>
        <CardHeader
          title="Clinical Staff Accounts (Demo Roster)"
          subtitle="Pre-seeded provider credentials"
        />

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Account Email</th>
                <th className="py-2.5 px-3">Default Password</th>
                <th className="py-2.5 px-3">Full Name & Title</th>
                <th className="py-2.5 px-3">Access Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
              <tr>
                <td className="py-2.5 px-3">
                  <Badge variant="critical" size="sm">Admin</Badge>
                </td>
                <td className="py-2.5 px-3 font-mono">admin@vitalsync.com</td>
                <td className="py-2.5 px-3 font-mono">Admin123!</td>
                <td className="py-2.5 px-3">Dr. Sarah Chen</td>
                <td className="py-2.5 px-3 text-slate-500">Full Access, Retrain & User Controls</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3">
                  <Badge variant="info" size="sm">Doctor</Badge>
                </td>
                <td className="py-2.5 px-3 font-mono">doctor@vitalsync.com</td>
                <td className="py-2.5 px-3 font-mono">Doctor123!</td>
                <td className="py-2.5 px-3">Dr. Alex Rivers</td>
                <td className="py-2.5 px-3 text-slate-500">Patient Admission, Orders, Notes</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3">
                  <Badge variant="stable" size="sm">Nurse</Badge>
                </td>
                <td className="py-2.5 px-3 font-mono">nurse@vitalsync.com</td>
                <td className="py-2.5 px-3 font-mono">Nurse123!</td>
                <td className="py-2.5 px-3">Nurse James Miller</td>
                <td className="py-2.5 px-3 text-slate-500">Bedside Telemetry, Alert Triage</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
