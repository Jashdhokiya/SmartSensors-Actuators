// classifier.h — Phase 5: Non-blocking cargo classifier module
//
// Manages the IMU ring buffer and runs the Random Forest classifier
// once per second on a filled window.  The existing readMotionSensor()
// call and CargoReading struct are NOT touched.
//
// Architecture:
//   - A second, dedicated I2C read is triggered from loop() every 8 ms
//     (125 Hz) via classifierFeedSample(), completely independent of
//     the 1-second SENSOR_READ_INTERVAL_MS path.
//   - Once 125 samples are collected, classifyCurrentWindow() is called.
//   - Result stored in ClassifierResult, available via getClassifierResult().
//
// Memory budget:
//   - Ring buffer: 125 * 6 * 2 bytes = 1500 bytes
//   - Feature vector: 16 * 4 bytes = 64 bytes
//   - Model (RF header): ~10–30 KB flash (const, not RAM)
//   - Total RAM: ~2 KB — well within 8 KB feature-buffer budget.
//
// CONFIDENCE THRESHOLD: if max vote fraction < CONFIDENCE_THRESHOLD,
// the result is reported as class 4 ("uncertain").
//
#pragma once
#include <Arduino.h>
#include <Wire.h>
#include "config.h"

// ── Result structure ────────────────────────────────────────────────────
#define CLASS_NORMAL         0
#define CLASS_SHOCK          1
#define CLASS_DROP           2
#define CLASS_ROUGH_HANDLING 3
#define CLASS_UNCERTAIN      4   // below confidence threshold

static const char* const kClassLabels[] = {
    "normal", "shock", "drop", "rough_handling", "uncertain"
};

struct ClassifierResult {
    uint8_t  label;          // 0-3 (predicted class) or 4 (uncertain)
    float    confidence;     // vote fraction for top class (0.0 – 1.0)
    float    votes[4];       // per-class vote fractions
    uint32_t timestamp_ms;   // millis() when inference ran
    bool     valid;          // false until first full window collected
};

// ── Configuration ───────────────────────────────────────────────────────
// Min confidence fraction to report a class instead of "uncertain"
#define CLASSIFIER_CONFIDENCE_THRESHOLD   0.45f
// Sampling interval in ms: 1000 / 125 = 8 ms
#define CLASSIFIER_SAMPLE_INTERVAL_MS     8

// ── Public API ──────────────────────────────────────────────────────────

// Call once from setup() after initI2C()
void initClassifier();

// Call from loop() every iteration — internally rate-limits to 125 Hz.
// Reads MPU registers directly (second I2C read, independent of readMotionSensor).
void classifierFeedSample();

// Returns the latest classifier result (check .valid before using).
const ClassifierResult& getClassifierResult();

// Returns human-readable label string for a class id.
const char* classifierLabelStr(uint8_t label);

// ── Serial test mode ────────────────────────────────────────────────────
// Call classifierTestMode() from setup() to enter a replay loop.
// Reads 125*6 int16 values from Serial as CSV and runs inference,
// printing the result. Used to validate C++ vs. Python feature outputs.
void classifierTestMode();
