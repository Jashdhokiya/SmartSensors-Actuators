#include "mpu6050_sensor.h"

static uint8_t mpuAddress = MPU_ADDR_PRIMARY;
static bool mpuDetected = false;

void initI2C() {
  Wire.begin(I2C_SDA, I2C_SCL, 100000);
  delay(100);
  scanI2CBus();
  if (!initMPU(MPU_ADDR_PRIMARY)) {
    initMPU(MPU_ADDR_SECONDARY);
  }
}

void scanI2CBus() {
  Serial.println("[I2C] Scanning bus on SDA=21, SCL=22...");
  uint8_t count = 0;
  for (uint8_t addr = 1; addr < 127; addr++) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      Serial.printf("[I2C] Device detected at 0x%02X\n", addr);
      count++;
    }
  }
  if (count == 0) {
    Serial.println("[I2C] Warning: No I2C devices found. Check wiring.");
  }
}

bool initMPU(uint8_t addr) {
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_WHO_AM_I);
  if (Wire.endTransmission(false) != 0) {
    return false;
  }
  Wire.requestFrom((int)addr, 1);
  if (Wire.available() < 1) return false;
  Wire.read(); // Read WHO_AM_I register

  // Wake up MPU-6050 (clear SLEEP bit in PWR_MGMT_1)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_PWR_MGMT_1);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return false;
  delay(10);

  // Set sample rate divider (1kHz / (1 + 7) = 125Hz)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_SMPLRT_DIV);
  Wire.write(0x07);
  Wire.endTransmission();

  // Set DLPF (Digital Low Pass Filter) to ~44Hz
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_CONFIG);
  Wire.write(0x03);
  Wire.endTransmission();

  // Configure Gyro: ±500 deg/s (FS_SEL = 1 -> 0x08)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_GYRO_CFG);
  Wire.write(0x08);
  Wire.endTransmission();

  // Configure Accel: ±8g (AFS_SEL = 2 -> 0x10)
  Wire.beginTransmission(addr);
  Wire.write(MPU_REG_ACCEL_CFG);
  Wire.write(0x10);
  Wire.endTransmission();

  mpuAddress = addr;
  mpuDetected = true;
  Serial.printf("[OK] MPU-6050 initialized successfully at 0x%02X (±8g, ±500°/s)\n", addr);
  return true;
}

void readMotionSensor(CargoReading &reading) {
  if (!mpuDetected) {
    if (!initMPU(MPU_ADDR_PRIMARY)) {
      initMPU(MPU_ADDR_SECONDARY);
    }
    if (!mpuDetected) {
      reading.accelX_g = 0;
      reading.accelY_g = 0;
      reading.accelZ_g = 0;
      reading.gyroX_dps = 0;
      reading.gyroY_dps = 0;
      reading.gyroZ_dps = 0;
      reading.accelMagnitude_g = 0;
      reading.tiltAngleDeg = 0;
      reading.shockDetected = false;
      reading.tiltExceeded = false;
      return;
    }
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
  (void)rawTemp;
  int16_t rawGX = (Wire.read() << 8) | Wire.read();
  int16_t rawGY = (Wire.read() << 8) | Wire.read();
  int16_t rawGZ = (Wire.read() << 8) | Wire.read();

  // Convert using ±8g scale factor (4096 LSB/g) and ±500 deg/s (65.5 LSB/(deg/s))
  reading.accelX_g = (float)rawAX / 4096.0f;
  reading.accelY_g = (float)rawAY / 4096.0f;
  reading.accelZ_g = (float)rawAZ / 4096.0f;

  reading.gyroX_dps = (float)rawGX / 65.5f;
  reading.gyroY_dps = (float)rawGY / 65.5f;
  reading.gyroZ_dps = (float)rawGZ / 65.5f;

  // Calculate total acceleration vector magnitude in g
  reading.accelMagnitude_g = sqrt(sq(reading.accelX_g) +
                                  sq(reading.accelY_g) +
                                  sq(reading.accelZ_g));
  reading.shockDetected = (reading.accelMagnitude_g > SHOCK_THRESHOLD_G);

  // Calculate tilt angle relative to vertical Z axis (degrees)
  float xyPlane = sqrt(sq(reading.accelX_g) + sq(reading.accelY_g));
  float tiltRad = atan2(xyPlane, abs(reading.accelZ_g));
  reading.tiltAngleDeg = tiltRad * 180.0f / PI;
  reading.tiltExceeded = (reading.tiltAngleDeg > TILT_THRESHOLD_DEG);
}

bool isMPUDetected() {
  return mpuDetected;
}
