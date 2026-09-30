#ifndef TYPES_H
#define TYPES_H

#include <Arduino.h>
#include "config.h"

// ---------------------------------------------------------------------------
// TELEMETRY SNAPSHOT STRUCTURE
// ---------------------------------------------------------------------------
struct CargoReading {
  // Motion / IMU Data (MPU-6050)
  float accelX_g;
  float accelY_g;
  float accelZ_g;
  float gyroX_dps;
  float gyroY_dps;
  float gyroZ_dps;
  float accelMagnitude_g;
  float tiltAngleDeg;
  bool  shockDetected;
  bool  tiltExceeded;

  // GPS Data (NEO-6M)
  bool   gpsFixValid;
  double latitude;
  double longitude;
  double speedKmph;
  double altitudeMeters;
  int    satellites;
  float  hdop;
  String timestamp;

  // Alert State
  bool   alertActive;
  String alertReason;
};

// ---------------------------------------------------------------------------
// PREDICTIVE TREND CHANNEL STRUCTURE
// ---------------------------------------------------------------------------
struct TrendChannel {
  float    samples[PREDICTION_WINDOW_SIZE];
  uint32_t sampleTimesMs[PREDICTION_WINDOW_SIZE]; // millis() timestamp per sample
  uint8_t  count;       // Count of samples held (0 to PREDICTION_WINDOW_SIZE)
  uint8_t  writeIndex;  // Circular buffer write cursor

  // Least-Squares Regression Results
  float    slopePerSec;      // Rate of change in units/sec
  float    interceptValue;   // Current fitted level
  bool     trendValid;       // True once PREDICTION_MIN_SAMPLES is reached
};

#endif // TYPES_H
