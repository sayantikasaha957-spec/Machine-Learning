import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/LoadingSkeleton';
import { EmptyState } from '../components/common/EmptyState';
import { Patient, PatientStatus } from '../types';

export const PatientsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  // Table state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'age' | 'room' | 'status'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(searchParams.get('action') === 'new');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [deletingPatient, setDeletingPatient] = useState<Patient | null>(null);

  React.useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setIsAddModalOpen(true);
    }
  }, [searchParams]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formAge, setFormAge] = useState(50);
  const [formGender, setFormGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [formConditions, setFormConditions] = useState('');
  const [formRoom, setFormRoom] = useState('ICU-01');
  const [formStatus, setFormStatus] = useState<PatientStatus>('stable');

  // Query Patients
  const { data, isLoading } = useQuery({
    queryKey: ['patients-list', page, pageSize, searchTerm, statusFilter],
    queryFn: () =>
      api.getPatients({
        page,
        pageSize,
        search: searchTerm,
        status: statusFilter,
      }),
  });

  // Create Patient Mutation
  const createMutation = useMutation({
    mutationFn: (newPatient: Partial<Patient>) => api.createPatient(newPatient),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
      setIsAddModalOpen(false);
      resetForm();
      addToast({
        title: 'Patient Admitted',
        message: `${p.name} has been enrolled into ward monitoring.`,
        type: 'success',
      });
    },
    onError: (err: any) => {
      addToast({
        title: 'Admission Failed',
        message: err.message,
        type: 'error',
      });
    },
  });

  // Update Patient Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Patient> }) =>
      api.updatePatient(id, data),
    onSuccess: (p) => {
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
      setEditingPatient(null);
      resetForm();
      addToast({
        title: 'Patient Record Updated',
        message: `Changes to ${p.name} were successfully saved.`,
        type: 'success',
      });
    },
    onError: (err: any) => {
      addToast({
        title: 'Update Failed',
        message: err.message,
        type: 'error',
      });
    },
  });

  // Delete Patient Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deletePatient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients-list'] });
      setDeletingPatient(null);
      addToast({
        title: 'Patient Discharged',
        message: 'Patient record successfully discharged and archived.',
        type: 'info',
      });
    },
    onError: (err: any) => {
      addToast({
        title: 'Discharge Failed',
        message: err.message,
        type: 'error',
      });
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormAge(50);
    setFormGender('Male');
    setFormConditions('');
    setFormRoom('ICU-01');
    setFormStatus('stable');
  };

  const handleOpenEdit = (p: Patient) => {
    setEditingPatient(p);
    setFormName(p.name);
    setFormAge(p.age);
    setFormGender(p.gender);
    setFormConditions(p.conditions || '');
    setFormRoom(p.room || '');
    setFormStatus(p.status);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: formName,
      age: Number(formAge),
      gender: formGender,
      conditions: formConditions,
      room: formRoom,
      status: formStatus,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;
    updateMutation.mutate({
      id: editingPatient.id,
      data: {
        name: formName,
        age: Number(formAge),
        gender: formGender,
        conditions: formConditions,
        room: formRoom,
        status: formStatus,
      },
    });
  };

  // Sorting
  const sortedPatients = React.useMemo(() => {
    if (!data?.patients) return [];
    return [...data.patients].sort((a, b) => {
      let valA = a[sortBy] ?? '';
      let valB = b[sortBy] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data?.patients, sortBy, sortAsc]);

  const toggleSort = (field: 'name' | 'age' | 'room' | 'status') => {
    if (sortBy === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(field);
      setSortAsc(true);
    }
  };

  const totalPages = Math.ceil((data?.total || 0) / pageSize) || 1;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, room, condition, or UID..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-colors"
          />
        </div>

        {/* Filter & Add Actions */}
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none pr-2 py-1 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="stable">Stable</option>
              <option value="warning">Attention</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Admit Patient Button */}
          {(role === 'admin' || role === 'doctor') && (
            <button
              onClick={() => {
                resetForm();
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white font-semibold text-xs shadow-sm shadow-teal-500/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Admit Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Patients Table Card */}
      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <TableSkeleton cols={6} rows={8} />
        ) : !sortedPatients.length ? (
          <EmptyState
            icon={Users}
            title="No Inpatients Found"
            description="No patients match your current search criteria or ward filter."
            actionText="Clear Filters"
            onAction={() => {
              setSearchTerm('');
              setStatusFilter('all');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3 px-4 cursor-pointer hover:text-teal-600 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Patient Name / UID</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('room')}
                    className="py-3 px-4 cursor-pointer hover:text-teal-600 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Room</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('age')}
                    className="py-3 px-4 cursor-pointer hover:text-teal-600 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Age / Gender</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Primary Clinical Condition</th>
                  <th
                    onClick={() => toggleSort('status')}
                    className="py-3 px-4 cursor-pointer hover:text-teal-600 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Ward Status</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-800 dark:text-slate-200">
                {sortedPatients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/patients/${p.id}`)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {p.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">
                            {p.patient_uid}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      {p.room || 'General ICU'}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.age} y/o • {p.gender}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                      {p.conditions || 'Routine Telemetry'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        size="sm"
                        variant={p.status === 'stable' ? 'stable' : p.status === 'warning' ? 'attention' : 'critical'}
                        dot
                      >
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/patients/${p.id}`)}
                          className="p-1.5 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 rounded-lg transition-colors"
                          title="View Telemetry Chart"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {(role === 'admin' || role === 'doctor') && (
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {role === 'admin' && (
                          <button
                            onClick={() => setDeletingPatient(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                            title="Discharge Patient"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div>
            Showing Page <span className="font-semibold text-slate-800 dark:text-slate-200">{page}</span> of{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{totalPages}</span> ({data?.total || 0} total inpatients)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Add Patient Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Admit New Inpatient"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Patient Full Name *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Samuel Bennett"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Age *
              </label>
              <input
                type="number"
                required
                min={0}
                max={125}
                value={formAge}
                onChange={(e) => setFormAge(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Gender *
              </label>
              <select
                value={formGender}
                onChange={(e) => setFormGender(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ICU Ward Room
              </label>
              <input
                type="text"
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                placeholder="ICU-04A"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="stable">Stable</option>
                <option value="warning">Attention</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Primary Clinical Conditions / Diagnosis
            </label>
            <textarea
              rows={2}
              value={formConditions}
              onChange={(e) => setFormConditions(e.target.value)}
              placeholder="e.g. Post-CABG recovery, acute respiratory distress monitoring"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-sm transition-all"
            >
              {createMutation.isPending ? 'Admitting...' : 'Confirm Admission'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Patient Modal */}
      <Modal
        isOpen={!!editingPatient}
        onClose={() => setEditingPatient(null)}
        title="Edit Patient Details"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Patient Full Name *
            </label>
            <input
              type="text"
              required
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Age
              </label>
              <input
                type="number"
                value={formAge}
                onChange={(e) => setFormAge(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="stable">Stable</option>
                <option value="warning">Attention</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Room Location
            </label>
            <input
              type="text"
              value={formRoom}
              onChange={(e) => setFormRoom(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Diagnosis & Conditions
            </label>
            <textarea
              rows={2}
              value={formConditions}
              onChange={(e) => setFormConditions(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setEditingPatient(null)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-teal-500 hover:bg-teal-600 text-white shadow-sm transition-all"
            >
              {updateMutation.isPending ? 'Saving...' : 'Update Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingPatient}
        onClose={() => setDeletingPatient(null)}
        title="Confirm Patient Discharge"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Irreversible Action</p>
              <p className="mt-0.5">
                Discharging <span className="font-semibold">{deletingPatient?.name}</span> will permanently delete their telemetry stream, historical vitals, and associated clinical alerts.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeletingPatient(null)}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deletingPatient && deleteMutation.mutate(deletingPatient.id)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
            >
              {deleteMutation.isPending ? 'Discharging...' : 'Confirm Discharge'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
