#!/usr/bin/env python3
"""
validate_real.py — Phase 6: Evaluate a trained model on real data only.

Usage:
  python validate_real.py \\
      --real_csv  real_data.csv \\
      --models    models/          # or models_mixed/

Loads the saved scaler and RF model, runs prediction on every window
in the CSV, and prints per-class precision/recall with confusion matrix.
"""

import argparse
import sys
import json
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from features import extract_features_batch
from train_model import scale_features, CLASS_NAMES, _print_cm
from mix_real_data import load_real_csv


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--real_csv", required=True)
    parser.add_argument("--models",   default="models/")
    args = parser.parse_args()

    mdl_dir = Path(args.models)

    # Load scaler
    fmin = np.load(mdl_dir / "scaler_min.npy")
    fmax = np.load(mdl_dir / "scaler_max.npy")

    # Load RF
    try:
        import joblib
        rf = joblib.load(mdl_dir / "model_rf.joblib")
    except Exception:
        print("[ERROR] Could not load model_rf.joblib from", args.models)
        print("  Run train_model.py first, then save with joblib:")
        print("  import joblib; joblib.dump(rf, 'models/model_rf.joblib')")
        sys.exit(1)

    # Load real data
    X_real, y_real = load_real_csv(args.real_csv)
    if len(X_real) == 0:
        print("[ERROR] No valid windows found.")
        sys.exit(1)

    # Features and scale
    Xf = extract_features_batch(X_real)
    denom = fmax - fmin
    denom[denom < 1e-6] = 1.0
    Xs = 2.0 * (Xf - fmin) / denom - 1.0

    # Predict
    y_pred = rf.predict(Xs)

    from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
    report = classification_report(y_real, y_pred, target_names=CLASS_NAMES, digits=3)
    cm     = confusion_matrix(y_real, y_pred)
    acc    = accuracy_score(y_real, y_pred)

    print("\n" + "="*60)
    print("REAL DATA VALIDATION REPORT")
    print(f"  CSV: {args.real_csv}")
    print(f"  Model dir: {args.models}")
    print(f"  Total windows: {len(y_real)}")
    print("="*60)
    print(report)
    print("Confusion matrix (real data):")
    _print_cm(cm)
    print(f"\nOverall accuracy (real data): {acc:.3f}")
    print("\nNOTE: This is the accuracy that matters for real-world deployment.")
    print("Synthetic-only accuracy is NOT a reliable predictor of this number.")

    result = {
        "real_csv": args.real_csv,
        "models":   str(args.models),
        "n_windows": int(len(y_real)),
        "overall_accuracy": float(acc),
        "confusion_matrix":  cm.tolist(),
        "per_class": {}
    }
    for i, name in enumerate(CLASS_NAMES):
        mask = y_real == i
        if mask.sum() == 0:
            continue
        result["per_class"][name] = {
            "n": int(mask.sum()),
            "accuracy": float((y_pred[mask] == i).mean())
        }
    out_path = Path(args.models) / "real_validation.json"
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nReport saved: {out_path}")


if __name__ == "__main__":
    main()
