#!/usr/bin/env python3
"""
generate_dataset.py — Phase 2: Physics-based synthetic IMU data generator
Smart Cargo Monitor — TinyML Shock/Handling Classifier

Produces raw 6-axis IMU streams in MPU-6050 raw-count scale (int16),
then cuts them into 1-second windows at 125 Hz with 50% overlap.

Run: python generate_dataset.py --seed 42 --n_runs 400 --output dataset/

All parameters derived from PARAMETERS.md (research values with source citations).
"""

import numpy as np
import os
import json
import argparse
import random
from pathlib import Path

# ============================================================
# HARDWARE CONSTANTS (match firmware config.h / mpu6050_sensor.cpp)
# ============================================================
FS_HZ         = 125        # Output data rate (1000 / (1 + SMPLRT_DIV=7))
ACCEL_LSB_G   = 4096.0     # LSB/g at +-8g (AFS_SEL=2)
GYRO_LSB_DPS  = 65.5       # LSB/deg/s at +-500 deg/s (FS_SEL=1)
ACCEL_MAX_RAW = 32767       # Hard saturation limit
ACCEL_MIN_RAW = -32768
GYRO_MAX_RAW  = 32767
GYRO_MIN_RAW  = -32768
WINDOW_SAMPLES = 125       # 1 second at 125 Hz
OVERLAP_SAMPLES = 62       # 50% overlap -> step = 63
WINDOW_STEP   = WINDOW_SAMPLES - OVERLAP_SAMPLES  # 63 samples between window starts

# ============================================================
# SENSOR NOISE MODEL (from MPU-6050 datasheet §6.1, §6.2 and PARAMETERS.md)
# ============================================================
# Accel noise: 400 ug/sqrt(Hz), BW~44 Hz -> sigma ~ 2.65 mg = 0.00265 g
ACCEL_NOISE_SIGMA_G  = 0.00265
ACCEL_NOISE_SIGMA_RAW = ACCEL_NOISE_SIGMA_G * ACCEL_LSB_G  # ~10.9 LSB

# Gyro noise: 0.005 deg/s/sqrt(Hz), BW~42 Hz -> sigma ~ 0.032 deg/s
GYRO_NOISE_SIGMA_DPS  = 0.032
GYRO_NOISE_SIGMA_RAW  = GYRO_NOISE_SIGMA_DPS * GYRO_LSB_DPS  # ~2.1 LSB

# Per-run bias (uniform random within these bounds)
ACCEL_BIAS_MAX_G  = [0.050, 0.050, 0.080]   # X, Y, Z in g (from datasheet +-50/80mg)
GYRO_BIAS_MAX_DPS = 20.0                     # +-20 deg/s typical (+-40 extreme)

# Per-axis scale error: +-3% uniform
ACCEL_SCALE_ERROR_MAX = 0.03
GYRO_SCALE_ERROR_MAX  = 0.02


def make_rng(seed):
    return np.random.default_rng(seed)


def sample_sensor_params(rng):
    """Draw per-run sensor imperfections (bias, scale error, orientation)."""
    accel_bias = np.array([
        rng.uniform(-ACCEL_BIAS_MAX_G[0], ACCEL_BIAS_MAX_G[0]),
        rng.uniform(-ACCEL_BIAS_MAX_G[1], ACCEL_BIAS_MAX_G[1]),
        rng.uniform(-ACCEL_BIAS_MAX_G[2], ACCEL_BIAS_MAX_G[2]),
    ])
    gyro_bias = rng.uniform(-GYRO_BIAS_MAX_DPS, GYRO_BIAS_MAX_DPS, size=3)
    accel_scale = 1.0 + rng.uniform(-ACCEL_SCALE_ERROR_MAX, ACCEL_SCALE_ERROR_MAX, size=3)
    gyro_scale  = 1.0 + rng.uniform(-GYRO_SCALE_ERROR_MAX,  GYRO_SCALE_ERROR_MAX,  size=3)

    # Random device orientation: 3D rotation matrix from a random unit quaternion
    q = rng.normal(size=4)
    q /= np.linalg.norm(q)
    R = quaternion_to_rotation(q)

    return {
        "accel_bias": accel_bias,
        "gyro_bias": gyro_bias,
        "accel_scale": accel_scale,
        "gyro_scale": gyro_scale,
        "R": R,           # world-to-sensor rotation matrix (3x3)
    }


def quaternion_to_rotation(q):
    """Convert unit quaternion [w, x, y, z] to 3x3 rotation matrix."""
    w, x, y, z = q
    return np.array([
        [1-2*(y**2+z**2), 2*(x*y-z*w),   2*(x*z+y*w)  ],
        [2*(x*y+z*w),     1-2*(x**2+z**2), 2*(y*z-x*w) ],
        [2*(x*z-y*w),     2*(y*z+x*w),   1-2*(x**2+y**2)],
    ])


def gravity_in_sensor_frame(R):
    """Return gravity vector (0, 0, 1) g rotated to sensor frame."""
    g_world = np.array([0.0, 0.0, 1.0])   # gravity in world = +Z up = -Z on sensor typically
    return R @ g_world   # gravity projection onto sensor axes


def apply_sensor_model(accel_g, gyro_dps, params, rng, n):
    """
    Apply sensor imperfections to ideal signals.
    accel_g, gyro_dps: np arrays shape (n, 3) in physical units
    Returns int16 raw arrays.
    """
    # Scale error
    accel_g   = accel_g   * params["accel_scale"]
    gyro_dps  = gyro_dps  * params["gyro_scale"]

    # Bias
    accel_g   = accel_g   + params["accel_bias"]
    gyro_dps  = gyro_dps  + params["gyro_bias"]

    # White noise
    accel_g   += rng.normal(0, ACCEL_NOISE_SIGMA_G,   size=(n, 3))
    gyro_dps  += rng.normal(0, GYRO_NOISE_SIGMA_DPS,  size=(n, 3))

    # Convert to raw counts
    accel_raw = (accel_g  * ACCEL_LSB_G).round().astype(np.int32)
    gyro_raw  = (gyro_dps * GYRO_LSB_DPS).round().astype(np.int32)

    # Hard clip (saturation)
    accel_raw = np.clip(accel_raw, ACCEL_MIN_RAW, ACCEL_MAX_RAW).astype(np.int16)
    gyro_raw  = np.clip(gyro_raw,  GYRO_MIN_RAW,  GYRO_MAX_RAW).astype(np.int16)

    return accel_raw, gyro_raw


# ============================================================
# SIGNAL PRIMITIVES
# ============================================================

def band_noise(rng, n, f_low, f_high, amplitude, fs=FS_HZ):
    """Band-limited noise via FFT masking."""
    white = rng.normal(0, 1, n)
    freqs = np.fft.rfftfreq(n, d=1.0/fs)
    X = np.fft.rfft(white)
    mask = (freqs >= f_low) & (freqs <= f_high)
    X[~mask] = 0.0
    sig = np.fft.irfft(X, n)
    if sig.std() > 0:
        sig = sig / sig.std() * amplitude
    return sig


def sinusoid(n, freq_hz, amplitude, phase=0.0, fs=FS_HZ):
    t = np.arange(n) / fs
    return amplitude * np.sin(2 * np.pi * freq_hz * t + phase)


def half_sine_pulse(n, peak_g, center_sample, half_width_samples, axis=0):
    """Add a half-sine pulse to a zeros array. Returns shape (n, 3)."""
    out = np.zeros((n, 3))
    for i in range(n):
        dist = abs(i - center_sample)
        if dist <= half_width_samples:
            out[i, axis] = peak_g * np.sin(np.pi * dist / half_width_samples)
    return out


def damped_sinusoid(n, peak_g, start_sample, freq_hz, decay_hz, axis, fs=FS_HZ):
    """Damped sinusoid (ringing) starting at start_sample."""
    out = np.zeros((n, 3))
    for i in range(start_sample, n):
        t = (i - start_sample) / fs
        out[i, axis] = peak_g * np.exp(-decay_hz * t) * np.sin(2 * np.pi * freq_hz * t)
    return out


# ============================================================
# CLASS GENERATORS
# ============================================================

def gen_normal(rng, params, n_samples, sub_type=None):
    """
    Class 0: normal
    Sub-types: stationary, carrying, vehicle_smooth, vehicle_rough
    """
    if sub_type is None:
        sub_type = rng.choice(["stationary", "carrying", "vehicle_smooth", "vehicle_rough"])

    grav = gravity_in_sensor_frame(params["R"])   # (3,) in g
    accel_g = np.tile(grav, (n_samples, 1))
    gyro_dps = np.zeros((n_samples, 3))

    if sub_type == "stationary":
        # Gravity + very small noise — no extra signal
        pass

    elif sub_type == "carrying":
        # Low-frequency sway: 0.5–3 Hz, 0.05–0.25 g amplitude
        sway_freq = rng.uniform(0.5, 3.0)
        sway_amp  = rng.uniform(0.05, 0.25)
        sway_axis = rng.integers(0, 3)
        accel_g[:, sway_axis] += sinusoid(n_samples, sway_freq, sway_amp, rng.uniform(0, 2*np.pi))
        gyro_dps += rng.normal(0, rng.uniform(5, 30), size=(n_samples, 3))
        # Occasional small bump (hard negative: < 2.4g magnitude)
        if rng.random() < 0.3:
            bump_t = rng.integers(20, n_samples-10)
            bump_axis = rng.integers(0, 3)
            bump_peak = rng.uniform(0.3, 1.2)
            accel_g[bump_t:bump_t+3, bump_axis] += bump_peak

    elif sub_type == "vehicle_smooth":
        # Band-limited vibration 5–30 Hz + a few sinusoids
        vibration_rms = rng.uniform(0.05, 0.25)   # g RMS
        vib = band_noise(rng, n_samples, 5, 30, vibration_rms)
        vib_axis = rng.integers(0, 3)
        accel_g[:, vib_axis] += vib
        # Axle harmonics
        for freq in rng.uniform(8, 25, size=2):
            amp = rng.uniform(0.02, 0.08)
            accel_g[:, vib_axis] += sinusoid(n_samples, freq, amp)
        gyro_dps += band_noise(rng, n_samples, 2, 20, rng.uniform(2, 15))[:, None]

    elif sub_type == "vehicle_rough":
        vibration_rms = rng.uniform(0.15, 0.50)
        vib_axis = rng.integers(0, 3)
        accel_g[:, vib_axis] += band_noise(rng, n_samples, 1, 40, vibration_rms)
        gyro_dps += band_noise(rng, n_samples, 1, 20, rng.uniform(5, 30))[:, None]

    return accel_g, gyro_dps


def gen_shock(rng, params, n_samples):
    """
    Class 1: shock — single hard impact, no free-fall phase.
    Peak: 2.5g – clipped 8g, varying axis, duration, waveform.
    """
    grav = gravity_in_sensor_frame(params["R"])
    accel_g = np.tile(grav, (n_samples, 1))
    gyro_dps = np.zeros((n_samples, 3))

    # Background: steady (optionally on vehicle)
    if rng.random() < 0.4:
        vib_rms = rng.uniform(0.03, 0.15)
        accel_g[:, rng.integers(0, 3)] += band_noise(rng, n_samples, 5, 30, vib_rms)

    # Impact parameters
    shock_axis = rng.integers(0, 3)
    peak_g     = rng.uniform(2.5, 8.0)   # g (will be clipped at 8g by sensor model)
    # At 125 Hz with 44 Hz DLPF, a sharp pulse spreads to ~3-6 samples
    half_width = rng.integers(2, 8)       # samples (equivalent to 16-64 ms after DLPF)
    center     = rng.integers(10, n_samples - 10)

    pulse = half_sine_pulse(n_samples, peak_g, center, half_width, axis=shock_axis)
    accel_g += pulse

    # Post-impact ringing: 5–25 Hz, decaying
    ring_freq  = rng.uniform(5, 25)
    ring_peak  = rng.uniform(0.2, 1.0)
    ring_decay = rng.uniform(5, 20)
    accel_g += damped_sinusoid(n_samples, ring_peak, center + half_width, ring_freq, ring_decay, shock_axis)

    # Gyro spike at impact
    gyro_peak = rng.uniform(50, 300)
    gyro_axis = rng.integers(0, 3)
    gyro_dps[center:center+half_width, gyro_axis] += gyro_peak * np.sin(
        np.pi * np.arange(half_width) / half_width)

    return accel_g, gyro_dps


def gen_drop(rng, params, n_samples):
    """
    Class 2: drop — free-fall phase (near 0g) then impact spike + ringing + settling.
    """
    grav = gravity_in_sensor_frame(params["R"])

    # Drop physics
    height = rng.uniform(0.10, 1.20)    # metres
    g_ms2  = 9.81
    fall_duration_s = np.sqrt(2 * height / g_ms2)
    fall_samples    = int(fall_duration_s * FS_HZ)
    fall_samples    = np.clip(fall_samples, 5, int(n_samples * 0.75))

    # Impact starts somewhere before end-of-window
    impact_start    = rng.integers(fall_samples, min(n_samples - 15, fall_samples + 20))

    accel_g  = np.zeros((n_samples, 3))
    gyro_dps = np.zeros((n_samples, 3))

    # --- Pre-fall phase: normal gravity ---
    pre_samples = max(0, n_samples - fall_samples - (n_samples - impact_start))
    if pre_samples > 0:
        accel_g[:pre_samples] = grav

    # --- Free-fall phase: near-zero g, tumbling ---
    fall_start = pre_samples
    fall_end   = fall_start + fall_samples
    fall_end   = min(fall_end, impact_start)
    if fall_end > fall_start:
        # Near-zero g: just sensor noise + very small residual (<0.3g)
        residual = rng.uniform(0.0, 0.25)   # slight air resistance
        for ax in range(3):
            accel_g[fall_start:fall_end, ax] = residual * grav[ax] / 3.0
        # Tumbling gyro
        tumble_rate = rng.uniform(50, 400)
        tumble_axis = rng.integers(0, 3)
        gyro_dps[fall_start:fall_end, tumble_axis] = tumble_rate

    # --- Impact ---
    surface = rng.choice(["concrete", "wood", "padded"])
    if surface == "concrete":
        peak_g     = rng.uniform(5.0, 8.0)   # will likely clip
        half_width = rng.integers(1, 3)
        ring_freq  = rng.uniform(50, 150)
        ring_decay = rng.uniform(20, 60)
    elif surface == "wood":
        peak_g     = rng.uniform(3.0, 7.0)
        half_width = rng.integers(2, 5)
        ring_freq  = rng.uniform(20, 80)
        ring_decay = rng.uniform(10, 40)
    else:   # padded
        peak_g     = rng.uniform(2.0, 5.0)
        half_width = rng.integers(3, 8)
        ring_freq  = rng.uniform(5, 30)
        ring_decay = rng.uniform(5, 20)

    impact_axis = rng.integers(0, 3)
    # Impact pulse
    for i in range(impact_start, min(impact_start + half_width*2, n_samples)):
        dist = abs(i - impact_start)
        if dist <= half_width:
            accel_g[i, impact_axis] += peak_g * np.sin(np.pi * dist / max(half_width, 1))

    # Post-impact ringing + settling
    if impact_start + half_width < n_samples:
        ring_start = impact_start + half_width
        ring_sig = damped_sinusoid(n_samples, rng.uniform(0.2, 1.5),
                                   ring_start, ring_freq, ring_decay, impact_axis)
        accel_g += ring_sig
        # Settle back to gravity
        for i in range(ring_start, n_samples):
            t = (i - ring_start) / FS_HZ
            alpha = np.exp(-3 * t)
            accel_g[i] = alpha * accel_g[i] + (1 - alpha) * grav

    # Gyro during fall and impact
    if impact_start < n_samples:
        gyro_peak = rng.uniform(100, 500)
        gyro_dps[impact_start:impact_start+3, rng.integers(0, 3)] += gyro_peak

    return accel_g, gyro_dps


def gen_rough_handling(rng, params, n_samples):
    """
    Class 3: rough_handling — multiple moderate jolts, tilt swings, sliding.
    """
    grav = gravity_in_sensor_frame(params["R"])
    accel_g  = np.tile(grav, (n_samples, 1))
    gyro_dps = np.zeros((n_samples, 3))

    # 2–5 moderate jolts
    n_jolts = rng.integers(2, 6)
    jolt_times = sorted(rng.integers(5, n_samples - 5, size=n_jolts).tolist())

    for jt in jolt_times:
        jolt_g    = rng.uniform(1.5, 4.0)   # moderate: 1.5–4g, below shock threshold
        jolt_axis = rng.integers(0, 3)
        jolt_hw   = rng.integers(2, 8)
        for i in range(max(0, jt - jolt_hw), min(n_samples, jt + jolt_hw)):
            dist = abs(i - jt)
            accel_g[i, jolt_axis] += jolt_g * np.sin(np.pi * dist / max(jolt_hw, 1))
        gyro_dps[jt:min(jt+5, n_samples), rng.integers(0, 3)] += rng.uniform(50, 200)

    # Large tilt swings (gyro-heavy)
    if rng.random() < 0.6:
        tilt_axis = rng.integers(0, 3)
        tilt_rate = rng.uniform(100, 400)
        tilt_start = rng.integers(0, n_samples//2)
        tilt_len   = rng.integers(10, 50)
        gyro_dps[tilt_start:tilt_start+tilt_len, tilt_axis] += tilt_rate

    # Background vibration
    if rng.random() < 0.5:
        accel_g[:, rng.integers(0, 3)] += band_noise(rng, n_samples, 1, 20,
                                                       rng.uniform(0.1, 0.3))

    return accel_g, gyro_dps


# ============================================================
# HARD NEGATIVES
# ============================================================

def gen_hard_negative_loud_vibration(rng, params, n_samples):
    """
    Hard negative for shock class: intense vibration that is NOT a shock.
    Returns class 0 (normal).
    """
    grav = gravity_in_sensor_frame(params["R"])
    accel_g = np.tile(grav, (n_samples, 1))
    gyro_dps = np.zeros((n_samples, 3))

    # Very loud, high-RMS road vibration (0.5–0.8g RMS) but no single spike > 2.5g
    vib_rms  = rng.uniform(0.4, 0.7)
    vib_axis = rng.integers(0, 3)
    accel_g[:, vib_axis] += band_noise(rng, n_samples, 2, 40, vib_rms)
    return accel_g, gyro_dps


def gen_hard_negative_hard_setdown(rng, params, n_samples):
    """
    Hard negative for drop class: hard set-down (no free-fall), peak 1.8–2.4g.
    Returns class 0 (normal).
    """
    grav = gravity_in_sensor_frame(params["R"])
    accel_g = np.tile(grav, (n_samples, 1))
    gyro_dps = np.zeros((n_samples, 3))

    hit_t    = rng.integers(20, n_samples - 20)
    peak_g   = rng.uniform(1.8, 2.3)
    hit_axis = rng.integers(0, 3)
    for i in range(hit_t, min(hit_t + 6, n_samples)):
        accel_g[i, hit_axis] += peak_g * np.sin(np.pi * (i - hit_t) / 6)
    return accel_g, gyro_dps


def gen_boundary_window(rng, params, n_samples, label_a, label_b):
    """
    Window where an event straddles the boundary.
    First half: class label_a, second half: class label_b.
    Returns (data, label_a) — labelled as the dominant class.
    """
    mid = n_samples // 2
    # Generate a short window for each
    if label_a == 0:
        a_acc, a_gyr = gen_normal(rng, params, n_samples)
    elif label_a == 1:
        a_acc, a_gyr = gen_shock(rng, params, n_samples)
    elif label_a == 2:
        a_acc, a_gyr = gen_drop(rng, params, n_samples)
    else:
        a_acc, a_gyr = gen_rough_handling(rng, params, n_samples)

    if label_b == 0:
        b_acc, b_gyr = gen_normal(rng, params, n_samples)
    elif label_b == 1:
        b_acc, b_gyr = gen_shock(rng, params, n_samples)
    elif label_b == 2:
        b_acc, b_gyr = gen_drop(rng, params, n_samples)
    else:
        b_acc, b_gyr = gen_rough_handling(rng, params, n_samples)

    acc = np.vstack([a_acc[:mid], b_acc[mid:]])
    gyr = np.vstack([a_gyr[:mid], b_gyr[mid:]])
    return acc, gyr, label_a   # label dominant first class


# ============================================================
# DATASET GENERATION
# ============================================================

def generate_run(run_seed, class_id, use_hard_negative=False, boundary=False):
    """Generate one simulated 'run' and return all windows from it."""
    rng = make_rng(run_seed)
    params = sample_sensor_params(rng)
    n_samples = WINDOW_SAMPLES * rng.integers(8, 20)  # 8–20 windows per run

    if boundary:
        other = rng.integers(0, 4)
        acc, gyr, label = gen_boundary_window(rng, params, n_samples, class_id, int(other))
    elif use_hard_negative and class_id == 0:
        hn_type = rng.choice(["loud_vib", "setdown"])
        if hn_type == "loud_vib":
            acc, gyr = gen_hard_negative_loud_vibration(rng, params, n_samples)
        else:
            acc, gyr = gen_hard_negative_hard_setdown(rng, params, n_samples)
        label = 0
    else:
        generators = [gen_normal, gen_shock, gen_drop, gen_rough_handling]
        acc, gyr = generators[class_id](rng, params, n_samples)
        label = class_id

    # Apply sensor model
    accel_raw, gyro_raw = apply_sensor_model(acc, gyr, params, rng, n_samples)

    # Slice into windows
    windows = []
    i = 0
    while i + WINDOW_SAMPLES <= n_samples:
        window_acc = accel_raw[i:i+WINDOW_SAMPLES]
        window_gyr = gyro_raw[i:i+WINDOW_SAMPLES]
        window_6ch = np.hstack([window_acc, window_gyr])  # (125, 6)
        windows.append((window_6ch, label))
        i += WINDOW_STEP
    return windows


def generate_dataset(seed, n_runs_per_class, output_dir):
    """Generate balanced dataset split by run (not by window)."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    rng_master = np.random.default_rng(seed)
    all_runs   = []   # list of (run_seed, class_id, use_hn, boundary)

    for class_id in range(4):
        for run_idx in range(n_runs_per_class):
            run_seed = int(rng_master.integers(0, 2**31))
            use_hn   = (class_id == 0 and rng_master.random() < 0.25)
            boundary = (rng_master.random() < 0.08)
            all_runs.append((run_seed, class_id, use_hn, boundary))

    # Shuffle run order for variety
    rng_master_py = random.Random(seed)
    rng_master_py.shuffle(all_runs)

    # Split runs: 70% train, 15% val, 15% test (by run, not by window)
    n_total = len(all_runs)
    n_train  = int(n_total * 0.70)
    n_val    = int(n_total * 0.15)
    splits = {
        "train": all_runs[:n_train],
        "val":   all_runs[n_train:n_train+n_val],
        "test":  all_runs[n_train+n_val:],
    }

    metadata = {"seed": seed, "n_runs_per_class": n_runs_per_class,
                 "fs_hz": FS_HZ, "window_samples": WINDOW_SAMPLES,
                 "window_step": WINDOW_STEP, "classes": ["normal","shock","drop","rough_handling"]}
    counts = {}

    for split_name, run_list in splits.items():
        X_list, y_list = [], []
        for (run_seed, class_id, use_hn, boundary) in run_list:
            windows = generate_run(run_seed, class_id, use_hn, boundary)
            for (win, label) in windows:
                X_list.append(win)
                y_list.append(label)

        X = np.array(X_list, dtype=np.int16)
        y = np.array(y_list, dtype=np.int8)
        np.save(output_dir / f"X_{split_name}.npy", X)
        np.save(output_dir / f"y_{split_name}.npy", y)
        counts[split_name] = {"total": len(y), "by_class": {
            str(c): int((y == c).sum()) for c in range(4)
        }}
        print(f"  {split_name}: {len(y)} windows  {counts[split_name]['by_class']}")

    metadata["counts"] = counts
    with open(output_dir / "config.json", "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nDataset saved to: {output_dir}/")
    return output_dir


# ============================================================
# SANITY CHECKS & PLOTS
# ============================================================

def sanity_check_and_plot(output_dir):
    """Load the dataset and produce diagnostic plots."""
    output_dir = Path(output_dir)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed — skipping plots")
        return

    X_train = np.load(output_dir / "X_train.npy")
    y_train = np.load(output_dir / "y_train.npy")

    classes = ["normal", "shock", "drop", "rough_handling"]
    fig, axes = plt.subplots(4, 2, figsize=(14, 16))
    fig.suptitle("Example 1-second windows (raw accel magnitude in g)", fontsize=14)

    for cls in range(4):
        idx = np.where(y_train == cls)[0]
        if len(idx) == 0:
            continue
        sample_win = X_train[idx[0]].astype(float)
        ax_s = sample_win[:, 0]
        ay_s = sample_win[:, 1]
        az_s = sample_win[:, 2]
        mag = np.sqrt(ax_s**2 + ay_s**2 + az_s**2) / ACCEL_LSB_G
        # Line plot
        axes[cls][0].plot(mag, color=f"C{cls}")
        axes[cls][0].set_title(f"Class {cls}: {classes[cls]} — accel magnitude (g)")
        axes[cls][0].set_xlabel("Sample (125 Hz)")
        axes[cls][0].set_ylabel("|a| (g)")
        axes[cls][0].axhline(2.5, color="red", linestyle="--", alpha=0.5, label="shock threshold")
        axes[cls][0].axhline(0.3, color="blue", linestyle="--", alpha=0.5, label="free-fall threshold")
        axes[cls][0].legend(fontsize=7)

        # Distribution across all windows
        all_peaks = []
        for win in X_train[idx[:200]]:
            win_f = win.astype(float)
            m = np.sqrt(win_f[:,0]**2 + win_f[:,1]**2 + win_f[:,2]**2) / ACCEL_LSB_G
            all_peaks.append(m.max())
        axes[cls][1].hist(all_peaks, bins=40, color=f"C{cls}", edgecolor="k", alpha=0.7)
        axes[cls][1].set_title(f"Class {cls}: peak |a| distribution")
        axes[cls][1].set_xlabel("Peak |a| (g)")
        axes[cls][1].set_ylabel("Count")
        axes[cls][1].axvline(2.5, color="red", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plot_path = output_dir / "example_windows.png"
    plt.savefig(plot_path, dpi=120)
    plt.close()
    print(f"  Plot saved: {plot_path}")

    # Sanity check values against PARAMETERS.md
    print("\n--- Sanity Checks ---")
    for cls in range(4):
        idx = np.where(y_train == cls)[0]
        if len(idx) == 0:
            continue
        peaks = []
        mins  = []
        for win in X_train[idx[:500]]:
            win_f = win.astype(float)
            mag = np.sqrt(win_f[:,0]**2 + win_f[:,1]**2 + win_f[:,2]**2) / ACCEL_LSB_G
            peaks.append(mag.max())
            mins.append(mag.min())
        print(f"  {classes[cls]:15s}  peak|a| mean={np.mean(peaks):.2f}g  "
              f"max={np.max(peaks):.2f}g  min|a| mean={np.mean(mins):.2f}g  "
              f"p5(min)={np.percentile(mins,5):.2f}g")


# ============================================================
# CLI
# ============================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic IMU dataset")
    parser.add_argument("--seed",    type=int, default=42)
    parser.add_argument("--n_runs",  type=int, default=125,
                        help="Runs per class (4 classes -> 4x this many runs). "
                             "125 -> ~25000+ windows total")
    parser.add_argument("--output",  type=str, default="dataset")
    parser.add_argument("--plot",    action="store_true")
    args = parser.parse_args()

    print(f"Generating dataset: seed={args.seed}, {args.n_runs} runs/class")
    out = generate_dataset(args.seed, args.n_runs, args.output)

    if args.plot:
        print("Generating sanity plots...")
        sanity_check_and_plot(out)
    print("Done.")
