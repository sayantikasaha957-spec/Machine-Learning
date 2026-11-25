"""
VitalSync LSTM Training & Baseline Benchmarking Pipeline

Tasks executed:
- Patient-level split: 70% Train, 15% Validation, 15% Test (Zero cross-subject leakage)
- Feature scaling: StandardScaler fitted on training patients only, saved to /ml/models/scaler.pkl
- Sliding window generator: Lookback = 60 min, Horizon = 12 steps, 3 features (HR, SBP, DBP)
- Architectures trained & compared:
    1. Baseline "Last Value" (Naive Persistence)
    2. Baseline "Moving Average" (15-min rolling mean)
    3. Primary Stacked LSTM: LSTM(128) -> Dropout(0.2) -> LSTM(64) -> Dropout(0.2) -> Dense(36) -> Reshape((12, 3))
    4. Alternative Recurrent: Stacked GRU: GRU(128) -> Dropout(0.2) -> GRU(64) -> Dropout(0.2) -> Dense(36) -> Reshape((12, 3))
- Real-unit evaluation (BPM, mmHg): MAE and RMSE per feature and per step (1 to 12)
- Exports:
    - Best model -> /ml/models/vitals_lstm.keras
    - Metrics -> /ml/reports/metrics.json
    - Training curves & evaluation plots -> /ml/reports/
"""

import os
import sys
import json
import time
import argparse
import joblib
import numpy as np
import pandas as pd
from datetime import datetime

# Configure backend and warnings
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, GRU, Dense, Dropout, Reshape, Input
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau, ModelCheckpoint
from sklearn.preprocessing import StandardScaler

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_PATH = os.path.join(ROOT_DIR, "ml", "data", "processed", "vitals.parquet")
MODELS_DIR = os.path.join(ROOT_DIR, "ml", "models")
REPORTS_DIR = os.path.join(ROOT_DIR, "ml", "reports")

FEATURES = ["heart_rate", "systolic_bp", "diastolic_bp"]
LOOKBACK = 60
HORIZON = 12


def load_and_preprocess_data(data_path: str = DATA_PATH, seed: int = 42):
    """
    Loads processed dataset and performs strict patient-level split (70/15/15).
    Fits StandardScaler on train set only.
    """
    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Processed vitals dataset not found at {data_path}.")

    df = pd.read_parquet(data_path)
    patient_ids = np.array(sorted(df["patient_id"].unique()))
    rng = np.random.RandomState(seed)
    rng.shuffle(patient_ids)

    n_total = len(patient_ids)
    n_train = int(n_total * 0.70)
    n_val = int(n_total * 0.15)

    train_pids = set(patient_ids[:n_train])
    val_pids = set(patient_ids[n_train : n_train + n_val])
    test_pids = set(patient_ids[n_train + n_val :])

    train_df = df[df["patient_id"].isin(train_pids)].copy()
    val_df = df[df["patient_id"].isin(val_pids)].copy()
    test_df = df[df["patient_id"].isin(test_pids)].copy()

    print(f"Cohort Split: {len(train_pids)} Train, {len(val_pids)} Val, {len(test_pids)} Test patients.")
    print(f"Rows: {len(train_df):,} Train, {len(val_df):,} Val, {len(test_df):,} Test observations.")

    # Fit scaler on TRAIN ONLY
    scaler = StandardScaler()
    scaler.fit(train_df[FEATURES].values)

    return train_df, val_df, test_df, scaler, train_pids, val_pids, test_pids


def build_sliding_windows(df: pd.DataFrame, scaler: StandardScaler, lookback: int = 60, horizon: int = 12):
    """
    Extracts sliding windows (X: (N, lookback, 3), Y: (N, horizon, 3)) strictly per patient.
    Zero cross-patient leakage.
    """
    X_list, Y_list = [], []
    total_window = lookback + horizon

    for _, group in df.groupby("patient_id"):
        raw_vals = group[FEATURES].values
        if len(raw_vals) < total_window:
            continue
        # Scale features
        scaled_vals = scaler.transform(raw_vals).astype(np.float32)

        for i in range(len(scaled_vals) - total_window + 1):
            X_list.append(scaled_vals[i : i + lookback])
            Y_list.append(scaled_vals[i + lookback : i + total_window])

    X = np.array(X_list, dtype=np.float32)
    Y = np.array(Y_list, dtype=np.float32)
    return X, Y


def build_lstm_model(input_shape=(60, 3), horizon=12, num_features=3):
    """
    Primary Stacked LSTM architecture:
    LSTM(128, return_sequences=True) -> Dropout(0.2) -> LSTM(64) -> Dropout(0.2) ->
    Dense(horizon * num_features) -> Reshape((horizon, num_features))
    """
    model = Sequential([
        Input(shape=input_shape),
        LSTM(128, return_sequences=True, name="lstm_1"),
        Dropout(0.2, name="dropout_1"),
        LSTM(64, return_sequences=False, name="lstm_2"),
        Dropout(0.2, name="dropout_2"),
        Dense(horizon * num_features, activation="linear", name="dense_proj"),
        Reshape((horizon, num_features), name="output_horizon"),
    ], name="VitalSync_LSTM")

    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3), loss="mse", metrics=["mae"])
    return model


def build_gru_model(input_shape=(60, 3), horizon=12, num_features=3):
    """Alternative Recurrent Model: Stacked Gated Recurrent Unit (GRU)."""
    model = Sequential([
        Input(shape=input_shape),
        GRU(128, return_sequences=True, name="gru_1"),
        Dropout(0.2, name="dropout_1"),
        GRU(64, return_sequences=False, name="gru_2"),
        Dropout(0.2, name="dropout_2"),
        Dense(horizon * num_features, activation="linear", name="dense_proj"),
        Reshape((horizon, num_features), name="output_horizon"),
    ], name="VitalSync_GRU")

    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3), loss="mse", metrics=["mae"])
    return model


def evaluate_baseline_last_value(X_test: np.ndarray, Y_test: np.ndarray, scaler: StandardScaler):
    """
    Persistence / Last Value baseline:
    Predicts the last observed reading X[t, -1, :] for all 12 forward steps.
    """
    N, lookback, F = X_test.shape
    horizon = Y_test.shape[1]

    # Last observed value replicated across all horizon steps
    last_val = X_test[:, -1:, :]  # shape (N, 1, F)
    preds_scaled = np.repeat(last_val, horizon, axis=1)  # shape (N, horizon, F)

    # Invert to real units
    preds_real = np.zeros_like(preds_scaled)
    actual_real = np.zeros_like(Y_test)

    for i in range(horizon):
        preds_real[:, i, :] = scaler.inverse_transform(preds_scaled[:, i, :])
        actual_real[:, i, :] = scaler.inverse_transform(Y_test[:, i, :])

    return compute_metrics_dict(actual_real, preds_real, model_name="Last Value (Persistence)")


def evaluate_baseline_moving_avg(X_test: np.ndarray, Y_test: np.ndarray, scaler: StandardScaler, window_len: int = 15):
    """
    Moving Average baseline:
    Predicts the mean of the last `window_len` minutes (default: 15 min) for all forward steps.
    """
    horizon = Y_test.shape[1]
    ma_val = np.mean(X_test[:, -window_len:, :], axis=1, keepdims=True)  # shape (N, 1, F)
    preds_scaled = np.repeat(ma_val, horizon, axis=1)

    preds_real = np.zeros_like(preds_scaled)
    actual_real = np.zeros_like(Y_test)

    for i in range(horizon):
        preds_real[:, i, :] = scaler.inverse_transform(preds_scaled[:, i, :])
        actual_real[:, i, :] = scaler.inverse_transform(Y_test[:, i, :])

    return compute_metrics_dict(actual_real, preds_real, model_name="Moving Average (15-min)")


def compute_metrics_dict(actual: np.ndarray, predicted: np.ndarray, model_name: str):
    """Computes overall, per-feature, and per-step MAE and RMSE in real physical units."""
    # actual, predicted: shape (N, horizon=12, features=3)
    errors = actual - predicted
    abs_errors = np.abs(errors)
    sq_errors = errors ** 2

    overall_mae = float(np.mean(abs_errors))
    overall_rmse = float(np.sqrt(np.mean(sq_errors)))

    feat_metrics = {}
    for i, feat in enumerate(FEATURES):
        feat_mae = float(np.mean(abs_errors[:, :, i]))
        feat_rmse = float(np.sqrt(np.mean(sq_errors[:, :, i])))
        feat_metrics[feat] = {"mae": round(feat_mae, 2), "rmse": round(feat_rmse, 2)}

    step_metrics = []
    for s in range(actual.shape[1]):
        step_dict = {"step": s + 1}
        step_mae_all = float(np.mean(abs_errors[:, s, :]))
        step_rmse_all = float(np.sqrt(np.mean(sq_errors[:, s, :])))
        step_dict["overall_mae"] = round(step_mae_all, 2)
        step_dict["overall_rmse"] = round(step_rmse_all, 2)

        for i, feat in enumerate(FEATURES):
            step_dict[f"{feat}_mae"] = round(float(np.mean(abs_errors[:, s, i])), 2)
            step_dict[f"{feat}_rmse"] = round(float(np.sqrt(np.mean(sq_errors[:, s, i]))), 2)
        step_metrics.append(step_dict)

    return {
        "model_name": model_name,
        "overall_mae": round(overall_mae, 2),
        "overall_rmse": round(overall_rmse, 2),
        "features": feat_metrics,
        "steps": step_metrics,
        "_actual": actual,
        "_predicted": predicted,
    }


def evaluate_model(model, X_test: np.ndarray, Y_test: np.ndarray, scaler: StandardScaler, model_name: str = "LSTM"):
    """Evaluates a trained neural network model on the test set in real physical units."""
    preds_scaled = model.predict(X_test, batch_size=256, verbose=0)
    horizon = Y_test.shape[1]

    preds_real = np.zeros_like(preds_scaled)
    actual_real = np.zeros_like(Y_test)

    for i in range(horizon):
        preds_real[:, i, :] = scaler.inverse_transform(preds_scaled[:, i, :])
        actual_real[:, i, :] = scaler.inverse_transform(Y_test[:, i, :])

    return compute_metrics_dict(actual_real, preds_real, model_name=model_name)


def train_model(model, X_train, Y_train, X_val, Y_val, model_save_path: str, epochs: int = 25, batch_size: int = 128):
    """Executes model training with early stopping, learning rate reduction, and checkpoints."""
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=6, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, min_lr=1e-5, verbose=1),
        ModelCheckpoint(filepath=model_save_path, monitor="val_loss", save_best_only=True, verbose=0),
    ]

    history = model.fit(
        X_train,
        Y_train,
        validation_data=(X_val, Y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )
    return model, history


def generate_evaluation_plots(histories: dict, model_results: list, X_test: np.ndarray, Y_test: np.ndarray, scaler: StandardScaler, best_model):
    """Generates and saves publication-quality evaluation plots in /ml/reports/."""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    sns.set_theme(style="whitegrid", palette="muted")
    plt.rcParams["font.sans-serif"] = "Inter, DejaVu Sans, Arial, sans-serif"

    # 1. Training & Validation Loss Curves
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    colors = {"LSTM": "#1FA89A", "GRU": "#4A7BD0"}

    for name, hist in histories.items():
        c = colors.get(name, "#E5484D")
        epochs = range(1, len(hist.history["loss"]) + 1)
        axes[0].plot(epochs, hist.history["loss"], label=f"{name} Train Loss", color=c, linewidth=2)
        axes[0].plot(epochs, hist.history["val_loss"], label=f"{name} Val Loss", color=c, linestyle="--", linewidth=2)

        axes[1].plot(epochs, hist.history["mae"], label=f"{name} Train MAE", color=c, linewidth=2)
        axes[1].plot(epochs, hist.history["val_mae"], label=f"{name} Val MAE", color=c, linestyle="--", linewidth=2)

    axes[0].set_title("Training & Validation Loss (MSE)", fontsize=12, fontweight="bold")
    axes[0].set_xlabel("Epoch")
    axes[0].set_ylabel("Loss (Scaled MSE)")
    axes[0].legend()

    axes[1].set_title("Training & Validation MAE", fontsize=12, fontweight="bold")
    axes[1].set_xlabel("Epoch")
    axes[1].set_ylabel("MAE (Scaled)")
    axes[1].legend()

    plt.tight_layout()
    loss_path = os.path.join(REPORTS_DIR, "training_loss_curves.png")
    plt.savefig(loss_path, dpi=200)
    plt.close()
    print(f"Saved loss curves -> {loss_path}")

    # 2. Per-Step MAE Comparison across Forecast Horizon (Steps 1 to 12)
    plt.figure(figsize=(10, 5.5))
    plot_colors = {"Last Value (Persistence)": "#94A3B8", "Moving Average (15-min)": "#F5A524", "LSTM": "#1FA89A", "GRU": "#4A7BD0"}
    steps = list(range(1, HORIZON + 1))

    for res in model_results:
        mname = res["model_name"]
        step_maes = [s["overall_mae"] for s in res["steps"]]
        c = plot_colors.get(mname, "#30A46C")
        ls = ":" if "Baseline" in mname or "Last" in mname or "Moving" in mname else "-"
        plt.plot(steps, step_maes, label=f"{mname} (Overall MAE: {res['overall_mae']:.2f})", color=c, linestyle=ls, linewidth=2.2, marker="o", markersize=4)

    plt.title("Forecast Horizon Degradation: Overall MAE per Step (t+1 to t+12)", fontsize=12, fontweight="bold")
    plt.xlabel("Forecast Step Ahead (Minutes)")
    plt.ylabel("Mean Absolute Error (Real Units)")
    plt.xticks(steps, [f"t+{s}m" for s in steps])
    plt.legend(frameon=True, facecolor="white")
    plt.tight_layout()
    step_plot_path = os.path.join(REPORTS_DIR, "forecast_eval_steps.png")
    plt.savefig(step_plot_path, dpi=200)
    plt.close()
    print(f"Saved per-step evaluation plot -> {step_plot_path}")

    # 3. Test Windows: Predicted vs Actual with Monte Carlo Dropout Uncertainty Bands
    fig, axes = plt.subplots(3, 1, figsize=(14, 11), sharex=False)
    sample_indices = [15, 120, 350]
    palette_feat = ["#1FA89A", "#4A7BD0", "#30A46C"]

    for ax_idx, (s_idx, feat) in enumerate(zip(sample_indices, FEATURES)):
        ax = axes[ax_idx]
        x_window_scaled = X_test[s_idx : s_idx + 1]  # shape (1, 60, 3)
        y_true_scaled = Y_test[s_idx : s_idx + 1]     # shape (1, 12, 3)

        # Invert lookback
        x_lookback_real = scaler.inverse_transform(x_window_scaled[0])
        y_true_real = scaler.inverse_transform(y_true_scaled[0])

        # MC Dropout inference (30 passes)
        mc_preds = []
        for _ in range(30):
            p = best_model(x_window_scaled, training=True).numpy()[0]
            mc_preds.append(scaler.inverse_transform(p))
        mc_preds = np.array(mc_preds)  # (30, 12, 3)

        mean_pred = np.mean(mc_preds, axis=0)[:, ax_idx]
        lower_bound = np.percentile(mc_preds, 5, axis=0)[:, ax_idx]
        upper_bound = np.percentile(mc_preds, 95, axis=0)[:, ax_idx]

        t_lookback = np.arange(-LOOKBACK + 1, 1)
        t_forecast = np.arange(1, HORIZON + 1)

        # Plot historical lookback
        ax.plot(t_lookback, x_lookback_real[:, ax_idx], label="Observed History (60m)", color="#64748B", linewidth=1.8)
        # Plot ground truth future
        ax.plot(t_forecast, y_true_real[:, ax_idx], label="Ground Truth Actual", color="#0F172A", linewidth=2.2, marker="s", markersize=4)
        # Plot predicted mean
        ax.plot(t_forecast, mean_pred, label="LSTM Forecast Mean", color=palette_feat[ax_idx], linewidth=2.2, marker="o", markersize=4)
        # Uncertainty band
        ax.fill_between(t_forecast, lower_bound, upper_bound, color=palette_feat[ax_idx], alpha=0.25, label="90% Confidence Interval (MC Dropout)")

        unit = "bpm" if feat == "heart_rate" else "mmHg"
        ax.set_title(f"12-Minute Forward Forecast with 90% Confidence Band: {feat.replace('_', ' ').title()} ({unit})", fontsize=11, fontweight="bold")
        ax.set_ylabel(f"{feat.replace('_', ' ').title()} ({unit})")
        ax.set_xlabel("Time (Minutes relative to forecast origin t=0)")
        ax.axvline(0, color="#E5484D", linestyle="--", linewidth=1.2, label="Forecast Origin (t=0)")
        ax.legend(loc="upper left", fontsize=9, frameon=True, facecolor="white")

    plt.tight_layout()
    sample_path = os.path.join(REPORTS_DIR, "forecast_sample_windows.png")
    plt.savefig(sample_path, dpi=200)
    plt.close()
    print(f"Saved forecast sample windows -> {sample_path}")

    # 4. Error Distributions Plot
    best_res = next(r for r in model_results if r["model_name"] in ["LSTM", "GRU"])
    actual_test = best_res["_actual"]
    pred_test = best_res["_predicted"]
    resids = actual_test - pred_test  # shape (N, 12, 3)

    fig, axes = plt.subplots(1, 3, figsize=(15, 4.5))
    units = ["bpm", "mmHg", "mmHg"]

    for i, (ax, feat, unit, c) in enumerate(zip(axes, FEATURES, units, ["#1FA89A", "#4A7BD0", "#30A46C"])):
        feat_resids = resids[:, :, i].flatten()
        sns.histplot(feat_resids, kde=True, ax=ax, color=c, bins=40, stat="density", alpha=0.6)
        mean_err = np.mean(feat_resids)
        std_err = np.std(feat_resids)
        ax.axvline(0, color="#0F172A", linestyle="-", linewidth=1.2)
        ax.axvline(mean_err, color="#E5484D", linestyle="--", linewidth=1.5, label=f"Bias: {mean_err:.2f}")
        ax.set_title(f"{feat.replace('_', ' ').title()} Residual Error ({unit})\nStd: {std_err:.2f} {unit}", fontsize=11, fontweight="bold")
        ax.set_xlabel(f"Error = Actual - Predicted ({unit})")
        ax.set_ylabel("Density")
        ax.legend(frameon=True, facecolor="white")

    plt.tight_layout()
    resid_path = os.path.join(REPORTS_DIR, "error_distributions.png")
    plt.savefig(resid_path, dpi=200)
    plt.close()
    print(f"Saved residual error distributions -> {resid_path}")


def main():
    parser = argparse.ArgumentParser(description="VitalSync LSTM Training & Benchmarking")
    parser.add_argument("--epochs", type=int, default=25, help="Max training epochs (default: 25)")
    parser.add_argument("--batch-size", type=int, default=128, help="Batch size (default: 128)")
    parser.add_argument("--lookback", type=int, default=LOOKBACK, help="Lookback window minutes (default: 60)")
    parser.add_argument("--horizon", type=int, default=HORIZON, help="Horizon steps (default: 12)")
    args = parser.parse_args()

    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    print("==================================================================")
    print("      VitalSync Phase 2: LSTM Physiological Model Training        ")
    print("==================================================================")

    # 1. Load data and patient-level split
    train_df, val_df, test_df, scaler, p_train, p_val, p_test = load_and_preprocess_data(DATA_PATH)

    # Save fitted scaler
    scaler_path = os.path.join(MODELS_DIR, "scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"Saved fitted StandardScaler -> {scaler_path}")

    # 2. Build sliding windows
    print("\nBuilding sliding windows (Lookback=60, Horizon=12)...")
    t0 = time.time()
    X_train, Y_train = build_sliding_windows(train_df, scaler, args.lookback, args.horizon)
    X_val, Y_val = build_sliding_windows(val_df, scaler, args.lookback, args.horizon)
    X_test, Y_test = build_sliding_windows(test_df, scaler, args.lookback, args.horizon)
    print(f"Windows extracted in {time.time() - t0:.2f}s:")
    print(f"  Train: X={X_train.shape}, Y={Y_train.shape}")
    print(f"  Val:   X={X_val.shape}, Y={Y_val.shape}")
    print(f"  Test:  X={X_test.shape}, Y={Y_test.shape}")

    # 3. Evaluate Baselines
    print("\n--- Evaluating Clinical Baselines on Test Set ---")
    res_last = evaluate_baseline_last_value(X_test, Y_test, scaler)
    res_ma = evaluate_baseline_moving_avg(X_test, Y_test, scaler, window_len=15)
    print(f"Baseline 'Last Value' (Persistence) -> Overall MAE: {res_last['overall_mae']:.2f}, RMSE: {res_last['overall_rmse']:.2f}")
    print(f"Baseline 'Moving Average (15m)'      -> Overall MAE: {res_ma['overall_mae']:.2f}, RMSE: {res_ma['overall_rmse']:.2f}")

    # 4. Train Model 1: Stacked LSTM
    print("\n------------------------------------------------------------------")
    print("Training Model 1: Stacked LSTM (128 -> Dropout(0.2) -> 64 -> Dropout(0.2) -> Dense)")
    print("------------------------------------------------------------------")
    lstm_model = build_lstm_model(input_shape=(args.lookback, len(FEATURES)), horizon=args.horizon, num_features=len(FEATURES))
    lstm_checkpoint = os.path.join(MODELS_DIR, "lstm_checkpoint.keras")

    t_start = time.time()
    lstm_model, lstm_history = train_model(
        lstm_model, X_train, Y_train, X_val, Y_val,
        model_save_path=lstm_checkpoint, epochs=args.epochs, batch_size=args.batch_size
    )
    print(f"LSTM training completed in {time.time() - t_start:.1f}s.")
    res_lstm = evaluate_model(lstm_model, X_test, Y_test, scaler, model_name="LSTM")
    print(f"LSTM Test Performance -> Overall MAE: {res_lstm['overall_mae']:.2f}, RMSE: {res_lstm['overall_rmse']:.2f}")

    # 5. Train Model 2: Alternative Architecture (GRU)
    print("\n------------------------------------------------------------------")
    print("Training Model 2: Stacked GRU (128 -> Dropout(0.2) -> 64 -> Dropout(0.2) -> Dense)")
    print("------------------------------------------------------------------")
    gru_model = build_gru_model(input_shape=(args.lookback, len(FEATURES)), horizon=args.horizon, num_features=len(FEATURES))
    gru_checkpoint = os.path.join(MODELS_DIR, "gru_checkpoint.keras")

    t_start_gru = time.time()
    gru_model, gru_history = train_model(
        gru_model, X_train, Y_train, X_val, Y_val,
        model_save_path=gru_checkpoint, epochs=args.epochs, batch_size=args.batch_size
    )
    print(f"GRU training completed in {time.time() - t_start_gru:.1f}s.")
    res_gru = evaluate_model(gru_model, X_test, Y_test, scaler, model_name="GRU")
    print(f"GRU Test Performance -> Overall MAE: {res_gru['overall_mae']:.2f}, RMSE: {res_gru['overall_rmse']:.2f}")

    # 6. Compare and select best model
    all_results = [res_last, res_ma, res_lstm, res_gru]
    histories = {"LSTM": lstm_history, "GRU": gru_history}

    best_neural_res = min([res_lstm, res_gru], key=lambda r: r["overall_mae"])
    best_model = lstm_model if best_neural_res["model_name"] == "LSTM" else gru_model
    final_model_path = os.path.join(MODELS_DIR, "vitals_lstm.keras")
    best_model.save(final_model_path)
    print(f"\nSelected Best Architecture: {best_neural_res['model_name']} (MAE: {best_neural_res['overall_mae']:.2f})")
    print(f"Saved primary production model -> {final_model_path}")

    # 7. Generate Evaluation Visualizations
    print("\nGenerating evaluation plots in /ml/reports/...")
    generate_evaluation_plots(histories, all_results, X_test, Y_test, scaler, best_model)

    # 8. Save metrics.json (excluding internal array caches)
    metrics_export = {
        "timestamp": datetime.utcnow().isoformat(),
        "lookback_minutes": args.lookback,
        "horizon_steps": args.horizon,
        "cohort_summary": {
            "total_patients": len(p_train) + len(p_val) + len(p_test),
            "train_patients": len(p_train),
            "val_patients": len(p_val),
            "test_patients": len(p_test),
            "train_windows": len(X_train),
            "test_windows": len(X_test),
        },
        "models": [
            {k: v for k, v in r.items() if not k.startswith("_")}
            for r in all_results
        ],
    }

    metrics_json_path = os.path.join(REPORTS_DIR, "metrics.json")
    with open(metrics_json_path, "w", encoding="utf-8") as f:
        json.dump(metrics_export, f, indent=2)
    print(f"Saved test metrics JSON -> {metrics_json_path}")

    # 9. Print Formatted Comparison Table
    print("\n==================================================================")
    print("               FINAL MODEL BENCHMARK COMPARISON TABLE             ")
    print("==================================================================")
    print(f"{'Model / Architecture':<28} | {'Overall MAE':<11} | {'Overall RMSE':<12} | {'HR MAE':<8} | {'SBP MAE':<9} | {'DBP MAE':<9}")
    print("-" * 88)
    for r in all_results:
        mname = r["model_name"]
        o_mae = f"{r['overall_mae']:.2f}"
        o_rmse = f"{r['overall_rmse']:.2f}"
        hr_mae = f"{r['features']['heart_rate']['mae']:.2f}"
        sbp_mae = f"{r['features']['systolic_bp']['mae']:.2f}"
        dbp_mae = f"{r['features']['diastolic_bp']['mae']:.2f}"
        print(f"{mname:<28} | {o_mae:<11} | {o_rmse:<12} | {hr_mae:<8} | {sbp_mae:<9} | {dbp_mae:<9}")
    print("==================================================================")


if __name__ == "__main__":
    main()
