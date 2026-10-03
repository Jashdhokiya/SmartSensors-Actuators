# TinyML Cargo Shock/Handling Classifier

Complete TinyML pipeline that adds a 4-class shock/handling classifier to the
Smart Cargo Monitor firmware. All 6 phases are self-contained in this `tinyml/`
directory. **The existing firmware behaviour, MQTT topics, alert thresholds,
predictive engine, and GPS logic are completely unchanged.**

---

## Quick Start (one command per phase)

```bash
# 0. Install dependencies
pip install -r tinyml/requirements.txt

# 1. Generate synthetic dataset  (~30 s, seeds fixed)
python tinyml/generate_dataset.py --seed 42 --n_runs 125 --output tinyml/dataset --plot

# 2. Train models and export C header  (~2-5 min for RF only)
python tinyml/train_model.py --dataset tinyml/dataset --output tinyml/models --skip_cnn

# 3. Copy model header to firmware
copy tinyml\models\model_rf.h firmware\smart_cargo_monitor\model_rf.h

# 4. Robustness test
python tinyml/robustness_test.py --dataset tinyml/dataset --models tinyml/models

# 5. Flash firmware (Arduino IDE / arduino-cli)
#    Open firmware/smart_cargo_monitor/smart_cargo_monitor.ino in Arduino IDE
#    Board: ESP32 Dev Module, Flash: 4MB, CPU: 240MHz
#    Upload → check Serial at 115200

# 6. Collect real data (flash imu_logger first, then retrain)
python tinyml/mix_real_data.py --real_csv my_real_data.csv --dataset tinyml/dataset
python tinyml/validate_real.py --real_csv my_real_data.csv --models tinyml/models_mixed
copy tinyml\models_mixed\model_rf.h firmware\smart_cargo_monitor\model_rf.h
```

---

## File Map

```
tinyml/
├── PARAMETERS.md         Phase 1 — research values with citations
├── generate_dataset.py   Phase 2 — physics-based synthetic IMU generator
├── features.py           Phase 3 — Python reference feature extractor (16 features)
├── train_model.py        Phase 3 — train RF / MLP / CNN, export model_rf.h
├── robustness_test.py    Phase 4 — out-of-distribution stress tests
├── mix_real_data.py      Phase 6 — mix real CSV with synthetic, retrain
├── validate_real.py      Phase 6 — accuracy on real data only
├── requirements.txt      Pinned Python dependencies
├── imu_logger/
│   └── imu_logger.ino    Phase 6 — standalone data-logger sketch
├── dataset/              (generated) X_train/val/test.npy, y_*.npy, config.json
└── models/               (generated) model_rf.h, scaler_*.npy, *.tflite, reports

firmware/smart_cargo_monitor/
├── classifier.h/.cpp     Phase 5 — non-blocking ring-buffer + RF inference module
├── feature_extractor.h   Phase 5 — C++ feature extractor header
├── feature_extractor.cpp Phase 5 — C++ feature extractor (mirrors features.py)
├── model_rf.h            (copy from models/) — generated RF C header
└── smart_cargo_monitor.ino  ← 3-line patch only (include + init + feed call)
```

---

## Classes

| ID | Label | Signature |
|---|---|---|
| 0 | `normal` | Stationary, carrying, smooth vehicle transport |
| 1 | `shock` | Single hard impact, no free-fall preceding it |
| 2 | `drop` | Free-fall phase (< 0.3 g) then impact + ringing |
| 3 | `rough_handling` | Multiple moderate jolts, tilts, tossing |
| 4 | `uncertain` | Max vote fraction below confidence threshold (0.45) |

---

## Architecture Decision: Why Random Forest (not CNN)

| Model | Est. Flash | Est. Arena | Notes |
|---|---|---|---|
| **RF (20 trees, depth 8)** | **~15–30 KB** | **~256 B** | Plain C, no runtime, no arena |
| MLP (32-16-4, int8 TFLite) | ~8 KB | ~4 KB | Needs TFLite Micro runtime |
| 1D-CNN (int8 TFLite) | ~20–35 KB | ~12 KB | Needs TFLite Micro runtime |

The RF exports to a pure C header (`model_rf.h`) with no external runtime
dependency. It runs in < 2 ms estimated on the ESP32 FPU. The MLP/CNN
options are generated too and you can switch by replacing the include.

---

## Hardware Budget Accounting

| Resource | Budget | RF usage | Remaining |
|---|---|---|---|
| Flash (model) | 60 KB | ~20 KB (est.) | ~40 KB |
| RAM (arena + features) | 24 KB + 8 KB = 32 KB | 1.5 KB (ringbuf) + 0.5 KB (feats) | ~30 KB |
| Inference time | 20 ms | < 2 ms (estimated) | 18 ms |

> **Estimated** — not measured on hardware. Actual flash usage depends on
> tree count and depth chosen at training time. Check with `esptool.py` or
> Arduino IDE build output.

---

## Sample Rate: Important Note

The MPU-6050 is configured at **125 Hz** with a **44 Hz DLPF**, which is
adequate for window-level classification (detecting *whether* a drop/shock
occurred in a 1-second window). However:

- Impact pulses on concrete (1–5 ms) are heavily attenuated by the DLPF.
  They appear as 1–3 sample spikes rather than clean half-sine pulses.
- The classifier compensates by detecting the **free-fall phase** (< 0.3 g)
  before a drop, and **ringing/settling** after impact — both are in the
  passband.
- If you need accurate peak-g measurement (not just classification), consider
  increasing to 200 Hz + DLPF=1 (188 Hz BW). This is a separate patch
  that does not affect the classifier logic.

The existing `readMotionSensor()` at 1 Hz is **not changed**. The classifier
adds a second independent I2C read path at 125 Hz.

---

## Library Versions (Arduino)

| Library | Version | Install |
|---|---|---|
| TinyGPSPlus | 1.0.3 | Arduino Library Manager |
| ArduinoJson | 6.21.5 | Arduino Library Manager |
| PubSubClient | 2.8.0 | Arduino Library Manager |

No TFLite Micro library is required for the RF model. If you switch to MLP/CNN,
install `EloquentTinyML` >= 0.0.10 or the official `tflite-micro` Arduino package.

---

## Retraining from Scratch (One Command)

```bash
python tinyml/generate_dataset.py --seed 42 --n_runs 125 --output tinyml/dataset && \
python tinyml/train_model.py --dataset tinyml/dataset --output tinyml/models --skip_cnn && \
copy tinyml\models\model_rf.h firmware\smart_cargo_monitor\model_rf.h
```

Change `--seed` to get a different dataset split. Change `--n_runs` to increase
dataset size (125 → ~25,000 windows; 400 → ~80,000 windows).

---

## Real-World Accuracy Disclaimer

All accuracy figures reported by `train_model.py` and `robustness_test.py` are
on **synthetic test data only**. The sim-to-real gap is significant:

- Synthetic impact pulses are modelled as half-sine; real impacts vary.
- DLPF attenuation of sharp pulses is approximated, not exact.
- Orientation during real drops varies more than the generator covers.

**Use `imu_logger.ino` + `validate_real.py` to measure true real-world accuracy
before making reliability claims.**

---

## Serial Test Mode

To validate that the C++ feature extractor matches the Python one:

1. Open the main firmware Serial monitor at 115200.
2. Send the character `T`.
3. The ESP32 enters test mode and waits for a 125-line CSV window.
4. Send the window (125 lines of `ax,ay,az,gx,gy,gz` int16 values).
5. The ESP32 prints all 16 features and the predicted class.
6. Compare with: `python -c "from features import *; import numpy as np; ..."`

---

## MQTT Payload Addition

The new `classification` object is appended to the existing JSON payload:

```json
{
  "classification": {
    "valid": true,
    "label": "normal",
    "label_id": 0,
    "confidence": 0.80,
    "votes": [0.80, 0.05, 0.10, 0.05]
  }
}
```

`valid` is `false` for the first second while the ring buffer fills.
`label` is `"uncertain"` when `confidence < 0.45` (configurable in `classifier.h`).
Edge-threshold alerts (`shockDetected`, `tiltExceeded`) fire independently.
