#include "predictive_engine.h"
#include <math.h>

static TrendChannel tempTrend;
static TrendChannel humidityTrend;
static TrendChannel shockExposureTrend;
static TrendChannel batteryTrend;

static float shockExposureAccumulator = 0.0f;

void initPredictiveEngine() {
  memset(&tempTrend, 0, sizeof(TrendChannel));
  memset(&humidityTrend, 0, sizeof(TrendChannel));
  memset(&shockExposureTrend, 0, sizeof(TrendChannel));
  memset(&batteryTrend, 0, sizeof(TrendChannel));
  shockExposureAccumulator = 0.0f;
}

void trendPushSample(TrendChannel &ch, float value, uint32_t nowMs) {
  ch.samples[ch.writeIndex] = value;
  ch.sampleTimesMs[ch.writeIndex] = nowMs;
  ch.writeIndex = (ch.writeIndex + 1) % PREDICTION_WINDOW_SIZE;
  if (ch.count < PREDICTION_WINDOW_SIZE) ch.count++;
}

void trendFit(TrendChannel &ch) {
  if (ch.count < PREDICTION_MIN_SAMPLES) {
    ch.trendValid = false;
    return;
  }

  uint8_t startIdx = (ch.count < PREDICTION_WINDOW_SIZE)
                        ? 0
                        : ch.writeIndex; // Oldest sample when circular buffer is full
  uint32_t t0 = ch.sampleTimesMs[startIdx];

  double sumT = 0, sumV = 0, sumTT = 0, sumTV = 0;
  for (uint8_t i = 0; i < ch.count; i++) {
    uint8_t idx = (startIdx + i) % PREDICTION_WINDOW_SIZE;
    double t = (ch.sampleTimesMs[idx] - t0) / 1000.0; // Seconds relative to t0
    double v = ch.samples[idx];
    sumT  += t;
    sumV  += v;
    sumTT += t * t;
    sumTV += t * v;
  }

  double n = ch.count;
  double denom = (n * sumTT - sumT * sumT);
  if (fabs(denom) < 1e-6) {
    ch.trendValid = false;
    return;
  }

  double slope = (n * sumTV - sumT * sumV) / denom;
  double meanT = sumT / n;
  double meanV = sumV / n;
  double intercept = meanV - slope * meanT;

  ch.slopePerSec = (float)slope;
  double tNow = (millis() - t0) / 1000.0;
  ch.interceptValue = (float)(intercept + slope * tNow);
  ch.trendValid = true;
}

long trendSecondsToBreach(const TrendChannel &ch, float limit, int direction) {
  if (!ch.trendValid) return -1;

  float effectiveSlope = ch.slopePerSec * direction;
  if (effectiveSlope <= 0.0001f) {
    return -1; // Safe trend or moving away from breach limit
  }

  float distanceToLimit = (limit - ch.interceptValue) * direction;
  if (distanceToLimit <= 0) {
    return 0; // Already breached
  }

  double secondsToBreach = distanceToLimit / effectiveSlope;
  if (secondsToBreach > 1e7) return -1;
  return (long)secondsToBreach;
}

String formatDuration(long totalSeconds) {
  if (totalSeconds < 0) return "N/A";
  if (totalSeconds < 60) return String(totalSeconds) + "s";
  long minutes = totalSeconds / 60;
  if (minutes < 60) return String(minutes) + "m";
  long hours = minutes / 60;
  minutes = minutes % 60;
  return String(hours) + "h " + String(minutes) + "m";
}

void updatePredictiveLayer(const CargoReading &reading) {
  uint32_t now = millis();

  // Channel 1: Cumulative Shock / Vibration Exposure
  float excess = reading.accelMagnitude_g - SHOCK_MEANINGFUL_G;
  if (excess > 0) {
    shockExposureAccumulator += excess;
  }
  trendPushSample(shockExposureTrend, shockExposureAccumulator, now);
  trendFit(shockExposureTrend);

  // Channel 2: Temperature (DHT11)
  trendPushSample(tempTrend, reading.temperature_c, now);
  trendFit(tempTrend);

  // Channel 3: Humidity (DHT11)
  trendPushSample(humidityTrend, reading.humidity_pct, now);
  trendFit(humidityTrend);

  // Channel 4: Battery Voltage (Wire INA219 or ADC divider here)
  // Example:
  // float batV = readBatteryVoltage();
  // trendPushSample(batteryTrend, batV, now);
  // trendFit(batteryTrend);
}

const TrendChannel& getShockTrend() { return shockExposureTrend; }
const TrendChannel& getTempTrend() { return tempTrend; }
const TrendChannel& getHumidityTrend() { return humidityTrend; }
const TrendChannel& getBatteryTrend() { return batteryTrend; }
float getShockExposureAccumulator() { return shockExposureAccumulator; }
