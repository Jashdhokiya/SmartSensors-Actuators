#include "telemetry_publisher.h"
#include "mpu6050_sensor.h"
#include "gps_tracker.h"
#include "classifier.h"            // TinyML classifier result

static WiFiClient espClient;
static PubSubClient mqttClient(espClient);
static uint32_t s_sequence_num = 0;  // Monotonic message counter for gap detection

void initNetworking() {
  if (String(DEFAULT_WIFI_SSID) == "YOUR_WIFI_SSID") {
    Serial.println("[WIFI] Note: Update WIFI_SSID & WIFI_PASSWORD in config.h to connect to cloud broker.");
    return;
  }

  Serial.printf("\n[WIFI] Connecting to %s...", DEFAULT_WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASSWORD);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! Assigned IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection pending/timeout. Will auto-retry in background.");
  }

  mqttClient.setServer(DEFAULT_MQTT_SERVER, DEFAULT_MQTT_PORT);
  mqttClient.setBufferSize(1536);  // Increased from 1024 to prevent truncation with classification payload
}

void maintainNetworkConnections() {
  if (WiFi.status() != WL_CONNECTED) return;

  if (!mqttClient.connected()) {
    static unsigned long lastAttempt = 0;
    if (millis() - lastAttempt > 5000) {
      lastAttempt = millis();
      Serial.printf("[MQTT] Connecting to broker %s:%d...\n", DEFAULT_MQTT_SERVER, DEFAULT_MQTT_PORT);

      // Connect with auth + LWT for offline detection
      bool connected = false;
      const char* user = (strlen(MQTT_USERNAME) > 0) ? MQTT_USERNAME : nullptr;
      const char* pass = (strlen(MQTT_PASSWORD) > 0) ? MQTT_PASSWORD : nullptr;
      if (user) {
        connected = mqttClient.connect(
          DEFAULT_MQTT_CLIENT_ID, user, pass,
          MQTT_LWT_TOPIC, MQTT_LWT_QOS, MQTT_LWT_RETAIN, MQTT_LWT_MESSAGE
        );
      } else {
        connected = mqttClient.connect(
          DEFAULT_MQTT_CLIENT_ID,
          nullptr, nullptr,
          MQTT_LWT_TOPIC, MQTT_LWT_QOS, MQTT_LWT_RETAIN, MQTT_LWT_MESSAGE
        );
      }

      if (connected) {
        Serial.println("[MQTT] Connected to cloud broker successfully!");
        // Publish online status (retained) so backend knows device is alive
        String onlineMsg = String("{\"device_id\":\"") + DEVICE_ID + String("\",\"status\":\"online\"}");
        mqttClient.publish(MQTT_LWT_TOPIC, onlineMsg.c_str(), true);  // retained
      } else {
        Serial.printf("[MQTT] Connection failed (rc=%d). Retrying in 5s...\n", mqttClient.state());
      }
    }
  } else {
    mqttClient.loop();
  }
}

String buildJSONPayload(const CargoReading &reading) {
  StaticJsonDocument<1536> doc;

  doc["device_id"] = DEVICE_ID;
  doc["timestamp_ms"] = millis();
  doc["seq"] = s_sequence_num++;  // Monotonic sequence for gap detection

  JsonObject motion = doc.createNestedObject("motion");
  motion["accel_x_g"] = reading.accelX_g;
  motion["accel_y_g"] = reading.accelY_g;
  motion["accel_z_g"] = reading.accelZ_g;
  motion["accel_magnitude_g"] = reading.accelMagnitude_g;
  motion["tilt_deg"] = reading.tiltAngleDeg;
  motion["shock_detected"] = reading.shockDetected;
  motion["tilt_exceeded"] = reading.tiltExceeded;

  JsonObject location = doc.createNestedObject("gps");
  location["fix_valid"] = reading.gpsFixValid;
  location["latitude"] = reading.latitude;
  location["longitude"] = reading.longitude;
  location["speed_kmph"] = reading.speedKmph;
  location["altitude_m"] = reading.altitudeMeters;
  location["satellites"] = reading.satellites;
  location["timestamp_utc"] = reading.timestamp;

  JsonObject environment = doc.createNestedObject("environment");
  environment["temperature_c"] = reading.temperature_c;
  environment["humidity_pct"] = reading.humidity_pct;
  environment["light_raw"] = reading.lightRaw;
  environment["light_tamper"] = reading.lightTamperAlert;
  environment["temp_exceeded"] = reading.tempExceeded;
  environment["humidity_exceeded"] = reading.humidityExceeded;

  doc["alert_active"] = reading.alertActive;
  doc["alert_reason"] = reading.alertReason;

  // Predictive Layer Payload
  const TrendChannel &shockTrend = getShockTrend();
  const TrendChannel &tempTrend = getTempTrend();
  const TrendChannel &humTrend = getHumidityTrend();
  const TrendChannel &batTrend = getBatteryTrend();

  JsonObject predictions = doc.createNestedObject("predictions");

  JsonObject shockPred = predictions.createNestedObject("shock_exposure");
  shockPred["valid"] = shockTrend.trendValid;
  shockPred["current_total"] = getShockExposureAccumulator();
  shockPred["budget"] = SHOCK_EXPOSURE_BUDGET;
  shockPred["rate_per_sec"] = shockTrend.slopePerSec;
  shockPred["seconds_to_breach"] = shockTrend.trendValid
      ? trendSecondsToBreach(shockTrend, SHOCK_EXPOSURE_BUDGET, +1) : -1;

  JsonObject tempPred = predictions.createNestedObject("temperature");
  tempPred["valid"] = tempTrend.trendValid;
  tempPred["rate_c_per_min"] = tempTrend.slopePerSec * 60.0f;
  tempPred["seconds_to_breach"] = tempTrend.trendValid
      ? trendSecondsToBreach(tempTrend, TEMP_SAFE_MAX_C, +1) : -1;

  JsonObject humPred = predictions.createNestedObject("humidity");
  humPred["valid"] = humTrend.trendValid;
  humPred["rate_pct_per_min"] = humTrend.slopePerSec * 60.0f;
  humPred["seconds_to_breach"] = humTrend.trendValid
      ? trendSecondsToBreach(humTrend, HUMIDITY_SAFE_MAX_PCT, +1) : -1;

  JsonObject batPred = predictions.createNestedObject("battery");
  batPred["valid"] = batTrend.trendValid;
  batPred["rate_v_per_hr"] = batTrend.slopePerSec * 3600.0f;
  batPred["seconds_to_empty"] = batTrend.trendValid
      ? trendSecondsToBreach(batTrend, BATTERY_SAFE_MIN_V, -1) : -1;

  // TinyML Classifier Output (Phase 5)
  // Edge-threshold alerts above fire independently regardless of this block.
  const ClassifierResult& clf = getClassifierResult();
  JsonObject classification = doc.createNestedObject("classification");
  classification["valid"]      = clf.valid;
  classification["label"]      = clf.valid ? classifierLabelStr(clf.label) : "pending";
  classification["label_id"]   = clf.valid ? (int)clf.label : -1;
  classification["confidence"] = clf.valid ? clf.confidence : 0.0f;
  JsonArray clf_votes = classification.createNestedArray("votes");
  if (clf.valid) {
    clf_votes.add(clf.votes[0]);  // normal
    clf_votes.add(clf.votes[1]);  // shock
    clf_votes.add(clf.votes[2]);  // drop
    clf_votes.add(clf.votes[3]);  // rough_handling
  }

  String output;
  serializeJson(doc, output);
  return output;
}

bool publishTelemetry(const CargoReading &reading) {
  if (mqttClient.connected()) {
    String payload = buildJSONPayload(reading);
    boolean ok = mqttClient.publish(DEFAULT_MQTT_TOPIC, payload.c_str(), MQTT_TELEMETRY_QOS);
    if (ok) {
      Serial.printf("[MQTT PUB OK] Sent %u bytes to '%s'\n", payload.length(), DEFAULT_MQTT_TOPIC);
      return true;
    } else {
      Serial.println("[MQTT PUB FAIL] Transport or buffer error.");
    }
  }
  return false;
}

void printReadingToSerial(const CargoReading &reading) {
  Serial.println("--------------------------------------------------------------------------------");
  
  if (isMPUDetected()) {
    Serial.printf("Motion | Accel (g): X=%+0.2f Y=%+0.2f Z=%+0.2f | Mag: %0.2f g %s\n",
                   reading.accelX_g, reading.accelY_g, reading.accelZ_g,
                   reading.accelMagnitude_g,
                   reading.shockDetected ? ">>> [SHOCK ALERT!] <<<" : "");
    Serial.printf("Tilt   | Angle: %0.1f° %s | Gyro: X=%+0.1f Y=%+0.1f Z=%+0.1f °/s\n",
                   reading.tiltAngleDeg,
                   reading.tiltExceeded ? ">>> [TILT EXCEEDED!] <<<" : "",
                   reading.gyroX_dps, reading.gyroY_dps, reading.gyroZ_dps);
  } else {
    Serial.println("Motion | [OFFLINE] MPU-6050 not detected. Check SDA (21) / SCL (22).");
  }

  if (reading.gpsFixValid) {
    Serial.printf("GPS    | [FIX LOCKED] Sats: %d | HDOP: %.2f | Lat: %.6f | Lon: %.6f | Speed: %.1f km/h\n",
                   reading.satellites, reading.hdop,
                   reading.latitude, reading.longitude, reading.speedKmph);
    Serial.printf("Time   | %s | Altitude: %.1f m\n",
                   reading.timestamp.c_str(), reading.altitudeMeters);
  } else {
    if (getGPSCharsProcessed() == 0) {
      Serial.println("GPS    | [NO DATA] 0 bytes received. Verify GPS TX -> ESP32 GPIO 16 & VCC -> 5V.");
    } else {
      Serial.printf("GPS    | [SEARCHING SATELLITES] Ingested %u bytes (Fix sentences: %u). Visible sats: %d\n",
                     getGPSCharsProcessed(), getGPSSentencesWithFix(), reading.satellites);
      Serial.println("       -> Place antenna near window or outdoors (takes ~1-3 mins for initial fix).");
    }
  }

  Serial.printf("Env    | Temp: %0.1f°C %s | Hum: %0.1f%% %s | Light: %d ADC %s\n",
                 reading.temperature_c,
                 reading.tempExceeded ? ">>> [TEMP EXCEEDED!] <<<" : "",
                 reading.humidity_pct,
                 reading.humidityExceeded ? ">>> [HUMIDITY EXCEEDED!] <<<" : "",
                 reading.lightRaw,
                 reading.lightTamperAlert ? ">>> [BOX OPEN/TAMPER DETECTED!] <<<" : "");

  if (reading.alertActive) {
    Serial.printf("Status | *** CRITICAL ALERT: %s ***\n", reading.alertReason.c_str());
  } else if (!isMPUDetected()) {
    Serial.println("Status | Sensor offline - check I2C lines");
  } else {
    Serial.println("Status | Normal (System Active)");
  }
}

void printPredictionsToSerial() {
  Serial.println("Predict| ---------------- Predictive Layer ----------------");

  const TrendChannel &shockTrend = getShockTrend();
  const TrendChannel &tempTrend = getTempTrend();
  const TrendChannel &humTrend = getHumidityTrend();
  const TrendChannel &batTrend = getBatteryTrend();

  if (shockTrend.trendValid) {
    long secs = trendSecondsToBreach(shockTrend, SHOCK_EXPOSURE_BUDGET, +1);
    Serial.printf("Predict| Shock exposure: %.1f / %.1f budget (rate: %.3f/s)",
                  getShockExposureAccumulator(), SHOCK_EXPOSURE_BUDGET, shockTrend.slopePerSec);
    if (secs >= 0) {
      Serial.printf(" -> projected budget breach in %s\n", formatDuration(secs).c_str());
    } else {
      Serial.println(" -> stable, no breach projected");
    }
  } else {
    Serial.println("Predict| Shock exposure: collecting baseline samples");
  }

  if (tempTrend.trendValid) {
    long secs = trendSecondsToBreach(tempTrend, TEMP_SAFE_MAX_C, +1);
    Serial.printf("Predict| Temperature trend: %.2f C/min", tempTrend.slopePerSec * 60.0f);
    if (secs >= 0) {
      Serial.printf(" -> projected to exceed %.1f C in %s\n", TEMP_SAFE_MAX_C, formatDuration(secs).c_str());
    } else {
      Serial.println(" -> stable, no breach projected");
    }
  } else {
    Serial.println("Predict| Temperature: sensor not yet wired / baseline pending");
  }

  if (humTrend.trendValid) {
    long secs = trendSecondsToBreach(humTrend, HUMIDITY_SAFE_MAX_PCT, +1);
    Serial.printf("Predict| Humidity trend: %.2f %%/min", humTrend.slopePerSec * 60.0f);
    if (secs >= 0) {
      Serial.printf(" -> projected to exceed %.0f%% in %s\n", HUMIDITY_SAFE_MAX_PCT, formatDuration(secs).c_str());
    } else {
      Serial.println(" -> stable, no breach projected");
    }
  } else {
    Serial.println("Predict| Humidity: sensor not yet wired / baseline pending");
  }

  if (batTrend.trendValid) {
    long secs = trendSecondsToBreach(batTrend, BATTERY_SAFE_MIN_V, -1);
    Serial.printf("Predict| Battery trend: %.3f V/hr", batTrend.slopePerSec * 3600.0f);
    if (secs >= 0) {
      Serial.printf(" -> estimated time to empty: %s\n", formatDuration(secs).c_str());
    } else {
      Serial.println(" -> stable, no depletion projected");
    }
  } else {
    Serial.println("Predict| Battery: sensor not yet wired / baseline pending");
  }
}
