/*
  Smart In-Transit Cargo Monitoring System
  ESP32 DevKit (NEO-6M GPS + MPU-6050 Motion + On-Device Predictive Engine + MQTT)

  Libraries Required:
    - TinyGPSPlus (by Mikal Hart)
    - ArduinoJson (v6.x)
    - PubSubClient (by Nick O'Leary)
*/

#include "config.h"
#include "types.h"
#include "mpu6050_sensor.h"
#include "gps_tracker.h"
#include "env_sensors.h"           // DHT11 Temp/Humidity & LDR Light/Tamper
#include "predictive_engine.h"
#include "telemetry_publisher.h"
#include "classifier.h"            // TinyML shock/handling classifier (Phase 5)

static CargoReading currentReading;
static unsigned long lastSensorPoll = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=======================================================");
  Serial.println("  Smart Cargo Monitor — ESP32 Modular Firmware Boot");
  Serial.println("=======================================================");

  // 1. Initialize Motion Sensor (MPU-6050 over I2C)
  initI2C();

  // 2. Initialize Geolocation (NEO-6M GPS over UART2)
  initGPS();

  // 3. Initialize Environmental Sensors (DHT11 & LDR)
  initEnvSensors();

  // 4. Initialize Predictive Math Engine
  initPredictiveEngine();

  // 5. Initialize WiFi & Cloud MQTT Client
  initNetworking();

  // 6. Initialize TinyML Cargo Classifier (ring-buffer + RF model)
  initClassifier();

  Serial.println("=== Initialization complete. Telemetry streaming active. ===\n");
}

void loop() {
  // Feed GPS byte stream continuously from UART FIFO buffer
  feedGPS();

  // Maintain WiFi & MQTT heartbeat
  maintainNetworkConnections();

  // Feed classifier ring buffer at 125 Hz (non-blocking, rate-limited internally)
  classifierFeedSample();

  // Periodic sensor sampling, evaluation, and telemetry publishing
  unsigned long now = millis();
  if (now - lastSensorPoll >= SENSOR_READ_INTERVAL_MS) {
    lastSensorPoll = now;

    // A. Read Hardware Sensors
    readMotionSensor(currentReading);
    readGPSData(currentReading);
    readEnvSensors(currentReading);

    // B. Reactive Alerts Evaluation
    currentReading.alertActive = false;
    currentReading.alertReason = "";
    if (currentReading.shockDetected) {
      currentReading.alertActive = true;
      currentReading.alertReason += "[SHOCK DETECTED] ";
    }
    if (currentReading.tiltExceeded) {
      currentReading.alertActive = true;
      currentReading.alertReason += "[EXCESSIVE TILT] ";
    }
    if (currentReading.tempExceeded) {
      currentReading.alertActive = true;
      currentReading.alertReason += "[TEMP EXCEEDED] ";
    }
    if (currentReading.humidityExceeded) {
      currentReading.alertActive = true;
      currentReading.alertReason += "[HUMIDITY EXCEEDED] ";
    }
    if (currentReading.lightTamperAlert) {
      currentReading.alertActive = true;
      currentReading.alertReason += "[BOX OPEN / TAMPER ALERT] ";
    }

    // C. Predictive Trend Fitting (Least-Squares Regression)
    updatePredictiveLayer(currentReading);

    // D. Output to Serial Monitor & Publish to MQTT Broker
    printReadingToSerial(currentReading);
    printPredictionsToSerial();
    publishTelemetry(currentReading);
  }
}

