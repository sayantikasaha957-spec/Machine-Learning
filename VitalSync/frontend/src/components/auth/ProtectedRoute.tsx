import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { UserRole } from '../../types';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, isLoading, role } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page dark:bg-page-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Authenticating clinical session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="p-8 max-w-lg mx-auto mt-16 text-center bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-rose-100 dark:border-rose-900/40">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-500 mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
          Access Restricted
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Your current account role (<span className="font-semibold capitalize text-teal-600 dark:text-teal-400">{role}</span>) does not possess authorization to view this clinical administration module.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-4 py-2 text-xs font-semibold rounded-xl bg-teal-500 hover:bg-teal-600 text-white transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    );
  }

  return <>{children}</>;
};
