import React from 'react';
import { LineChart, Sparkles } from 'lucide-react';

export const ForecastingPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">LSTM Health Forecasting</h1>
          <p className="text-sm text-slate-600">Deep learning predictions for early decompensation warning</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card-sm text-xs font-semibold bg-accent-light text-accent-blue border border-accent-blue/20">
          <Sparkles className="w-4 h-4" />
          Keras LSTM Engine
        </span>
      </div>

      <div className="bg-white rounded-card p-8 shadow-soft border border-slate-200/80 text-center">
        <LineChart className="w-12 h-12 mx-auto text-accent-blue mb-3" />
        <h3 className="text-base font-semibold text-slate-800">LSTM Time-Series Forecasting Horizon</h3>
        <p className="text-xs text-slate-500 max-w-lg mx-auto mt-2">
          Model training pipeline configured under <code className="bg-slate-100 px-1 py-0.5 rounded text-accent-dark font-mono">/ml</code>.
          Forecast inferencing views will render prediction intervals and clinical deterioration risk scores.
        </p>
      </div>
    </div>
  );
};
