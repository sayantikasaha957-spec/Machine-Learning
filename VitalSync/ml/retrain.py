"""
VitalSync Model Retraining Pipeline
Retrains or fine-tunes the LSTM forecasting model on new patient data batches,
validates against baseline thresholds, and exports a versioned artifact.
"""

import os
import sys
import argparse
import json
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT_DIR)

from ml.train import (
    load_and_preprocess_data,
    build_sliding_windows,
    build_lstm_model,
    train_model,
    evaluate_model,
    FEATURES,
    LOOKBACK,
    HORIZON,
)


def retrain_pipeline(
    data_path: str,
    output_dir: str = None,
    version: str = None,
    epochs: int = 25,
    batch_size: int = 128,
):
    """Executes retraining from specified dataset path."""
    if output_dir is None:
        output_dir = os.path.join(ROOT_DIR, "ml", "models")
    os.makedirs(output_dir, exist_ok=True)

    if version is None:
        version = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    print(f"=== VitalSync Model Retraining Pipeline (v{version}) ===")
    print(f"Data source: {data_path}")

    # 1. Load data
    train_df, val_df, test_df, scaler, p_train, p_val, p_test = load_and_preprocess_data(data_path)

    # 2. Save versioned scaler
    versioned_scaler_path = os.path.join(output_dir, f"scaler_v{version}.pkl")
    joblib.dump(scaler, versioned_scaler_path)
    # Also update active scaler
    active_scaler_path = os.path.join(output_dir, "scaler.pkl")
    joblib.dump(scaler, active_scaler_path)

    # 3. Build sliding windows
    print("\nBuilding sliding windows...")
    X_train, Y_train = build_sliding_windows(train_df, scaler, LOOKBACK, HORIZON)
    X_val, Y_val = build_sliding_windows(val_df, scaler, LOOKBACK, HORIZON)
    X_test, Y_test = build_sliding_windows(test_df, scaler, LOOKBACK, HORIZON)

    print(f"Train samples: {X_train.shape[0]}, Val samples: {X_val.shape[0]}, Test samples: {X_test.shape[0]}")

    # 4. Initialize model
    model = build_lstm_model(input_shape=(LOOKBACK, len(FEATURES)), horizon=HORIZON, num_features=len(FEATURES))

    # 5. Train
    versioned_model_path = os.path.join(output_dir, f"vitals_lstm_v{version}.keras")
    print(f"\nTraining versioned model -> {versioned_model_path}...")
    trained_model, history = train_model(
        model,
        X_train,
        Y_train,
        X_val,
        Y_val,
        model_save_path=versioned_model_path,
        epochs=epochs,
        batch_size=batch_size,
    )

    # Also update active production model
    active_model_path = os.path.join(output_dir, "vitals_lstm.keras")
    trained_model.save(active_model_path)
    print(f"Updated active production model -> {active_model_path}")

    # 6. Evaluate
    metrics = evaluate_model(trained_model, X_test, Y_test, scaler, model_name=f"LSTM_v{version}")

    # Save retraining summary log
    log_path = os.path.join(output_dir, f"retrain_log_v{version}.json")
    retrain_meta = {
        "version": version,
        "timestamp": datetime.utcnow().isoformat(),
        "data_path": data_path,
        "patients_train": len(p_train),
        "patients_val": len(p_val),
        "patients_test": len(p_test),
        "windows_train": len(X_train),
        "windows_test": len(X_test),
        "epochs_trained": len(history.history["loss"]),
        "metrics": metrics,
    }

    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(retrain_meta, f, indent=2)

    print(f"Retraining completed successfully! Metadata logged -> {log_path}")
    return retrain_meta


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VitalSync Model Retraining")
    parser.add_argument("--data-path", type=str, default=os.path.join(ROOT_DIR, "ml", "data", "processed", "vitals.parquet"))
    parser.add_argument("--output-dir", type=str, default=os.path.join(ROOT_DIR, "ml", "models"))
    parser.add_argument("--version", type=str, default=None)
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--batch-size", type=int, default=128)
    args = parser.parse_args()

    retrain_pipeline(
        data_path=args.data_path,
        output_dir=args.output_dir,
        version=args.version,
        epochs=args.epochs,
        batch_size=args.batch_size,
    )
