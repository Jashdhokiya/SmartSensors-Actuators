#ifndef GPS_TRACKER_H
#define GPS_TRACKER_H

#include <Arduino.h>
#include <TinyGPSPlus.h>
#include "config.h"
#include "types.h"

// Initialize Hardware UART2 for GPS communication
void initGPS();

// Process incoming NMEA stream within time budget
void feedGPS();

// Extract coordinates, speed, altitude, satellite count, and UTC timestamp
void readGPSData(CargoReading &reading);

// Diagnostics helper
uint32_t getGPSCharsProcessed();
uint32_t getGPSSentencesWithFix();

#endif // GPS_TRACKER_H
