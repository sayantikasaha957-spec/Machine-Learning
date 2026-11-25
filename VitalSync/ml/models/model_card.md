# Model Card: VitalSync Multi-Horizon Physiological LSTM

**Model Version**: `v1.0.0`  
**Model Date**: November 2026  
**Model Type**: Deep Recurrent Neural Network (Stacked LSTM with Multi-Step Direct Projection)  
**License**: MIT / Open Research  
**Primary Artifact**: [`ml/models/vitals_lstm.keras`](vitals_lstm.keras)  
**Preprocessing Artifact**: [`ml/models/scaler.pkl`](scaler.pkl)

---

## 1. Model Overview

The VitalSync LSTM Forecasting Model is an intelligent clinical time-series forecaster that predicts multi-channel vital signs (Heart Rate, Systolic Blood Pressure, and Diastolic Blood Pressure) over a **12-minute forward horizon** ($T_{out} = 12$) given a **60-minute continuous lookback window** ($T_{in} = 60$) sampled at 1-minute intervals.

The model incorporates **Monte Carlo Dropout** (30 stochastic forward passes at inference time) to estimate predictive uncertainty and generate 90% empirical confidence bands for proactive deterioration warnings.

---

## 2. Architecture & Hyperparameters

```
Input: Tensor of shape (Batch_Size, 60, 3)
│
├── LSTM Layer 1 (128 units, return_sequences=True, activation='tanh', recurrent_activation='sigmoid')
├── Dropout (rate=0.20, active during MC inference)
├── LSTM Layer 2 (64 units, return_sequences=False, activation='tanh', recurrent_activation='sigmoid')
├── Dropout (rate=0.20, active during MC inference)
├── Dense Projection (12 * 3 = 36 units, linear activation)
└── Reshape Layer -> Output Shape: (Batch_Size, 12, 3)
```

- **Loss Function**: Mean Squared Error (MSE)
- **Optimizer**: Adam ($\eta = 10^{-3}$, $\beta_1 = 0.9, \beta_2 = 0.999$)
- **Learning Rate Scheduler**: `ReduceLROnPlateau` (factor=0.5, patience=3, min_lr=$10^{-5}$)
- **Early Stopping**: Monitored on `val_loss` (patience=6, restore_best_weights=True)
- **Batch Size**: 128
- **Normalization**: Standard scaling ($z = \frac{x - \mu}{\sigma}$) fitted exclusively on training cohort patients.

---

## 3. Training & Validation Data

- **Primary Source**: **VitalDB Open Dataset** (Seoul National University Hospital open surgical/ICU repository).
- **Cohort Size**: 217 patients (61,745 one-minute observation rows).
- **Split Strategy**: Strictly partitioned **by patient** (70% Train, 15% Validation, 15% Test) to ensure zero cross-subject temporal data leakage.
  - **Train**: 151 patients (~32,400 windows)
  - **Validation**: 33 patients (~7,000 windows)
  - **Test**: 33 patients (~6,900 windows)
- **Physiological Feature Definitions**:
  - `heart_rate`: Beats per minute (bpm), clinical range [20, 250]
  - `systolic_bp`: Arterial line / NIBP systolic blood pressure (mmHg), clinical range [60, 250]
  - `diastolic_bp`: Arterial line / NIBP diastolic blood pressure (mmHg), clinical range [30, 150]

---

## 4. Benchmark Performance on Test Set

Evaluated on 7,049 holdout test sliding windows (34 holdout patients) in **real clinical units** (BPM, mmHg) across all 12 forward forecast steps against standard clinical baselines:

| Model / Architecture | Overall MAE | Overall RMSE | Heart Rate MAE (bpm) | Systolic BP MAE (mmHg) | Diastolic BP MAE (mmHg) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Last Value (Persistence)** | 7.06 | 11.64 | 3.86 | 11.23 | 6.10 | Baseline |
| **Moving Average (15-min)** | 7.40 | 11.38 | 3.97 | 11.85 | 6.38 | Baseline |
| **Stacked LSTM (VitalSync)** | **6.54** | **10.16** | **3.80** | **10.31** | **5.52** | **Best Model** |
| **Stacked GRU** | 6.67 | 10.24 | 4.16 | 10.31 | 5.53 | Alternative |

### Step-by-Step Forecast Horizon Degradation (MAE in real units)
Across the 12-minute horizon ($t+1$ to $t+12$), the Stacked LSTM outperforms persistence and moving average, especially as forecast lead time increases:
- **At $t+1$ min**: Persistence MAE = 3.33 vs LSTM MAE = 3.73 (near-term autocorrelation)
- **At $t+6$ min**: Persistence MAE = 7.15 vs LSTM MAE = **6.58** (LSTM +8.0% improvement)
- **At $t+12$ min**: Persistence MAE = 9.87 vs LSTM MAE = **8.78** (LSTM +11.0% improvement)

---

## 5. Uncertainty Quantification (Monte Carlo Dropout)

Traditional neural point estimates fail to signal model confidence during abrupt physiological crises. VitalSync leverages Monte Carlo Dropout:
- **Procedure**: Keeps dropout layers active during test/production inference (`training=True`), evaluating $N = 30$ independent forward passes per sliding window.
- **Outputs**:
  - **Mean Trajectory**: Expected physiological trend.
  - **Empirical 90% Confidence Interval**: $[\text{P}_{5}, \text{P}_{95}]$ percentiles.
- **Clinical Utility**: Narrow confidence bands indicate stable predictable dynamics; widening bands highlight anomalous volatility or impending clinical decompensation.

---

## 6. Intended Use & Clinical Limitations

### Intended Use
- Early warning decision support in telemetry wards and Intensive Care Units.
- Visualizing anticipated 12-minute hemodynamic trajectories to alert nursing staff of impending hypotension or tachycardia.

### Limitations
- **Not a Standalone Diagnostic**: The model is an auxiliary warning system and must never override certified bedside monitors or clinician judgment.
- **Extreme Artifacts**: Sensor displacement or blood pressure cuff failure may distort input sequences; external signal quality indices (SQI) should gate inference.
- **Population Bias**: Trained primarily on adult surgical patients under continuous anesthesia monitoring; performance on pediatric cohorts or ambulatory telemetry requires domain retraining.
