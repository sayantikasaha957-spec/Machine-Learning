import React from 'react';
import { useToastStore, ToastItem } from '../../store/useToastStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, Zap, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastCard: React.FC<{ toast: ToastItem; onClose: () => void }> = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
    predicted: <Zap className="w-5 h-5 text-purple-500 animate-pulse flex-shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800',
    warning: 'border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-800',
    error: 'border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-800',
    info: 'border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800',
    predicted: 'border-purple-300 dark:border-purple-700 bg-purple-50/90 dark:bg-purple-950/70 shadow-lg shadow-purple-500/10',
  };

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-soft-md transition-all animate-in slide-in-from-bottom-3 duration-200 ${borders[toast.type]}`}
      role="alert"
    >
      {icons[toast.type]}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {toast.type === 'predicted' && (
            <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200 uppercase">
              AI Forecast Breach
            </span>
          )}
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {toast.title}
          </h4>
        </div>
        {toast.message && (
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
        aria-label="Dismiss toast"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
