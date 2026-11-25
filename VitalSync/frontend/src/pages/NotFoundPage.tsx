import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft, Activity } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-page dark:bg-page-dark flex flex-col items-center justify-center p-6 text-center transition-colors">
      <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-800 shadow-soft-lg flex items-center justify-center text-teal-500 mb-6 border border-slate-100 dark:border-slate-700">
        <FileQuestion className="w-8 h-8" />
      </div>
      <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
        Error 404
      </span>
      <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-1 mb-2">
        Clinical Route Not Found
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
        The telemetry chart, patient identifier, or application view you requested does not exist or has been relocated.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs shadow-sm shadow-teal-500/20 transition-all"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Ward Dashboard</span>
      </Link>
    </div>
  );
};
