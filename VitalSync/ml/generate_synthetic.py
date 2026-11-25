"""
VitalSync Synthetic Patient Vitals Generator (Fallback & Simulation Module)

Produces high-fidelity synthetic physiological time-series data:
- 300 patients x 7 days (1-minute intervals = 10,080 minutes/patient)
- 24-hour circadian rhythms
- Heterogeneous per-patient physiological baselines
- Mean-reverting random walk (Ornstein-Uhlenbeck process)
- Sensor measurement noise
- Transient spikes (5-15 min tachycardia, sudden hypertensive spikes)
- Sustained abnormal episodes (30-180 min hypotension/shock, acute hypertensive crisis)
- Strict clinical plausibility boundaries (no impossible values, no NaNs)
"""

import os
import argparse
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

DATA_PROCESSED_DIR = os.path.join(os.path.dirname(__file__), "data", "processed")


def generate_single_patient(
    patient_id: str,
    days: int = 7,
    interval_minutes: int = 1,
    start_time: datetime = None,
    seed: int = None,
) -> pd.DataFrame:
    """Generate 1-minute vitals for a single patient over specified days."""
    if seed is not None:
        np.random.seed(seed)

    if start_time is None:
        start_time = datetime(2024, 1, 1, 0, 0, 0)

    n_points = int((days * 24 * 60) / interval_minutes)
    timestamps = [start_time + timedelta(minutes=i * interval_minutes) for i in range(n_points)]

    # 1. Per-patient baselines (heterogeneous healthy/at-risk distributions)
    baseline_hr = np.random.normal(72, 8)
    baseline_sbp = np.random.normal(120, 10)
    # DBP physiologically constrained below SBP (pulse pressure ~35-50)
    baseline_dbp = baseline_sbp - np.random.uniform(35, 48)

    # 2. 24-hour Circadian Cycle (peaks in late afternoon, troughs at ~4 AM)
    # Minutes from midnight
    t_minutes = np.arange(n_points) * interval_minutes
    circadian_phase = (t_minutes % 1440) / 1440.0 * 2 * np.pi - (4 / 24 * 2 * np.pi)
    circadian_hr = 5.0 * np.sin(circadian_phase)
    circadian_sbp = 6.0 * np.sin(circadian_phase)
    circadian_dbp = 3.5 * np.sin(circadian_phase)

    # 3. Mean-reverting Ornstein-Uhlenbeck random walk (physiological autoregression)
    theta = 0.05  # Reversion speed
    sigma_hr, sigma_sbp, sigma_dbp = 1.0, 1.2, 0.8

    rw_hr = np.zeros(n_points)
    rw_sbp = np.zeros(n_points)
    rw_dbp = np.zeros(n_points)

    for t in range(1, n_points):
        rw_hr[t] = rw_hr[t - 1] - theta * rw_hr[t - 1] + np.random.normal(0, sigma_hr)
        rw_sbp[t] = rw_sbp[t - 1] - theta * rw_sbp[t - 1] + np.random.normal(0, sigma_sbp)
        rw_dbp[t] = rw_dbp[t - 1] - theta * rw_dbp[t - 1] + np.random.normal(0, sigma_dbp)

    # 4. High-frequency measurement noise
    noise_hr = np.random.normal(0, 1.2, n_points)
    noise_sbp = np.random.normal(0, 1.8, n_points)
    noise_dbp = np.random.normal(0, 1.2, n_points)

    hr = baseline_hr + circadian_hr + rw_hr + noise_hr
    sbp = baseline_sbp + circadian_sbp + rw_sbp + noise_sbp
    dbp = baseline_dbp + circadian_dbp + rw_dbp + noise_dbp

    # 5. Occasional transient spikes (3-8 sudden spikes per 7-day period)
    n_spikes = np.random.randint(3, 9)
    for _ in range(n_spikes):
        spike_idx = np.random.randint(60, n_points - 60)
        spike_dur = np.random.randint(5, 16)
        spike_type = np.random.choice(["tachycardia", "hypertensive"])
        if spike_type == "tachycardia":
            hr[spike_idx : spike_idx + spike_dur] += np.random.uniform(25, 45)
        else:
            sbp[spike_idx : spike_idx + spike_dur] += np.random.uniform(20, 35)
            dbp[spike_idx : spike_idx + spike_dur] += np.random.uniform(10, 20)

    # 6. Sustained abnormal episodes (1-3 episodes per patient: hypotension, sepsis-like tachycardia, hypertension)
    n_episodes = np.random.randint(1, 4)
    for _ in range(n_episodes):
        ep_idx = np.random.randint(120, n_points - 180)
        ep_dur = np.random.randint(30, 150)
        ep_type = np.random.choice(["hypotension", "hypertension", "arrhythmic_tachycardia"])
        
        # Smooth window for entry and resolution
        t_win = np.sin(np.linspace(0, np.pi, ep_dur))
        if ep_type == "hypotension":
            sbp[ep_idx : ep_idx + ep_dur] -= 25 * t_win
            dbp[ep_idx : ep_idx + ep_dur] -= 18 * t_win
            hr[ep_idx : ep_idx + ep_dur] += 15 * t_win  # Reflex compensatory tachycardia
        elif ep_type == "hypertension":
            sbp[ep_idx : ep_idx + ep_dur] += 30 * t_win
            dbp[ep_idx : ep_idx + ep_dur] += 18 * t_win
        elif ep_type == "arrhythmic_tachycardia":
            hr[ep_idx : ep_idx + ep_dur] += 40 * t_win

    # 7. Physiological boundary enforcement (within 20-250 HR, 60-250 SBP, 30-150 DBP)
    hr = np.clip(np.round(hr, 1), 25.0, 240.0)
    sbp = np.clip(np.round(sbp, 1), 65.0, 240.0)
    dbp = np.clip(np.round(dbp, 1), 35.0, 140.0)
    
    # Ensure SBP strictly exceeds DBP by at least 15 mmHg
    dbp = np.minimum(dbp, sbp - 15.0)

    df = pd.DataFrame({
        "patient_id": patient_id,
        "timestamp": timestamps,
        "heart_rate": hr,
        "systolic_bp": sbp,
        "diastolic_bp": dbp,
    })

    return df


def generate_synthetic_cohort(
    num_patients: int = 300,
    days: int = 7,
    output_path: str = None,
    seed: int = 42,
) -> pd.DataFrame:
    """Generates cohort of synthetic patients."""
    print(f"[VitalSync Synthetic] Generating cohort: {num_patients} patients x {days} days...")
    np.random.seed(seed)
    
    records = []
    base_time = datetime(2024, 1, 1, 0, 0, 0)
    
    for i in range(num_patients):
        pid = f"SYNTH-{i + 1:04d}"
        p_seed = seed + i * 17
        df_p = generate_single_patient(
            patient_id=pid,
            days=days,
            start_time=base_time,
            seed=p_seed,
        )
        records.append(df_p)
        if (i + 1) % 50 == 0:
            print(f"  Generated {i + 1}/{num_patients} patients...")

    full_df = pd.concat(records, ignore_index=True)
    print(f"[VitalSync Synthetic] Cohort generated: {len(full_df)} total rows.")

    if output_path:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        full_df.to_parquet(output_path, index=False)
        print(f"[VitalSync Synthetic] Saved synthetic vitals -> {output_path}")

        # If saving as the primary vitals.parquet, update SOURCE.txt
        if os.path.basename(output_path) == "vitals.parquet":
            source_txt_path = os.path.join(os.path.dirname(output_path), "SOURCE.txt")
            with open(source_txt_path, "w", encoding="utf-8") as f:
                f.write(
                    "DATA SOURCE: SYNTHETIC VITAL SIGNS (FALLBACK MODE)\n"
                    f"Generated at: {datetime.utcnow().isoformat()}Z\n"
                    f"Patients: {num_patients}\n"
                    f"Duration: {days} days (1-minute intervals)\n"
                    f"Total Records: {len(full_df)}\n"
                    "Physiological Features:\n"
                    "  - Heterogeneous patient baselines (Normal distribution)\n"
                    "  - 24-hour sinusoidal circadian rhythm\n"
                    "  - Autoregressive Ornstein-Uhlenbeck drift\n"
                    "  - Gaussian measurement noise\n"
                    "  - Transient spikes (tachycardia & hypertensive surges)\n"
                    "  - Sustained abnormal episodes (hypotension, arrhythmia, hypertension)\n"
                    "  - Zero missing values, strictly physiologically bounded\n"
                )
            print(f"[VitalSync Synthetic] Updated {source_txt_path}")

    return full_df


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VitalSync Synthetic Dataset Generator")
    parser.add_argument("--patients", type=int, default=300, help="Number of patients (default: 300)")
    parser.add_argument("--days", type=int, default=7, help="Days per patient (default: 7)")
    parser.add_argument("--out", type=str, default=os.path.join(DATA_PROCESSED_DIR, "vitals_synthetic.parquet"), help="Output parquet path")
    args = parser.parse_args()

    generate_synthetic_cohort(num_patients=args.patients, days=args.days, output_path=args.out)
