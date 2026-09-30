#ifndef TELEMETRY_PUBLISHER_H
#define TELEMETRY_PUBLISHER_H

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "types.h"
#include "predictive_engine.h"

// Networking & MQTT lifecycle
void initNetworking();
void maintainNetworkConnections();
bool publishTelemetry(const CargoReading &reading);

// JSON Serialization
String buildJSONPayload(const CargoReading &reading);

// Serial Debug Printers
void printReadingToSerial(const CargoReading &reading);
void printPredictionsToSerial();

#endif // TELEMETRY_PUBLISHER_H
