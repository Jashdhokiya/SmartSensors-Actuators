#include "env_sensors.h"
#include <DHT.h>

static DHT dht(DHT_PIN, DHT11);
static float s_lastValidTemp = 24.0f;
static float s_lastValidHum = 50.0f;
static bool s_dhtInitialized = false;

void initEnvSensors() {
  Serial.println("[ENV] Initializing DHT11 and LDR Light Sensor...");

  // Configure LDR analog pin
  pinMode(LDR_ANALOG_PIN, INPUT);

  // Initialize DHT11 sensor
  dht.begin();
  s_dhtInitialized = true;

  // Initial dummy read to prime DHT11 sensor
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t) && !isnan(h)) {
    s_lastValidTemp = t;
    s_lastValidHum = h;
    Serial.printf("[ENV] DHT11 Ready! Initial Temp: %.1f °C, Hum: %.1f %%\n", t, h);
  } else {
    Serial.println("[ENV] Note: DHT11 initial read pending (sensor warms up in ~1-2s).");
  }

  int light = analogRead(LDR_ANALOG_PIN);
  Serial.printf("[ENV] LDR Light Sensor Ready! Initial ADC: %d / 4095\n", light);
}

void readEnvSensors(CargoReading &reading) {
  // 1. Read DHT11 Temperature & Humidity
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (!isnan(t)) {
    s_lastValidTemp = t;
    reading.temperature_c = t;
  } else {
    reading.temperature_c = s_lastValidTemp;
  }

  if (!isnan(h)) {
    s_lastValidHum = h;
    reading.humidity_pct = h;
  } else {
    reading.humidity_pct = s_lastValidHum;
  }

  // 2. Read LDR Ambient Light (ADC 0-4095)
  reading.lightRaw = analogRead(LDR_ANALOG_PIN);

  // 3. Evaluate Environmental Exceedance Flags
  reading.tempExceeded = (reading.temperature_c > TEMP_SAFE_MAX_C || reading.temperature_c < TEMP_SAFE_MIN_C);
  reading.humidityExceeded = (reading.humidity_pct > HUMIDITY_SAFE_MAX_PCT);
  reading.lightTamperAlert = (reading.lightRaw > LDR_TAMPER_THRESHOLD_RAW);
}
