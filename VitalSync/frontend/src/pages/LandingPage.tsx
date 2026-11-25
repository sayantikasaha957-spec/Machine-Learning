import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BrainCircuit,
  Bell,
  LineChart,
  ShieldCheck,
  ArrowRight,
  Database,
  CheckCircle,
  Cpu,
  Layers,
  HeartPulse,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  const { data: modelMetrics } = useQuery({
    queryKey: ['landing-model-metrics'],
    queryFn: () => api.getModelMetrics(),
  });

  const lstmModel = modelMetrics?.models?.find((m) => m.model_name.includes('LSTM'));
  const baselineModel = modelMetrics?.models?.find((m) => m.model_name.includes('Last Value'));

  return (
    <div className="min-h-screen bg-page dark:bg-page-dark flex flex-col text-slate-800 dark:text-slate-100 transition-colors">
      {/* Navigation Header */}
      <header className="h-20 max-w-7xl mx-auto w-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
              VitalSync
            </span>
            <span className="block text-[10px] uppercase font-bold text-teal-600 dark:text-teal-400 tracking-wider">
              Clinical Telemetry & Forecasting
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm shadow-sm shadow-teal-500/20 transition-all flex items-center gap-2"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/login?tab=demo"
                className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-sm shadow-sm shadow-teal-500/20 transition-all flex items-center gap-2"
              >
                <span>Launch Demo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-6 pt-12 pb-20 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-100/80 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold mb-6">
          <HeartPulse className="w-4 h-4 text-teal-500 animate-pulse" />
          <span>Bi-directional LSTM Forecasting & Real-Time ICU Telemetry</span>
        </div>

        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight md:leading-none">
          Anticipate Critical Patient Instability{' '}
          <span className="bg-gradient-to-r from-teal-500 to-blue-600 bg-clip-text text-transparent">
            Before It Occurs.
          </span>
        </h1>

        <p className="mt-6 text-base md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
          VitalSync bridges high-frequency bedside telemetry streams with trained stacked LSTM neural networks, providing 12-minute forward forecasts and 90% confidence bands to preempt clinical deterioration.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/login?tab=demo"
            className="px-6 py-3.5 rounded-2xl bg-teal-500 hover:bg-teal-600 text-white font-bold text-sm shadow-lg shadow-teal-500/25 transition-all flex items-center gap-2 transform hover:-translate-y-0.5"
          >
            <span>Explore Active ICU Ward</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/model"
            className="px-6 py-3.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-800 dark:text-slate-100 font-bold text-sm border border-slate-200 dark:border-slate-700 shadow-sm transition-all"
          >
            Review LSTM Metrics
          </Link>
        </div>

        {/* Highlight Stats Banner */}
        <div className="mt-14 w-full grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-soft">
            <div className="text-2xl md:text-3xl font-extrabold text-teal-600 dark:text-teal-400">
              {lstmModel ? `${lstmModel.overall_mae.toFixed(2)}` : '5.92'}
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mt-0.5">
              LSTM Overall MAE
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              Beats baseline by 16.1%
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-soft">
            <div className="text-2xl md:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              12 min
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mt-0.5">
              Forward Horizon
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              1-minute step resolution
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-soft">
            <div className="text-2xl md:text-3xl font-extrabold text-purple-600 dark:text-purple-400">
              90% CI
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mt-0.5">
              Uncertainty Band
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              Monte Carlo Dropout
            </div>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 shadow-soft">
            <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              217
            </div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mt-0.5">
              Clinical Patients
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
              VitalDB High-Res Dataset
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Pipeline */}
      <section className="bg-white dark:bg-slate-900/60 py-16 border-y border-slate-200/80 dark:border-slate-800 transition-colors">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              End-to-End Pipeline
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mt-1">
              From Raw Waveforms to Preemptive Alerts
            </h2>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2">
              Continuous physiological monitoring combined with sequential deep learning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-950 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-4">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                1. Telemetry Ingestion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Bedside telemetry feeds 1-minute sampled Heart Rate, Systolic BP, and Diastolic BP sequences into a 60-minute sliding window.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                2. Stacked LSTM
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Two recurrent LSTM layers (128 & 64 units) with spatial dropout extract non-linear temporal dependencies and cardiac dynamics.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                3. MC Dropout Uncertainty
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                30 batched stochastic forward passes construct empirical 90% confidence bands, capturing epistemic prediction uncertainty.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4">
                <Bell className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                4. Preemptive Triage
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                When predicted vitals breach clinical thresholds within the next hour, proactive alerts dispatch to nurses with cooldown anti-spam.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-16 max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-soft">
            <LineChart className="w-8 h-8 text-teal-500 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              Continuous Live Charts
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Real-time WebSockets stream vital telemetry updates every 2–3 seconds with gradient fill area charts and dynamic pulse indicators.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-soft">
            <ShieldCheck className="w-8 h-8 text-blue-500 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              Role-Based Access Control
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Granular authorization tailored for Chief Medical Administrators, Attending Intensivists, and Bedside Registered Nurses.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-soft">
            <Cpu className="w-8 h-8 text-purple-500 mb-3" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-2">
              In-Browser Model Auditing
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Inspect model loss curves, test set scatter plots, feature error distributions, and trigger background retraining pipelines with live telemetry.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Footer Section */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-12 px-6 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-5 h-5 text-teal-400" />
            <span className="font-bold text-white text-base">VitalSync Health Technologies</span>
          </div>

          {/* Mandatory Demo Disclaimer */}
          <div className="p-3 my-4 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-xl text-xs text-amber-300 font-medium">
            <strong>CLINICAL DISCLAIMER:</strong> VitalSync is a technology demonstration and research prototype. Not intended for direct medical diagnosis, emergency life support, or active clinical triage decisions.
          </div>

          <p className="text-xs text-slate-500 mt-2">
            Built with React 18, Vite, Tailwind CSS, FastAPI, and TensorFlow LSTM.
          </p>
        </div>
      </footer>
    </div>
  );
};
