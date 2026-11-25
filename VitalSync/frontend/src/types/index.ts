export type UserRole = 'admin' | 'doctor' | 'nurse';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
  role: UserRole;
  user_id: number;
  full_name: string;
  email: string;
}

export type PatientStatus = 'stable' | 'warning' | 'critical';

export interface Patient {
  id: number;
  patient_uid: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  conditions?: string;
  room?: string;
  doctor_id?: number;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

export interface PatientListResponse {
  total: number;
  page: number;
  page_size: number;
  patients: Patient[];
}

export interface VitalReading {
  id: number;
  patient_id: number;
  timestamp: string;
  hr: number;
  sbp: number;
  dbp: number;
}

export interface VitalsSeriesResponse {
  patient_id: number;
  count: number;
  data: VitalReading[];
}

export interface ForecastTrajectory {
  heart_rate: number[];
  systolic_bp: number[];
  diastolic_bp: number[];
}

export interface ForecastResponse {
  patient_id: number;
  horizon_minutes: number;
  confidence_level: number;
  forecast_timestamps: string[];
  features: string[];
  mean: ForecastTrajectory;
  lower_90: ForecastTrajectory;
  upper_90: ForecastTrajectory;
  alert_predicted: boolean;
  predicted_alerts: string[];
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Alert {
  id: number;
  patient_id: number;
  type: string;
  severity: AlertSeverity;
  message: string;
  predicted: boolean;
  created_at: string;
  acknowledged_by?: number | null;
  resolved: boolean;
  resolved_at?: string | null;
}

export interface AlertListResponse {
  total: number;
  unresolved_count: number;
  critical_count: number;
  alerts: Alert[];
}

export interface VitalsStat {
  mean: number;
  min: number;
  max: number;
}

export interface DailyAlertCount {
  date: string;
  count: number;
  critical: number;
}

export interface AnalyticsSummary {
  total_patients: number;
  active_monitoring_patients: number;
  total_alerts_24h: number;
  critical_alerts_unresolved: number;
  averages_24h: {
    heart_rate: VitalsStat;
    systolic_bp: VitalsStat;
    diastolic_bp: VitalsStat;
  };
  alerts_over_time: DailyAlertCount[];
}

export interface Note {
  id: number;
  patient_id: number;
  author_id: number;
  author_name: string;
  content: string;
  created_at: string;
}

export interface ModelFeatureMetrics {
  mae: number;
  rmse: number;
}

export interface ModelBenchmarkItem {
  model_name: string;
  overall_mae: number;
  overall_rmse: number;
  features: {
    heart_rate: ModelFeatureMetrics;
    systolic_bp: ModelFeatureMetrics;
    diastolic_bp: ModelFeatureMetrics;
  };
  step_1_mae?: { heart_rate: number; systolic_bp: number; diastolic_bp: number };
  step_12_mae?: { heart_rate: number; systolic_bp: number; diastolic_bp: number };
}

export interface ModelMetricsResponse {
  timestamp: string;
  lookback_minutes: number;
  horizon_steps: number;
  cohort_summary: {
    total_patients: number;
    train_patients: number;
    val_patients: number;
    test_patients: number;
    train_windows: number;
    test_windows: number;
  };
  models: ModelBenchmarkItem[];
  plots?: Record<string, string>;
}

export interface ModelInfoResponse {
  version: string;
  architecture: string;
  lookback_minutes: number;
  horizon_steps: number;
  features: string[];
  trained_at: string;
  active: boolean;
  metrics?: Record<string, any>;
}

export interface RetrainStatusResponse {
  job_id: string;
  task_id: string;
  status: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
  current_epoch: number;
  total_epochs: number;
  current_loss?: number;
  started_at: string;
  completed_at?: string | null;
  message: string;
}

export interface WebSocketTelemetry {
  event: string;
  patient_id: number;
  timestamp: string;
  heart_rate: number;
  systolic_bp: number;
  diastolic_bp: number;
  alerts_triggered: {
    id: number;
    type: string;
    severity: string;
    message: string;
  }[];
}

export interface BackendHealth {
  status: 'OK' | 'DEGRADED' | 'DOWN';
  version: string;
  timestamp: string;
  database: string;
  environment: string;
  message?: string;
}
