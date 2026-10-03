#!/usr/bin/env python3
"""
mix_real_data.py — Phase 6: Mix real CSV recordings with synthetic dataset and retrain.

Usage:
  # After collecting data with imu_logger.ino:
  python mix_real_data.py \\
      --real_csv real_data.csv \\
      --dataset  dataset/ \\
      --output   dataset_mixed/ \\
      --output_models models_mixed/

The real CSV must have the format produced by imu_logger.ino:
  label,ax,ay,az,gx,gy,gz,timestamp_us
  (one line per sample; 125 consecutive lines = 1 window)

Windows are extracted by grouping 125 consecutive samples with the same label.
If a label change occurs mid-window, the partial window is discarded.
"""

import argparse
import sys
import json
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from features import extract_features_batch
from train_model import (load_scaler_stats, scale_features,
                          train_random_forest, rf_to_c_code,
                          evaluate_sklearn, tflite_to_c_header, SEED,
                          CLASS_NAMES)

WINDOW_SAMPLES = 125


# ────────────────────────────────────────────────────────────
# Load real CSV
# ────────────────────────────────────────────────────────────

def load_real_csv(csv_path):
    """
    Parse imu_logger.ino CSV output into (N_windows, 125, 6) int16 array.
    Returns X (int16), y (int8), and window count per class.
    """
    windows_X = []
    windows_y = []

    buf = []       # current partial window
    buf_label = -1

    with open(csv_path, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(",")
            if len(parts) < 7:
                continue
            try:
                label = int(parts[0])
                vals  = [int(v) for v in parts[1:7]]
            except ValueError:
                continue

            if label != buf_label:
                # Label changed — discard partial window
                buf = []
                buf_label = label

            buf.append(vals)
            if len(buf) == WINDOW_SAMPLES:
                windows_X.append(np.array(buf, dtype=np.int16))
                windows_y.append(label)
                buf = []

    X = np.array(windows_X, dtype=np.int16)  # (N, 125, 6)
    y = np.array(windows_y, dtype=np.int8)
    print(f"[Real] Loaded {len(y)} windows from {csv_path}")
    for c in range(4):
        print(f"  class {c} ({CLASS_NAMES[c]}): {(y==c).sum()} windows")
    return X, y


# ────────────────────────────────────────────────────────────
# Mix and retrain
# ────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--real_csv",      required=True)
    parser.add_argument("--dataset",       default="dataset/")
    parser.add_argument("--output",        default="dataset_mixed/",
                        help="Output dir for mixed dataset")
    parser.add_argument("--output_models", default="models_mixed/")
    parser.add_argument("--real_weight",   type=float, default=3.0,
                        help="How many times to replicate real windows (default 3)")
    args = parser.parse_args()

    out_data = Path(args.output)
    out_mdl  = Path(args.output_models)
    out_data.mkdir(parents=True, exist_ok=True)
    out_mdl.mkdir(parents=True, exist_ok=True)

    # Load real data
    X_real, y_real = load_real_csv(args.real_csv)
    if len(X_real) == 0:
        print("[ERROR] No valid windows found in real CSV.")
        sys.exit(1)

    # Replicate real data to increase its weight
    n_reps = max(1, int(args.real_weight))
    X_real_rep = np.repeat(X_real, n_reps, axis=0)
    y_real_rep = np.repeat(y_real, n_reps, axis=0)

    # Load synthetic train split
    syn_dir = Path(args.dataset)
    X_syn_tr = np.load(syn_dir / "X_train.npy")
    y_syn_tr = np.load(syn_dir / "y_train.npy")
    X_syn_val = np.load(syn_dir / "X_val.npy")
    y_syn_val = np.load(syn_dir / "y_val.npy")
    X_syn_te  = np.load(syn_dir / "X_test.npy")
    y_syn_te  = np.load(syn_dir / "y_test.npy")
    print(f"[Synthetic] Train: {len(y_syn_tr)}  Val: {len(y_syn_val)}  Test: {len(y_syn_te)}")

    # Split real data: 70/15/15
    rng = np.random.default_rng(SEED)
    idx = rng.permutation(len(X_real_rep))
    n_tr  = int(0.70 * len(idx))
    n_val = int(0.15 * len(idx))
    X_r_tr  = X_real_rep[idx[:n_tr]]
    y_r_tr  = y_real_rep[idx[:n_tr]]
    X_r_val = X_real_rep[idx[n_tr:n_tr+n_val]]
    y_r_val = y_real_rep[idx[n_tr:n_tr+n_val]]
    X_r_te  = X_real_rep[idx[n_tr+n_val:]]
    y_r_te  = y_real_rep[idx[n_tr+n_val:]]

    # Concatenate
    X_tr  = np.concatenate([X_syn_tr,  X_r_tr],  axis=0)
    y_tr  = np.concatenate([y_syn_tr,  y_r_tr],  axis=0)
    X_val = np.concatenate([X_syn_val, X_r_val], axis=0)
    y_val = np.concatenate([y_syn_val, y_r_val], axis=0)
    # Test set: real only (to measure real-world accuracy)
    X_te  = X_r_te
    y_te  = y_r_te

    print(f"[Mixed] Train: {len(y_tr)}  Val: {len(y_val)}  Test(real only): {len(y_te)}")

    # Save mixed dataset
    for split, X, y in [("train", X_tr, y_tr), ("val", X_val, y_val), ("test", X_te, y_te)]:
        np.save(out_data / f"X_{split}.npy", X)
        np.save(out_data / f"y_{split}.npy", y)

    # Extract features
    print("[Features] Extracting...")
    Xf_tr  = extract_features_batch(X_tr)
    Xf_val = extract_features_batch(X_val)
    Xf_te  = extract_features_batch(X_te)

    fmin, fmax = load_scaler_stats(Xf_tr)
    np.save(out_mdl / "scaler_min.npy", fmin)
    np.save(out_mdl / "scaler_max.npy", fmax)

    Xs_tr  = scale_features(Xf_tr,  fmin, fmax)
    Xs_val = scale_features(Xf_val, fmin, fmax)
    Xs_te  = scale_features(Xf_te,  fmin, fmax)

    # Train RF on mixed data
    rf, _, _ = train_random_forest(Xs_tr, y_tr.astype(np.int64),
                                    Xs_val, y_val.astype(np.int64))
    rf_report, rf_cm, rf_preds = evaluate_sklearn(rf, Xs_te, y_te.astype(np.int64), "RF-mixed")

    from sklearn.metrics import accuracy_score
    acc = accuracy_score(y_te, rf_preds)
    print(f"\n[Mixed RF] Real-only test accuracy: {acc:.3f}")
    print("NOTE: This is accuracy on REAL data — more representative than synthetic-only.")

    # Export C header
    rf_c_path = str(out_mdl / "model_rf.h")
    rf_to_c_code(rf, fmin, fmax, rf_c_path)
    print(f"\nNew model_rf.h: {rf_c_path}")
    print(f"Copy to firmware: cp {rf_c_path} firmware/smart_cargo_monitor/model_rf.h")

    # Save report
    report = {
        "real_csv": args.real_csv,
        "real_windows": int(len(X_real)),
        "real_weight": args.real_weight,
        "mixed_train": int(len(y_tr)),
        "real_test_accuracy": float(acc),
        "confusion_matrix": rf_cm.tolist(),
    }
    with open(out_mdl / "mix_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"Report: {out_mdl}/mix_report.json")


if __name__ == "__main__":
    main()
