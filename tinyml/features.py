#!/usr/bin/env python3
"""
features.py — Phase 3: Feature extractor for shock/handling classifier.

CRITICAL: This Python implementation is the reference for the matching
C++ version in feature_extractor.cpp.  Both must produce identical
outputs (within float32 rounding) for the same raw int16 input.

Features (16 total, all float32):
  [0]  accel_peak_g       — max |accel_magnitude| in window
  [1]  accel_rms_g        — RMS of accel magnitude
  [2]  accel_min_g        — min |accel_magnitude| (proxy for free-fall)
  [3]  free_fall_ratio    — fraction of samples where |a| < 0.3 g
  [4]  jerk_peak_g_per_s  — max |d(a_mag)/dt| * FS_HZ (jerk, g/s)
  [5]  accel_std_x        — std of ax in g
  [6]  accel_std_y        — std of ay in g
  [7]  accel_std_z        — std of az in g
  [8]  gyro_energy        — RMS of gyro magnitude (deg/s)
  [9]  gyro_peak          — max gyro magnitude (deg/s)
  [10] zero_cross_rate    — zero-crossing rate of (|a| - 1.0g) signal
  [11] impulse_count      — number of samples where |a| > 2.5 g
  [12] skewness_mag       — skewness of accel magnitude
  [13] kurtosis_mag       — excess kurtosis of accel magnitude
  [14] accel_iqr_g        — IQR (Q75-Q25) of accel magnitude
  [15] gyro_std           — std of gyro magnitude
"""

import numpy as np
from typing import Tuple

# Must match firmware config.h and mpu6050_sensor.cpp
FS_HZ          = 125
ACCEL_LSB_G    = 4096.0
GYRO_LSB_DPS   = 65.5
WINDOW_SAMPLES = 125

FREE_FALL_THRESH_G = 0.30    # g — fraction below this -> free_fall_ratio
SHOCK_THRESH_G     = 2.5     # g — impulse_count threshold
NUM_FEATURES       = 16


def extract_features(window_raw: np.ndarray) -> np.ndarray:
    """
    Extract 16 float32 features from a (125, 6) int16 raw window.

    window_raw columns: [ax_raw, ay_raw, az_raw, gx_raw, gy_raw, gz_raw]
    All in MPU-6050 raw int16 counts.

    Returns: np.ndarray shape (16,) dtype float32
    """
    assert window_raw.shape == (WINDOW_SAMPLES, 6), \
        f"Expected (125,6), got {window_raw.shape}"

    win = window_raw.astype(np.float32)

    # Convert to physical units
    ax = win[:, 0] / ACCEL_LSB_G   # g
    ay = win[:, 1] / ACCEL_LSB_G
    az = win[:, 2] / ACCEL_LSB_G
    gx = win[:, 3] / GYRO_LSB_DPS  # deg/s
    gy = win[:, 4] / GYRO_LSB_DPS
    gz = win[:, 5] / GYRO_LSB_DPS

    accel_mag = np.sqrt(ax**2 + ay**2 + az**2)        # shape (N,)
    gyro_mag  = np.sqrt(gx**2 + gy**2 + gz**2)

    # --- Feature computation ---
    accel_peak_g      = float(np.max(accel_mag))
    accel_rms_g       = float(np.sqrt(np.mean(accel_mag**2)))
    accel_min_g       = float(np.min(accel_mag))
    free_fall_ratio   = float(np.mean(accel_mag < FREE_FALL_THRESH_G))

    # Jerk: finite difference of magnitude, multiplied by FS_HZ to get g/s
    jerk = np.abs(np.diff(accel_mag)) * FS_HZ
    jerk_peak_g_per_s = float(np.max(jerk)) if len(jerk) > 0 else 0.0

    accel_std_x = float(np.std(ax))
    accel_std_y = float(np.std(ay))
    accel_std_z = float(np.std(az))

    gyro_energy = float(np.sqrt(np.mean(gyro_mag**2)))
    gyro_peak   = float(np.max(gyro_mag))

    # Zero-crossing rate of (accel_mag - 1.0g) — sign changes per sample
    centred = accel_mag - 1.0
    signs   = np.sign(centred)
    signs[signs == 0] = 1.0
    sign_changes = np.sum(signs[:-1] != signs[1:])
    zero_cross_rate = float(sign_changes) / float(WINDOW_SAMPLES - 1)

    impulse_count = float(np.sum(accel_mag > SHOCK_THRESH_G))

    # Skewness: E[(x-mu)^3] / sigma^3
    mu    = np.mean(accel_mag)
    sigma = np.std(accel_mag)
    if sigma > 1e-6:
        skewness_mag = float(np.mean(((accel_mag - mu) / sigma)**3))
        kurtosis_mag = float(np.mean(((accel_mag - mu) / sigma)**4) - 3.0)  # excess
    else:
        skewness_mag = 0.0
        kurtosis_mag = 0.0

    q25, q75 = np.percentile(accel_mag, [25, 75])
    accel_iqr_g = float(q75 - q25)

    gyro_std = float(np.std(gyro_mag))

    return np.array([
        accel_peak_g,
        accel_rms_g,
        accel_min_g,
        free_fall_ratio,
        jerk_peak_g_per_s,
        accel_std_x,
        accel_std_y,
        accel_std_z,
        gyro_energy,
        gyro_peak,
        zero_cross_rate,
        impulse_count,
        skewness_mag,
        kurtosis_mag,
        accel_iqr_g,
        gyro_std,
    ], dtype=np.float32)


FEATURE_NAMES = [
    "accel_peak_g",
    "accel_rms_g",
    "accel_min_g",
    "free_fall_ratio",
    "jerk_peak_g_per_s",
    "accel_std_x",
    "accel_std_y",
    "accel_std_z",
    "gyro_energy",
    "gyro_peak",
    "zero_cross_rate",
    "impulse_count",
    "skewness_mag",
    "kurtosis_mag",
    "accel_iqr_g",
    "gyro_std",
]


def extract_features_batch(X_raw: np.ndarray) -> np.ndarray:
    """
    Extract features from a batch of raw windows.
    X_raw: shape (N, 125, 6) int16
    Returns: shape (N, 16) float32
    """
    N = X_raw.shape[0]
    features = np.zeros((N, NUM_FEATURES), dtype=np.float32)
    for i in range(N):
        features[i] = extract_features(X_raw[i])
    return features


if __name__ == "__main__":
    # Quick self-test
    rng = np.random.default_rng(0)
    test_win = rng.integers(-32768, 32767, size=(125, 6), dtype=np.int16)
    f = extract_features(test_win)
    print("Feature vector (16 values):")
    for name, val in zip(FEATURE_NAMES, f):
        print(f"  {name:25s} = {val:.6f}")
