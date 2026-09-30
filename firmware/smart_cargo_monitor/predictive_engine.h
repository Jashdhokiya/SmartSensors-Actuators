#ifndef PREDICTIVE_ENGINE_H
#define PREDICTIVE_ENGINE_H

#include <Arduino.h>
#include "config.h"
#include "types.h"

// Initialize trend channels
void initPredictiveEngine();

// Trend fitting & math functions
void trendPushSample(TrendChannel &ch, float value, uint32_t nowMs);
void trendFit(TrendChannel &ch);
long trendSecondsToBreach(const TrendChannel &ch, float limit, int direction);
String formatDuration(long totalSeconds);

// Per-cycle update function for all monitored channels
void updatePredictiveLayer(const CargoReading &reading);

// Channel accessors
const TrendChannel& getShockTrend();
const TrendChannel& getTempTrend();
const TrendChannel& getHumidityTrend();
const TrendChannel& getBatteryTrend();
float getShockExposureAccumulator();

#endif // PREDICTIVE_ENGINE_H
