// feature_extractor.cpp — Phase 5: ESP32 feature extraction implementation
// C++ mirror of features.py — DO NOT change without updating features.py.
//
// No Arduino.h dependency. Pure arithmetic, sqrtf, fabsf only.
// Benchmarked target: < 2 ms on ESP32 at 240 MHz (estimated ~0.5 ms).
//
#include "feature_extractor.h"

// ── Feature name strings (for Serial debug output) ──────────────────────
const char* const kFeatureNames[FE_NUM_FEATURES] = {
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
};

// ────────────────────────────────────────────────────────────────────────
// Utility: integer sort of N values (for IQR computation)
// Uses insertion sort — N=125 worst case ~7750 comparisons; fast enough.
// ────────────────────────────────────────────────────────────────────────
static void insertion_sort(float* arr, int n) {
    for (int i = 1; i < n; i++) {
        float key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j+1] = arr[j];
            j--;
        }
        arr[j+1] = key;
    }
}

// ────────────────────────────────────────────────────────────────────────
// Main feature extraction
// ────────────────────────────────────────────────────────────────────────
void extractFeatures(const int16_t window[FE_WINDOW_SAMPLES][6],
                     float out[FE_NUM_FEATURES])
{
    const int N = FE_WINDOW_SAMPLES;  // 125

    // ── Step 1: Convert to physical units ─────────────────────────────
    // Using float arrays on stack: 125 * 7 floats = 875 * 4 = 3500 bytes
    // This is within the 8 KB feature buffer budget.
    float ax[N], ay[N], az[N];
    float gx[N], gy[N], gz[N];
    float accel_mag[N];
    float gyro_mag[N];

    const float inv_accel = 1.0f / FE_ACCEL_LSB_G;
    const float inv_gyro  = 1.0f / FE_GYRO_LSB_DPS;

    for (int i = 0; i < N; i++) {
        ax[i] = window[i][0] * inv_accel;
        ay[i] = window[i][1] * inv_accel;
        az[i] = window[i][2] * inv_accel;
        gx[i] = window[i][3] * inv_gyro;
        gy[i] = window[i][4] * inv_gyro;
        gz[i] = window[i][5] * inv_gyro;

        accel_mag[i] = sqrtf(ax[i]*ax[i] + ay[i]*ay[i] + az[i]*az[i]);
        gyro_mag[i]  = sqrtf(gx[i]*gx[i] + gy[i]*gy[i] + gz[i]*gz[i]);
    }

    // ── Step 2: Accel magnitude statistics ────────────────────────────
    float a_peak = accel_mag[0];
    float a_min  = accel_mag[0];
    float a_sum  = 0.0f;
    float a_sum2 = 0.0f;
    float ff_count = 0.0f;
    float imp_count = 0.0f;

    for (int i = 0; i < N; i++) {
        float m = accel_mag[i];
        if (m > a_peak) a_peak = m;
        if (m < a_min)  a_min  = m;
        a_sum  += m;
        a_sum2 += m * m;
        if (m < FE_FREE_FALL_THRESH_G) ff_count  += 1.0f;
        if (m > FE_SHOCK_THRESH_G)     imp_count += 1.0f;
    }
    float a_mean = a_sum / N;
    float a_rms  = sqrtf(a_sum2 / N);

    // ── Step 3: Jerk peak ─────────────────────────────────────────────
    float jerk_peak = 0.0f;
    for (int i = 1; i < N; i++) {
        float j = fabsf(accel_mag[i] - accel_mag[i-1]) * FE_FS_HZ;
        if (j > jerk_peak) jerk_peak = j;
    }

    // ── Step 4: Per-axis standard deviations ──────────────────────────
    float sx = 0.0f, sy = 0.0f, sz = 0.0f;
    float mx = 0.0f, my = 0.0f, mz = 0.0f;
    for (int i = 0; i < N; i++) { mx += ax[i]; my += ay[i]; mz += az[i]; }
    mx /= N; my /= N; mz /= N;
    for (int i = 0; i < N; i++) {
        sx += (ax[i]-mx)*(ax[i]-mx);
        sy += (ay[i]-my)*(ay[i]-my);
        sz += (az[i]-mz)*(az[i]-mz);
    }
    float std_x = sqrtf(sx / N);
    float std_y = sqrtf(sy / N);
    float std_z = sqrtf(sz / N);

    // ── Step 5: Gyro statistics ───────────────────────────────────────
    float g_sum2 = 0.0f, g_peak = 0.0f, g_mean = 0.0f;
    for (int i = 0; i < N; i++) {
        g_sum2 += gyro_mag[i] * gyro_mag[i];
        g_mean += gyro_mag[i];
        if (gyro_mag[i] > g_peak) g_peak = gyro_mag[i];
    }
    float gyro_rms = sqrtf(g_sum2 / N);
    g_mean /= N;
    float g_var = 0.0f;
    for (int i = 0; i < N; i++) {
        float d = gyro_mag[i] - g_mean;
        g_var += d * d;
    }
    float gyro_std_val = sqrtf(g_var / N);

    // ── Step 6: Zero-crossing rate of (accel_mag - 1.0g) ─────────────
    float zcr = 0.0f;
    {
        // sign(accel_mag[i] - 1.0) — count sign changes
        int prev_sign = (accel_mag[0] >= 1.0f) ? 1 : -1;
        for (int i = 1; i < N; i++) {
            int s = (accel_mag[i] >= 1.0f) ? 1 : -1;
            if (s != prev_sign) zcr += 1.0f;
            prev_sign = s;
        }
        zcr /= (float)(N - 1);
    }

    // ── Step 7: Skewness and kurtosis of accel magnitude ──────────────
    float a_sigma = sqrtf(a_sum2/N - a_mean*a_mean);
    float skew = 0.0f, kurt = 0.0f;
    if (a_sigma > 1e-6f) {
        float inv_sig = 1.0f / a_sigma;
        for (int i = 0; i < N; i++) {
            float z = (accel_mag[i] - a_mean) * inv_sig;
            float z2 = z * z;
            skew += z2 * z;
            kurt += z2 * z2;
        }
        skew /= N;
        kurt  = kurt / N - 3.0f;   // excess kurtosis
    }

    // ── Step 8: IQR of accel magnitude ───────────────────────────────
    // Sort a copy of accel_mag (stack copy: 125 * 4 = 500 bytes)
    float sorted_mag[N];
    for (int i = 0; i < N; i++) sorted_mag[i] = accel_mag[i];
    insertion_sort(sorted_mag, N);
    // Q25 index = N/4 = 31, Q75 index = 3*N/4 = 93
    float q25 = sorted_mag[N / 4];
    float q75 = sorted_mag[(3 * N) / 4];
    float iqr  = q75 - q25;

    // ── Step 9: Assemble output ───────────────────────────────────────
    out[FI_ACCEL_PEAK_G]      = a_peak;
    out[FI_ACCEL_RMS_G]       = a_rms;
    out[FI_ACCEL_MIN_G]       = a_min;
    out[FI_FREE_FALL_RATIO]   = ff_count / (float)N;
    out[FI_JERK_PEAK_G_PER_S] = jerk_peak;
    out[FI_ACCEL_STD_X]       = std_x;
    out[FI_ACCEL_STD_Y]       = std_y;
    out[FI_ACCEL_STD_Z]       = std_z;
    out[FI_GYRO_ENERGY]       = gyro_rms;
    out[FI_GYRO_PEAK]         = g_peak;
    out[FI_ZERO_CROSS_RATE]   = zcr;
    out[FI_IMPULSE_COUNT]     = imp_count;
    out[FI_SKEWNESS_MAG]      = skew;
    out[FI_KURTOSIS_MAG]      = kurt;
    out[FI_ACCEL_IQR_G]       = iqr;
    out[FI_GYRO_STD]          = gyro_std_val;
}
