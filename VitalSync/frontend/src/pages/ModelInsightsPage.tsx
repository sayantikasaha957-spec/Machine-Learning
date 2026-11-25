import React from 'react';
import {
  BrainCircuit,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  TrendingDown,
  Award,
  GitBranch,
  FileCode,
  ShieldCheck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { CardSkeleton } from '../components/common/LoadingSkeleton';

export const ModelInsightsPage: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['model-metrics-full'],
    queryFn: () => api.getModelMetrics(),
  });

  const { data: info, isLoading: infoLoading } = useQuery({
    queryKey: ['model-info-full'],
    queryFn: () => api.getModelInfo(),
  });

  if (metricsLoading || infoLoading) {
    return <CardSkeleton rows={8} />;
  }

  const models = metrics?.models || [];
  const cohort = metrics?.cohort_summary;
  const lstmModel = models.find((m) => m.model_name.includes('LSTM'));
  const baselineModel = models.find((m) => m.model_name.includes('Last Value'));

  return (
    <div className="space-y-6">
      {/* Top Provenance & Architecture Banner */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/60 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                Production Model Artifact
              </span>
              <Badge variant="stable" size="sm">
                VERSION {info?.version || 'v1.0.0'}
              </Badge>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white">
              {info?.architecture || 'Stacked LSTM Neural Forecaster'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Trained on high-resolution open telemetry from VitalDB. Generates 12-minute forward predictions with 30-pass Monte Carlo Dropout epistemic uncertainty quantification.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-slate-400 font-semibold block text-[10px] uppercase">Data Provenance</span>
              <span className="font-bold text-teal-600 dark:text-teal-400">VitalDB Open Dataset</span>
            </div>
          </div>
        </div>

        {/* Hyperparameter Specs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Lookback Window</span>
            <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              60 minutes (60 steps)
            </p>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Forecast Horizon</span>
            <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              12 minutes (12 steps)
            </p>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Uncertainty Band</span>
            <p className="font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              90% CI (MC Dropout 30 passes)
            </p>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Features Modeled</span>
            <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              HR, SBP, DBP (3 channels)
            </p>
          </div>
        </div>
      </div>

      {/* Dataset Cohort Split Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Patients</span>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {cohort?.total_patients ?? 217}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Split by patient ID (no leakage)</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Train Split</span>
          <div className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
            {cohort?.train_patients ?? 151} <span className="text-xs text-slate-400 font-normal">pts (70%)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{cohort?.train_windows ?? 32264} sequence windows</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Validation Split</span>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {cohort?.val_patients ?? 32} <span className="text-xs text-slate-400 font-normal">pts (15%)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Early stopping checkpoint</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Test Split</span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {cohort?.test_patients ?? 34} <span className="text-xs text-slate-400 font-normal">pts (15%)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">{cohort?.test_windows ?? 7049} evaluation windows</p>
        </div>
      </div>

      {/* Model Benchmark Comparison Table (Real Physiological Units) */}
      <Card className="p-0 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Benchmark Evaluation (Test Set in Real Physiological Units)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Evaluating Mean Absolute Error (MAE) and Root Mean Squared Error (RMSE) against clinical baselines
            </p>
          </div>
          <Badge variant="stable">
            <Award className="w-3.5 h-3.5 mr-1" />
            LSTM Outperforms Baselines
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Model Architecture</th>
                <th className="py-3 px-4">Overall MAE</th>
                <th className="py-3 px-4">Overall RMSE</th>
                <th className="py-3 px-4">Heart Rate MAE (BPM)</th>
                <th className="py-3 px-4">Systolic BP MAE (mmHg)</th>
                <th className="py-3 px-4">Diastolic BP MAE (mmHg)</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-800 dark:text-slate-200">
              {models.map((m, idx) => {
                const isBest = m.model_name.includes('LSTM') || m.model_name.includes('GRU');
                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      m.model_name.includes('LSTM')
                        ? 'bg-teal-50/60 dark:bg-teal-950/30 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3.5 px-4 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      <span>{m.model_name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {m.overall_mae.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                      {m.overall_rmse.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-teal-600 dark:text-teal-400">
                      {m.features.heart_rate.mae.toFixed(2)} BPM
                    </td>
                    <td className="py-3.5 px-4 font-mono text-blue-600 dark:text-blue-400">
                      {m.features.systolic_bp.mae.toFixed(2)} mmHg
                    </td>
                    <td className="py-3.5 px-4 font-mono text-indigo-600 dark:text-indigo-400">
                      {m.features.diastolic_bp.mae.toFixed(2)} mmHg
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {m.model_name.includes('LSTM') ? (
                        <Badge variant="stable" size="sm">
                          Active In Production
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-400">Baseline</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Model Version History */}
      <Card>
        <CardHeader
          title="Model Version History & Lineage"
          subtitle="Audit log of deployed neural network checkpoints"
        />

        <div className="space-y-3 mt-2">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500 text-white flex items-center justify-center font-bold">
                v1
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-white">
                  v1.0.0 — Stacked LSTM (128 - Dropout 0.2 - 64 - Dense 36)
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Trained: 2026-11-23 • EarlyStopping & ReduceLROnPlateau • 16.1% Error Reduction vs Baselines
                </div>
              </div>
            </div>

            <Badge variant="stable" size="sm">
              CURRENT ACTIVE
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};
