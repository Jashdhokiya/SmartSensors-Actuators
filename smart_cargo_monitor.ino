/*
  Smart In-Transit Cargo Monitoring System
  Phase 1 Firmware — ESP32 DevKit (GPS + MPU-6050 Build)

  Active Hardware Modules:
    1. MPU-6050 / GY-521 : 6-Axis Motion / Shock / Tilt Tracker
                   - SDA -> GPIO 21
                   - SCL -> GPIO 22
                   - VCC -> 3.3V (or 5V if module has onboard 3.3V LDO)
                   - GND -> GND
                   - AD0 -> GND (or leave open for default 0x68)

    2. NEO-6M GPS : Geolocation & Transit Speed Tracker
                   - TX (GPS Out) -> ESP32 GPIO 16 (RX2)
                   - RX (GPS In)  -> ESP32 GPIO 17 (TX2)
                   - VCC          -> VIN (5V)
                   - GND          -> GND

  Board Target: ESP32 Dev Module / DOIT ESP32 DEVKIT V1
  Libraries Required (install via Arduino Library Manager):
    - TinyGPSPlus (by Mikal Hart)
    - ArduinoJson (v6.x)
    - (Wire is built into ESP32 core)
*/

#include <Wire.h>
#include <TinyGPSPlus.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------------------------
// PIN DEFINITIONS (ESP32 DevKit WROOM-32)
// ---------------------------------------------------------------------------
#define I2C_SDA        21   // Hardware I2C SDA
#define I2C_SCL        22   // Hardware I2C SCL

#define GPS_RX_PIN     16   // ESP32 Hardware UART2 RX (connect to GPS TX)
#define GPS_TX_PIN     17   // ESP32 Hardware UART2 TX (connect to GPS RX)
#define GPS_BAUD       9600

// ---------------------------------------------------------------------------
// MPU-6050 REGISTERS
// ---------------------------------------------------------------------------
#define MPU_ADDR_PRIMARY   0x68
#define MPU_ADDR_SECONDARY 0x69
#define MPU_REG_SMPLRT_DIV 0x19
#define MPU_REG_CONFIG     0x1A
#define MPU_REG_GYRO_CFG   0x1B
#define MPU_REG_ACCEL_CFG  0x1C
#define MPU_REG_PWR_MGMT_1 0x6B
#define MPU_REG_WHO_AM_I   0x75
#define MPU_REG_ACCEL_XOUT 0x3B

// ---------------------------------------------------------------------------
// THRESHOLDS & TIMING
// ---------------------------------------------------------------------------
#define SHOCK_THRESHOLD_G         2.5f    // Trigger alert if acceleration exceeds 2.5g
#define TILT_THRESHOLD_DEG        45.0f   // Trigger alert if tilt angle exceeds 45 degrees

#define SENSOR_READ_INTERVAL_MS   1000    // Sensor poll interval (1 second)
#define GPS_FEED_BUDGET_MS        30      // Max time spent parsing GPS stream per loop pass

// ---------------------------------------------------------------------------
// GLOBAL OBJECTS & STATE
// ---------------------------------------------------------------------------
TinyGPSPlus gps;
HardwareSerial gpsSerial(2); // ESP32 Hardware UART2

uint8_t mpuAddress = MPU_ADDR_PRIMARY;
bool mpuDetected = false;
unsigned long lastSensorRead = 0;

struct CargoReading {
  // Motion / IMU Data
  float accelX_g, accelY_g, accelZ_g;
  float gyroX_dps, gyroY_dps, gyroZ_dps;
  float accelMagnitude_g;
  float tiltAngleDeg;
  bool  shockDetected;
  bool  tiltExceeded;

  // GPS Data
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

CargoReading currentReading;

// Function Declarations
void scanI2CBus();
bool initMPU(uint8_t addr);
void feedGPS();
void readMotionSensor();
void readGPSData();
void evaluateAlerts();
void printReadingToSerial();
String buildJSONPayload();

// ---------------------------------------------------------------------------
// SETUP
// ---------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000); // Give USB serial monitor time to connect

  Serial.println("\n\n=======================================================");
  Serial.println("  Smart Cargo Monitor — ESP32 (GPS + MPU-6050) Boot");
  Serial.println("=======================================================");

  // 1. Initialize Hardware I2C at 100 kHz standard mode
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  delay(100);

  // Scan bus and attempt MPU initialization
  scanI2CBus();
  if (!initMPU(MPU_ADDR_PRIMARY)) {
    initMPU(MPU_ADDR_SECONDARY);
  }

  // 2. Initialize Hardware UART2 for NEO-6M GPS
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] NEO-6M GPS UART2 started on GPIO 16 (RX) & GPIO 17 (TX).");
  Serial.println("[INFO] Note: GPS fix requires open sky/window exposure for 1-3 minutes.\n");

  Serial.println("=== Initialization complete. Telemetry streaming below: ===\n");
  Serial.flush();
}

// ---------------------------------------------------------------------------
// I2C BUS SCANNER
// ---------------------------------------------------------------------------
void scanI2CBus() {
  Serial.println("[SCAN] Scanning I2C bus on GPIO 21 (SDA) & GPIO 22 (SCL)...");
  byte count = 0;
  for (byte address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    byte error = Wire.endTransmission();
    if (error == 0) {
      Serial.printf("[SCAN] -> Found I2C device at address 0x%02X\n", address);
      count++;
    }
  }
  if (count == 0) {
    Serial.println("[WARN] No I2C devices found!");
    Serial.println("       Troubleshooting tips for MPU-6050 / GY-521:");
    Serial.println("       1. If connected to 3.3V, try connecting MPU VCC to 5V (VIN) — many GY-521 modules have an onboard 3.3V LDO.");
    Serial.println("       2. Check jumper wires: ESP32 GPIO 21 -> SDA, GPIO 22 -> SCL, GND -> GND.");
  }
}

// ---------------------------------------------------------------------------
// ROBUST DIRECT MPU-6050 INITIALIZATION (Works with genuine & clone chips)
// ---------------------------------------------------------------------------
bool initMPU(uint8_t addr) {
  // Test connection by reading WHO_AM_I register (0x75)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_WHO_AM_I);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  Wire.requestFrom((int)addr, 1);
  if (!Wire.available()) {
    return false;
  }
  uint8_t whoAmI = Wire.read();
  Serial.printf("[MPU] Found chip with WHO_AM_I = 0x%02X at I2C address 0x%02X\n", whoAmI, addr);

  // 1. Wake up MPU6050 from default sleep mode (write 0x00 to PWR_MGMT_1)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_PWR_MGMT_1);
  Wire.write(0x00); // Wake up internal 8MHz oscillator
  if (Wire.endTransmission() != 0) {
    Serial.println("[ERROR] Failed to wake up MPU power management.");
    return false;
  }
  delay(15);

  // 2. Configure sample rate divider (1kHz / (1 + 7) = 125Hz)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_SMPLRT_DIV);
  Wire.write(0x07);
  Wire.endTransmission();

  // 3. Configure Digital Low Pass Filter (~21Hz bandwidth)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_CONFIG);
  Wire.write(0x03);
  Wire.endTransmission();

  // 4. Set Accelerometer full scale range to ±8g (AFS_SEL = 2 -> 0x10)
  // Scale factor: 4096 LSB/g
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_ACCEL_CFG);
  Wire.write(0x10);
  Wire.endTransmission();

  // 5. Set Gyroscope full scale range to ±500 deg/s (FS_SEL = 1 -> 0x08)
  // Scale factor: 65.5 LSB/(deg/s)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_GYRO_CFG);
  Wire.write(0x08);
  Wire.endTransmission();

  mpuAddress = addr;
  mpuDetected = true;
  Serial.printf("[OK] MPU-6050 initialized successfully on 0x%02X (±8g range, wake confirmed).\n", addr);
  return true;
}

// ---------------------------------------------------------------------------
// MAIN LOOP
// ---------------------------------------------------------------------------
void loop() {
  // Continuously ingest incoming GPS NMEA sentences into TinyGPS++
  feedGPS();

  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_READ_INTERVAL_MS) {
    lastSensorRead = now;

    if (!mpuDetected) {
      if (!initMPU(MPU_ADDR_PRIMARY)) {
        initMPU(MPU_ADDR_SECONDARY);
      }
    }

    readMotionSensor();
    readGPSData();
    evaluateAlerts();
    printReadingToSerial();
  }
}

// ---------------------------------------------------------------------------
// GPS FEEDER (UART2 FIFO buffer processing)
// ---------------------------------------------------------------------------
void feedGPS() {
  unsigned long start = millis();
  while (gpsSerial.available() > 0 && (millis() - start) < GPS_FEED_BUDGET_MS) {
    gps.encode(gpsSerial.read());
  }
}

// ---------------------------------------------------------------------------
// DIRECT REGISTER READ FOR MPU-6050
// ---------------------------------------------------------------------------
void readMotionSensor() {
  if (!mpuDetected) {
    currentReading.accelX_g = 0;
    currentReading.accelY_g = 0;
    currentReading.accelZ_g = 0;
    currentReading.gyroX_dps = 0;
    currentReading.gyroY_dps = 0;
    currentReading.gyroZ_dps = 0;
    currentReading.accelMagnitude_g = 0;
    currentReading.tiltAngleDeg = 0;
    currentReading.shockDetected = false;
    currentReading.tiltExceeded = false;
    return;
  }

  // Request 14 bytes starting at ACCEL_XOUT_H (0x3B)
  Wire.beginTransmission(mpuAddress);
  Wire.write(MPU_REG_ACCEL_XOUT);
  if (Wire.endTransmission(false) != 0) {
    mpuDetected = false; // I2C communication lost
    return;
  }

  Wire.requestFrom((int)mpuAddress, 14);
  if (Wire.available() < 14) {
    return;
  }

  int16_t rawAX = (Wire.read() << 8) | Wire.read();
  int16_t rawAY = (Wire.read() << 8) | Wire.read();
  int16_t rawAZ = (Wire.read() << 8) | Wire.read();
  int16_t rawTemp = (Wire.read() << 8) | Wire.read();
  int16_t rawGX = (Wire.read() << 8) | Wire.read();
  int16_t rawGY = (Wire.read() << 8) | Wire.read();
  int16_t rawGZ = (Wire.read() << 8) | Wire.read();

  // Convert using ±8g scale factor (4096 LSB/g) and ±500 deg/s (65.5 LSB/(deg/s))
  currentReading.accelX_g = (float)rawAX / 4096.0f;
  currentReading.accelY_g = (float)rawAY / 4096.0f;
  currentReading.accelZ_g = (float)rawAZ / 4096.0f;

  currentReading.gyroX_dps = (float)rawGX / 65.5f;
  currentReading.gyroY_dps = (float)rawGY / 65.5f;
  currentReading.gyroZ_dps = (float)rawGZ / 65.5f;

  // Calculate total acceleration vector magnitude in g
  currentReading.accelMagnitude_g = sqrt(sq(currentReading.accelX_g) +
                                         sq(currentReading.accelY_g) +
                                         sq(currentReading.accelZ_g));
  currentReading.shockDetected = (currentReading.accelMagnitude_g > SHOCK_THRESHOLD_G);

  // Calculate tilt angle relative to vertical Z axis (degrees)
  float xyPlane = sqrt(sq(currentReading.accelX_g) + sq(currentReading.accelY_g));
  float tiltRad = atan2(xyPlane, abs(currentReading.accelZ_g));
  currentReading.tiltAngleDeg = tiltRad * 180.0f / PI;
  currentReading.tiltExceeded = (currentReading.tiltAngleDeg > TILT_THRESHOLD_DEG);
}

// ---------------------------------------------------------------------------
// GPS TELEMETRY EXTRACTION
// ---------------------------------------------------------------------------
void readGPSData() {
  currentReading.gpsFixValid = gps.location.isValid() && (gps.location.age() < 2000);

  if (gps.location.isValid()) {
    currentReading.latitude  = gps.location.lat();
    currentReading.longitude = gps.location.lng();
  }
  if (gps.speed.isValid()) {
    currentReading.speedKmph = gps.speed.kmph();
  } else {
    currentReading.speedKmph = 0.0;
  }
  if (gps.altitude.isValid()) {
    currentReading.altitudeMeters = gps.altitude.meters();
  } else {
    currentReading.altitudeMeters = 0.0;
  }
  
  currentReading.satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
  currentReading.hdop = gps.hdop.isValid() ? (float)gps.hdop.value() / 100.0f : 99.9f;

  if (gps.time.isValid() && gps.date.isValid()) {
    char timeBuf[32];
    snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02d %02d:%02d:%02d UTC",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    currentReading.timestamp = String(timeBuf);
  } else {
    currentReading.timestamp = "Waiting for satellite time...";
  }
}

// ---------------------------------------------------------------------------
// ALERT EVALUATION
// ---------------------------------------------------------------------------
void evaluateAlerts() {
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
}

// ---------------------------------------------------------------------------
// SERIAL TELEMETRY MONITOR OUTPUT
// ---------------------------------------------------------------------------
void printReadingToSerial() {
  Serial.println("--------------------------------------------------------------------------------");
  
  // 1. Motion Sensor Telemetry
  if (mpuDetected) {
    Serial.printf("Motion | Accel (g): X=%+0.2f Y=%+0.2f Z=%+0.2f | Mag: %0.2f g %s\n",
                   currentReading.accelX_g, currentReading.accelY_g, currentReading.accelZ_g,
                   currentReading.accelMagnitude_g,
                   currentReading.shockDetected ? ">>> [SHOCK ALERT!] <<<" : "");
    Serial.printf("Tilt   | Angle: %0.1f° %s | Gyro: X=%+0.1f Y=%+0.1f Z=%+0.1f °/s\n",
                   currentReading.tiltAngleDeg,
                   currentReading.tiltExceeded ? ">>> [TILT EXCEEDED!] <<<" : "",
                   currentReading.gyroX_dps, currentReading.gyroY_dps, currentReading.gyroZ_dps);
  } else {
    Serial.println("Motion | [OFFLINE] MPU-6050 not detected. Retrying I2C on GPIO 21(SDA) / 22(SCL)...");
  }

  // 2. GPS Telemetry & Diagnostics
  if (currentReading.gpsFixValid) {
    Serial.printf("GPS    | [FIX LOCKED] Sats: %d | HDOP: %.2f | Lat: %.6f | Lon: %.6f | Speed: %.1f km/h\n",
                   currentReading.satellites, currentReading.hdop,
                   currentReading.latitude, currentReading.longitude, currentReading.speedKmph);
    Serial.printf("Time   | %s | Altitude: %.1f m\n",
                   currentReading.timestamp.c_str(), currentReading.altitudeMeters);
  } else {
    if (gps.charsProcessed() == 0) {
      Serial.println("GPS    | [NO DATA] 0 bytes received. Verify GPS TX -> ESP32 GPIO 16 & GPS VCC -> 5V.");
    } else {
      Serial.printf("GPS    | [SEARCHING SATELLITES] Ingested %u bytes (Valid Sentences: %u). Sats visible: %d\n",
                     gps.charsProcessed(), gps.sentencesWithFix(), currentReading.satellites);
      Serial.println("       -> Place antenna near window or outdoors (takes ~1-3 mins for initial satellite acquisition).");
    }
  }

  // 3. Status Summary
  if (currentReading.alertActive) {
    Serial.printf("Status | *** CRITICAL ALERT: %s ***\n", currentReading.alertReason.c_str());
  } else if (!mpuDetected) {
    Serial.println("Status | Check MPU6050 VCC/SDA/SCL Connections");
  } else {
    Serial.println("Status | Normal (System Active)");
  }
}

// ---------------------------------------------------------------------------
// JSON PAYLOAD BUILDER (For future Cloud / MQTT Transmission)
// ---------------------------------------------------------------------------
String buildJSONPayload() {
  StaticJsonDocument<512> doc;

  doc["device_id"] = "cargo_esp32_01";
  doc["timestamp_ms"] = millis();

  JsonObject motion = doc.createNestedObject("motion");
  motion["accel_x_g"] = currentReading.accelX_g;
  motion["accel_y_g"] = currentReading.accelY_g;
  motion["accel_z_g"] = currentReading.accelZ_g;
  motion["accel_magnitude_g"] = currentReading.accelMagnitude_g;
  motion["tilt_deg"] = currentReading.tiltAngleDeg;
  motion["shock_detected"] = currentReading.shockDetected;
  motion["tilt_exceeded"] = currentReading.tiltExceeded;

  JsonObject location = doc.createNestedObject("gps");
  location["fix_valid"] = currentReading.gpsFixValid;
  location["latitude"] = currentReading.latitude;
  location["longitude"] = currentReading.longitude;
  location["speed_kmph"] = currentReading.speedKmph;
  location["altitude_m"] = currentReading.altitudeMeters;
  location["satellites"] = currentReading.satellites;
  location["timestamp_utc"] = currentReading.timestamp;

  doc["alert_active"] = currentReading.alertActive;
  doc["alert_reason"] = currentReading.alertReason;

  String output;
  serializeJson(doc, output);
  return output;
}


