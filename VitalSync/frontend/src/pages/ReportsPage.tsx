import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Card, CardHeader } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { useToastStore } from '../store/useToastStore';

export const ReportsPage: React.FC = () => {
  const addToast = useToastStore((s) => s.addToast);
  const [selectedPatientId, setSelectedPatientId] = useState<number>(1);
  const [reportTimeframe, setReportTimeframe] = useState<'24h' | '48h' | '7d'>('24h');
  const [isExporting, setIsExporting] = useState(false);

  // 1. Fetch Inpatients Roster for dropdown
  const { data: patientsData } = useQuery({
    queryKey: ['reports-patients-list'],
    queryFn: () => api.getPatients({ page: 1, pageSize: 50 }),
  });

  const selectedPatient = patientsData?.patients?.find((p) => p.id === selectedPatientId) || patientsData?.patients?.[0];

  // 2. Fetch Selected Patient's Vitals Preview
  const { data: vitalsData, isLoading: vitalsLoading } = useQuery({
    queryKey: ['report-preview-vitals', selectedPatientId, reportTimeframe],
    queryFn: () => api.getVitals(selectedPatientId, { limit: 100 }),
    enabled: !!selectedPatientId,
  });

  // 3. Fetch Selected Patient's Alerts Preview
  const { data: alertsData } = useQuery({
    queryKey: ['report-preview-alerts', selectedPatientId],
    queryFn: () => api.getAlerts({ patientId: selectedPatientId, limit: 10 }),
    enabled: !!selectedPatientId,
  });

  const handleDownload = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    try {
      await api.downloadReport(selectedPatientId, format);
      addToast({
        title: `Report Exported (${format.toUpperCase()})`,
        message: `Clinical summary downloaded for ${selectedPatient?.name || `Patient #${selectedPatientId}`}.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Report Generation Failed',
        message: err.message,
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const readings = vitalsData?.data || [];
  const alerts = alertsData?.alerts || [];

  return (
    <div className="space-y-6">
      {/* Top Patient & Timeframe Configuration Bar */}
      <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Audit & Documentation
            </span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              Clinical Report Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Export physiological telemetry timeseries, alert histories, and physician progress notes.
            </p>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDownload('csv')}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Export Raw CSV</span>
            </button>

            <button
              onClick={() => handleDownload('pdf')}
              disabled={isExporting}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Styled PDF</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-100 dark:border-slate-700/60 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select Patient:
            </label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-semibold focus:outline-none"
            >
              {patientsData?.patients?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.patient_uid}) • {p.room || 'ICU'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Audit Time Horizon:
            </label>
            <div className="flex items-center gap-2">
              {(['24h', '48h', '7d'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setReportTimeframe(t)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                    reportTimeframe === t
                      ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-700 dark:text-teal-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Last {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Report Preview Document Container */}
      <Card className="border border-slate-200 dark:border-slate-700 shadow-soft-lg">
        {/* Document Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500 text-white flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Clinical Electronic Health Record Export
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Patient Physiological Telemetry Report
              </h3>
            </div>
          </div>

          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
            <div>Generated: {new Date().toLocaleDateString()}</div>
            <div className="text-[10px] text-teal-600 font-medium">VitalSync Certified Stream</div>
          </div>
        </div>

        {/* Patient Summary Header */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-slate-100 dark:border-slate-700/60">
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Patient Name</span>
            <p className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedPatient?.name}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Hospital UID</span>
            <p className="font-mono text-slate-800 dark:text-slate-200 mt-0.5">{selectedPatient?.patient_uid}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Room / Ward</span>
            <p className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">{selectedPatient?.room || 'ICU-Ward'}</p>
          </div>
          <div>
            <span className="text-slate-400 uppercase font-semibold text-[10px]">Current Status</span>
            <div className="mt-0.5">
              <Badge variant={selectedPatient?.status as any || 'stable'} size="sm">
                {selectedPatient?.status?.toUpperCase() || 'STABLE'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Readings Preview Table */}
        <div className="p-6">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center justify-between">
            <span>Recent Physiological Telemetry Log (Sample)</span>
            <span className="text-xs font-normal text-slate-400">Showing last {readings.slice(-10).length} readings</span>
          </h4>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-400 uppercase font-semibold text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Heart Rate (BPM)</th>
                  <th className="py-2.5 px-3">Systolic BP (mmHg)</th>
                  <th className="py-2.5 px-3">Diastolic BP (mmHg)</th>
                  <th className="py-2.5 px-3">Mean Arterial (MAP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-slate-700 dark:text-slate-200">
                {readings.slice(-10).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="py-2 px-3 font-semibold text-teal-600 dark:text-teal-400">{Math.round(r.hr)}</td>
                    <td className="py-2 px-3 font-semibold text-blue-600 dark:text-blue-400">{Math.round(r.sbp)}</td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{Math.round(r.dbp)}</td>
                    <td className="py-2 px-3 font-mono">{Math.round(r.dbp + (r.sbp - r.dbp) / 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Associated Alerts in Timeframe */}
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-6 mb-3">
            Associated Threshold & Predictive Alerts
          </h4>
          {!alerts.length ? (
            <p className="text-xs text-slate-400 italic">No alarms triggered during this audit window.</p>
          ) : (
            <div className="space-y-2">
              {alerts.slice(0, 4).map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant={a.severity as any} size="sm">
                      {a.severity}
                    </Badge>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{a.message}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
