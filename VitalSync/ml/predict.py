"""
VitalSync Inference & Uncertainty Quantification Module
Implements Monte Carlo Dropout (30 stochastic forward passes) to generate
12-step physiological forecasts with 90% empirical confidence intervals.
"""

import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta

# Silence TensorFlow logging
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH = os.path.join(ROOT_DIR, "ml", "models", "vitals_lstm.keras")
SCALER_PATH = os.path.join(ROOT_DIR, "ml", "models", "scaler.pkl")
FEATURES = ["heart_rate", "systolic_bp", "diastolic_bp"]
LOOKBACK = 60
HORIZON = 12

_MODEL = None
_SCALER = None


def get_model_and_scaler(model_path: str = MODEL_PATH, scaler_path: str = SCALER_PATH):
    """Lazy-load and cache the trained LSTM model and scaler."""
    global _MODEL, _SCALER
    if _MODEL is None:
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Train the model first via ml/train.py.")
        _MODEL = tf.keras.models.load_model(model_path, compile=False)

    if _SCALER is None:
        if not os.path.exists(scaler_path):
            raise FileNotFoundError(f"Scaler file not found at {scaler_path}. Train the model first via ml/train.py.")
        _SCALER = joblib.load(scaler_path)

    return _MODEL, _SCALER


def forecast(
    recent_readings,
    n_passes: int = 30,
    confidence: float = 0.90,
    model_path: str = MODEL_PATH,
    scaler_path: str = SCALER_PATH,
) -> dict:
    """
    Generate multi-step physiological forecast with Monte Carlo Dropout uncertainty estimation.

    Parameters:
    - recent_readings: pandas DataFrame or numpy array of shape (60, 3) with columns
      [heart_rate, systolic_bp, diastolic_bp] representing the most recent 60 minutes.
    - n_passes: Number of stochastic forward passes with dropout enabled (default: 30).
    - confidence: Confidence interval width (default: 0.90 for 90% CI: [5th, 95th] percentiles).

    Returns:
    dict with keys:
      - 'timestamps': list of predicted ISO timestamp strings for next 12 minutes
      - 'features': ['heart_rate', 'systolic_bp', 'diastolic_bp']
      - 'mean': dict of feature arrays with expected trajectories
      - 'lower': dict of feature arrays with lower confidence bound (5th percentile)
      - 'upper': dict of feature arrays with upper confidence bound (95th percentile)
      - 'std': dict of feature arrays with standard deviation across passes
    """
    model, scaler = get_model_and_scaler(model_path, scaler_path)

    # 1. Parse and validate input shape
    last_timestamp = datetime.utcnow()
    if isinstance(recent_readings, pd.DataFrame):
        if "timestamp" in recent_readings.columns:
            last_timestamp = pd.to_datetime(recent_readings["timestamp"].iloc[-1])
        raw_values = recent_readings[FEATURES].values
    elif isinstance(recent_readings, np.ndarray):
        raw_values = recent_readings
    else:
        raise ValueError("recent_readings must be a pandas DataFrame or numpy array.")

    if raw_values.shape[0] < LOOKBACK or raw_values.shape[1] != len(FEATURES):
        raise ValueError(f"recent_readings must have shape (>= {LOOKBACK}, {len(FEATURES)}), got {raw_values.shape}.")

    # Use the last LOOKBACK records
    window_raw = raw_values[-LOOKBACK:]

    # 2. Scale features using fitted training scaler
    window_scaled = scaler.transform(window_raw)
    x_input = np.expand_dims(window_scaled, axis=0).astype(np.float32)  # shape (1, 60, 3)

    # 3. Monte Carlo Dropout forward passes (Batched execution)
    # Replicate window across batch dimension to perform all stochastic passes in a single graph execution
    x_batched = np.repeat(x_input, n_passes, axis=0)  # shape (n_passes, 60, 3)
    predictions_scaled = model(x_batched, training=True).numpy()  # shape (n_passes, 12, 3)

    # 4. Inverse-transform each pass back to real physiological units (BPM, mmHg)
    predictions_real = np.zeros_like(predictions_scaled)
    for p in range(n_passes):
        predictions_real[p] = scaler.inverse_transform(predictions_scaled[p])

    # 5. Compute statistics across MC passes
    mean_preds = np.mean(predictions_real, axis=0)  # shape (12, 3)
    std_preds = np.std(predictions_real, axis=0)    # shape (12, 3)

    alpha = (1.0 - confidence) / 2.0
    lower_percentile = alpha * 100.0
    upper_percentile = (1.0 - alpha) * 100.0

    lower_preds = np.percentile(predictions_real, lower_percentile, axis=0)  # shape (12, 3)
    upper_preds = np.percentile(predictions_real, upper_percentile, axis=0)  # shape (12, 3)

    # Future timestamps (1-minute steps)
    future_timestamps = [
        (last_timestamp + timedelta(minutes=step + 1)).isoformat()
        for step in range(HORIZON)
    ]

    result = {
        "timestamps": future_timestamps,
        "features": FEATURES,
        "horizon_steps": HORIZON,
        "n_passes": n_passes,
        "confidence": confidence,
        "mean": {feat: np.round(mean_preds[:, i], 1).tolist() for i, feat in enumerate(FEATURES)},
        "lower": {feat: np.round(lower_preds[:, i], 1).tolist() for i, feat in enumerate(FEATURES)},
        "upper": {feat: np.round(upper_preds[:, i], 1).tolist() for i, feat in enumerate(FEATURES)},
        "std": {feat: np.round(std_preds[:, i], 2).tolist() for i, feat in enumerate(FEATURES)},
    }

    return result


def main():
    """Demonstrates inference with a sample window from processed vitals."""
    print("=== VitalSync LSTM Inference & Uncertainty Verification ===")
    data_path = os.path.join(ROOT_DIR, "ml", "data", "processed", "vitals.parquet")
    if not os.path.exists(data_path):
        print(f"Data file not found at {data_path}.")
        return

    df = pd.read_parquet(data_path)
    sample_patient = df["patient_id"].unique()[0]
    sample_df = df[df["patient_id"] == sample_patient].iloc[:LOOKBACK]
    print(f"Testing forecast on Patient: {sample_patient} (60-minute lookback window)...")

    res = forecast(sample_df, n_passes=30, confidence=0.90)

    print("\n--- 12-Minute Physiological Forecast Results ---")
    print(f"{'Step':<5} | {'Timestamp':<20} | {'HR (90% CI)':<20} | {'SBP (90% CI)':<20} | {'DBP (90% CI)':<20}")
    print("-" * 92)

    for step in range(HORIZON):
        t_str = res["timestamps"][step].split("T")[-1][:8]
        hr_str = f"{res['mean']['heart_rate'][step]:.1f} [{res['lower']['heart_rate'][step]:.1f} - {res['upper']['heart_rate'][step]:.1f}]"
        sbp_str = f"{res['mean']['systolic_bp'][step]:.1f} [{res['lower']['systolic_bp'][step]:.1f} - {res['upper']['systolic_bp'][step]:.1f}]"
        dbp_str = f"{res['mean']['diastolic_bp'][step]:.1f} [{res['lower']['diastolic_bp'][step]:.1f} - {res['upper']['diastolic_bp'][step]:.1f}]"
        print(f"t+{step+1:<3} | {t_str:<20} | {hr_str:<20} | {sbp_str:<20} | {dbp_str:<20}")

    print("\nInference verification passed successfully!")


if __name__ == "__main__":
    main()
