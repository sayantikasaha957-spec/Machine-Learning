# VitalSync Data Collection & Quality Report

**Generated Date**: 2026-11-23 17:56:53 UTC  
**Data Source**: VitalDB Open Dataset  
**Pipeline Target**: `/ml/data/processed/vitals.parquet`

---

## 1. Executive Summary

| Metric | Value |
| :--- | :--- |
| **Total Cohort Patients** | **217** |
| **Total 1-Minute Observations** | **61,745** |
| **Cohort Duration Span** | 2023-01-02 01:00:00 to 2023-12-30 07:49:00 |
| **Average Patient Monitoring Duration** | 4.74 hours (Min: 3.00h, Max: 12.45h) |
| **Missing Values in Processed Parquet** | **0 (0.00%)** |
| **Sampling Resolution** | Uniform 1-minute intervals (60s) |

---

## 2. Statistical Distributions

The cleaned physiological tracks adhere strictly to clinical bounds (HR: 20–250 bpm, SBP: 60–250 mmHg, DBP: 30–150 mmHg):

| Vital Sign | Unit | Mean ± Std | Median (IQR) | Min | Max | Missing (%) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Heart Rate** | bpm | 74.84 ± 16.70 | 73.0 (63.0 - 85.0) | 23.0 | 221.0 | 0.0% |
| **Systolic BP** | mmHg | 118.40 ± 21.90 | 116.0 (103.0 - 131.0) | 60.0 | 250.0 | 0.0% |
| **Diastolic BP** | mmHg | 63.01 ± 12.69 | 62.0 (54.0 - 70.0) | 30.0 | 149.0 | 0.0% |

---

## 3. Data Cleansing & Quality Control Pipeline

1. **Dual-Modality Blood Pressure Curation**:
   - Primary arterial line transducer recordings (`Solar8000/ART_SBP`, `ART_DBP`) prioritized for high-fidelity continuous tracking.
   - Non-invasive cuff readings (`Solar8000/NIBP_SBP`, `NIBP_DBP`) utilized as fallback when invasive transducers were detached or uncalibrated.
2. **Artifact & Sensor Disconnect Rejection**:
   - Negative pressure values and calibration spikes dropped.
   - Clinical plausibility windows applied: HR $\in [20, 250]$, SBP $\in [60, 250]$, DBP $\in [30, 150]$.
   - Pulse pressure validity checked ($	ext{SBP} > 	ext{DBP} + 5$).
3. **Temporal Standardization & Interpolation**:
   - Resampled to uniform 1-minute steps.
   - Brief telemetry dropouts ($\le 5$ minutes) filled via linear interpolation.
4. **Continuous Window Assurance**:
   - Patients filtered to ensure at least 3 hours (180 continuous 1-minute readings) of uninterrupted clinical vitals without NaN values.

---

## 4. Visualizations

### 4.1 Physiological Distributions
![Vital Signs Distribution](vitals_distribution.png)

### 4.2 Cross-Correlation Heatmap
![Vitals Correlation Heatmap](vitals_correlation_heatmap.png)

### 4.3 Multi-Patient Trajectory Samples
![Sample Patient Trajectories](sample_patient_trajectories.png)

### 4.4 Patient Monitoring Durations
![Patient Duration Distribution](patient_duration_distribution.png)
