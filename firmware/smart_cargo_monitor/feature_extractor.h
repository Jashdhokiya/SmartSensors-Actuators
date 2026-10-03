// feature_extractor.h — Phase 5: ESP32 feature extraction
// C++ mirror of features.py — MUST produce identical float32 results.
// -----------------------------------------------------------------------
// All 16 features computed in-place from a (125 x 6) int16 ring buffer.
// No dynamic allocation. No division by zero. No trigonometry.
// Compiles under Arduino-ESP32 core with g++/xtensa-g++.
//
// IMPORTANT: Do NOT include Arduino.h here — this header is used both in
//            Arduino firmware and in the Serial test mode harness.
//
#pragma once
#include <stdint.h>
#include <math.h>

// ── Hardware constants (must match config.h) ────────────────────────────
static constexpr float FE_FS_HZ          = 125.0f;
static constexpr float FE_ACCEL_LSB_G    = 4096.0f;  // LSB per g  at +-8g
static constexpr float FE_GYRO_LSB_DPS   = 65.5f;    // LSB per dps at +-500 dps
static constexpr int   FE_WINDOW_SAMPLES = 125;
static constexpr int   FE_NUM_FEATURES   = 16;

// ── Feature thresholds ──────────────────────────────────────────────────
static constexpr float FE_FREE_FALL_THRESH_G = 0.30f;
static constexpr float FE_SHOCK_THRESH_G     = 2.50f;

// ── Feature index labels (for readability) ──────────────────────────────
enum FeatureIndex : uint8_t {
    FI_ACCEL_PEAK_G       = 0,
    FI_ACCEL_RMS_G        = 1,
    FI_ACCEL_MIN_G        = 2,
    FI_FREE_FALL_RATIO    = 3,
    FI_JERK_PEAK_G_PER_S  = 4,
    FI_ACCEL_STD_X        = 5,
    FI_ACCEL_STD_Y        = 6,
    FI_ACCEL_STD_Z        = 7,
    FI_GYRO_ENERGY        = 8,
    FI_GYRO_PEAK          = 9,
    FI_ZERO_CROSS_RATE    = 10,
    FI_IMPULSE_COUNT      = 11,
    FI_SKEWNESS_MAG       = 12,
    FI_KURTOSIS_MAG       = 13,
    FI_ACCEL_IQR_G        = 14,
    FI_GYRO_STD           = 15,
};

extern const char* const kFeatureNames[FE_NUM_FEATURES];

// ────────────────────────────────────────────────────────────────────────
// extractFeatures()
//   window[s][ch]: ch=0..5 = ax,ay,az,gx,gy,gz  (int16, raw MPU counts)
//   out[FE_NUM_FEATURES]: float32 features (output)
// ────────────────────────────────────────────────────────────────────────
void extractFeatures(const int16_t window[FE_WINDOW_SAMPLES][6],
                     float out[FE_NUM_FEATURES]);
