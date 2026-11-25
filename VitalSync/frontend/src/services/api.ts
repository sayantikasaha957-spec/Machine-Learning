import {
  AuthToken,
  User,
  Patient,
  PatientListResponse,
  VitalsSeriesResponse,
  ForecastResponse,
  AlertListResponse,
  Alert,
  AnalyticsSummary,
  Note,
  ModelInfoResponse,
  ModelMetricsResponse,
  RetrainStatusResponse,
  BackendHealth,
} from '../types';

const BASE_URL = '/api/v1';

class ApiClient {
  private getToken(): string | null {
    return localStorage.getItem('vitalsync_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (res.status === 401) {
      // Don't auto-redirect if checking auth or on login page
      if (!endpoint.includes('/auth/login') && !endpoint.includes('/auth/me')) {
        localStorage.removeItem('vitalsync_token');
        localStorage.removeItem('vitalsync_user');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    }

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData.detail) {
          errorMessage = typeof errorData.detail === 'string'
            ? errorData.detail
            : JSON.stringify(errorData.detail);
        }
      } catch {
        // Fallback to text
      }
      throw new Error(errorMessage);
    }

    if (res.status === 204) {
      return null as unknown as T;
    }

    return res.json() as Promise<T>;
  }

  // --- Auth ---
  async login(credentials: { email: string; password: string }): Promise<AuthToken> {
    const res = await fetch(`${BASE_URL}/auth/login/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Authentication failed. Please verify credentials.');
    }

    const data: AuthToken = await res.json();
    localStorage.setItem('vitalsync_token', data.access_token);
    localStorage.setItem('vitalsync_user', JSON.stringify({
      id: data.user_id,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
    }));
    return data;
  }

  async register(data: { email: string; password: string; full_name: string; role: string }): Promise<User> {
    return this.request<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('vitalsync_token');
      localStorage.removeItem('vitalsync_user');
    }
  }

  // --- Patients ---
  async getPatients(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    sortBy?: string;
    sortDesc?: boolean;
  } = {}): Promise<PatientListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.pageSize) query.append('page_size', params.pageSize.toString());
    if (params.search) query.append('search', params.search);
    if (params.status && params.status !== 'all') query.append('status', params.status);

    const qs = query.toString();
    return this.request<PatientListResponse>(`/patients${qs ? `?${qs}` : ''}`);
  }

  async getPatient(id: number): Promise<Patient> {
    return this.request<Patient>(`/patients/${id}`);
  }

  async createPatient(data: Partial<Patient>): Promise<Patient> {
    return this.request<Patient>('/patients', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePatient(id: number, data: Partial<Patient>): Promise<Patient> {
    return this.request<Patient>(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePatient(id: number): Promise<void> {
    return this.request<void>(`/patients/${id}`, { method: 'DELETE' });
  }

  // --- Vitals & Forecasting ---
  async getVitals(patientId: number, options: { from?: string; to?: string; limit?: number } = {}): Promise<VitalsSeriesResponse> {
    const query = new URLSearchParams();
    if (options.from) query.append('from', options.from);
    if (options.to) query.append('to', options.to);
    if (options.limit) query.append('limit', options.limit.toString());

    const qs = query.toString();
    return this.request<VitalsSeriesResponse>(`/patients/${patientId}/vitals${qs ? `?${qs}` : ''}`);
  }

  async getForecast(patientId: number, horizon = 12): Promise<ForecastResponse> {
    return this.request<ForecastResponse>(`/patients/${patientId}/forecast?horizon=${horizon}`);
  }

  // --- Alerts ---
  async getAlerts(params: {
    patientId?: number;
    severity?: string;
    resolved?: boolean;
    predicted?: boolean;
    limit?: number;
  } = {}): Promise<AlertListResponse> {
    const query = new URLSearchParams();
    if (params.patientId) query.append('patient_id', params.patientId.toString());
    if (params.severity && params.severity !== 'all') query.append('severity', params.severity);
    if (params.resolved !== undefined) query.append('resolved', params.resolved.toString());
    if (params.predicted !== undefined) query.append('predicted', params.predicted.toString());
    if (params.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    return this.request<AlertListResponse>(`/alerts${qs ? `?${qs}` : ''}`);
  }

  async acknowledgeAlert(alertId: number): Promise<Alert> {
    return this.request<Alert>(`/alerts/${alertId}/acknowledge`, { method: 'POST' });
  }

  async resolveAlert(alertId: number): Promise<Alert> {
    return this.request<Alert>(`/alerts/${alertId}/resolve`, { method: 'POST' });
  }

  // --- Analytics ---
  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.request<AnalyticsSummary>('/analytics/summary');
  }

  // --- Reports Export ---
  getReportExportUrl(patientId: number, format: 'csv' | 'pdf'): string {
    return `${BASE_URL}/reports/patient/${patientId}/export?format=${format}`;
  }

  async downloadReport(patientId: number, format: 'csv' | 'pdf'): Promise<void> {
    const token = this.getToken();
    const url = this.getReportExportUrl(patientId, format);
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      throw new Error(`Failed to export report: ${res.statusText}`);
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `VitalSync_Patient_${patientId}_Report.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);
  }

  // --- Model Insights & Retraining ---
  async getModelInfo(): Promise<ModelInfoResponse> {
    return this.request<ModelInfoResponse>('/model/info');
  }

  async getModelMetrics(): Promise<ModelMetricsResponse> {
    return this.request<ModelMetricsResponse>('/model/metrics');
  }

  async triggerRetrain(options: { epochs?: number; batch_size?: number; data_path?: string } = {}): Promise<RetrainStatusResponse> {
    return this.request<RetrainStatusResponse>('/model/retrain', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getRetrainStatus(): Promise<RetrainStatusResponse> {
    return this.request<RetrainStatusResponse>('/model/retrain/status');
  }

  // --- Clinical Notes ---
  async getPatientNotes(patientId: number): Promise<Note[]> {
    return this.request<Note[]>(`/patients/${patientId}/notes`);
  }

  async createPatientNote(patientId: number, content: string): Promise<Note> {
    return this.request<Note>(`/patients/${patientId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // --- Root Health Check ---
  async checkHealth(): Promise<BackendHealth> {
    const res = await fetch('/health');
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  }
}

export const api = new ApiClient();
