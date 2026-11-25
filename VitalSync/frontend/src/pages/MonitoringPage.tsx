import React from 'react';
import { HeartPulse, Radio } from 'lucide-react';

export const MonitoringPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Real-Time Vital Telemetry</h1>
          <p className="text-sm text-slate-600">High-frequency streams, waveform plots, and vitals thresholds</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-card-sm bg-white border border-slate-200 text-slate-700 shadow-soft">
          <Radio className="w-4 h-4 text-alert-red animate-pulse" />
          WebSocket: Ready
        </div>
      </div>

      <div className="bg-white rounded-card p-8 shadow-soft border border-slate-200/80 text-center">
        <HeartPulse className="w-12 h-12 mx-auto text-primary-teal mb-3" />
        <h3 className="text-base font-semibold text-slate-800">Live Telemetry Canvas</h3>
        <p className="text-xs text-slate-500 max-w-lg mx-auto mt-2">
          WebSocket channel listening for multi-channel vitals (ECG, SpO2, NIBP, Respiration Rate, Temperature).
        </p>
      </div>
    </div>
  );
};
