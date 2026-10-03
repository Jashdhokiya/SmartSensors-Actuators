/*
  imu_logger.ino — Phase 6: Real IMU window logger for closing the sim-to-real gap.

  Streams raw MPU-6050 windows over Serial as CSV so you can record
  labelled real data on your computer for retraining.

  SEPARATE SKETCH — do NOT merge into the main smart_cargo_monitor firmware.
  Flash this to the ESP32 when you want to collect training data, then
  restore the main firmware when done.

  Usage:
    1. Flash this sketch to the ESP32.
    2. Open a terminal at 115200 baud.
    3. Send a class digit (0-3) to set the label for the next window:
         '0' = normal
         '1' = shock
         '2' = drop
         '3' = rough_handling
    4. Perform the motion. The sketch records 125 samples (1 second)
       and streams them as CSV lines, then auto-repeats.
    5. Save the Serial output to a .csv file.
    6. Run: python tinyml/mix_real_data.py --real_csv your_data.csv

  CSV format (one line per sample):
    label,ax,ay,az,gx,gy,gz,timestamp_us
  Where ax..gz are int16 raw MPU counts (same as firmware).

  MPU-6050 settings mirror config.h:
    - SMPLRT_DIV = 7 -> 125 Hz
    - DLPF_CFG   = 3 -> 44 Hz bandwidth
    - AFS_SEL    = 2 -> +-8g (4096 LSB/g)
    - FS_SEL     = 1 -> +-500 dps (65.5 LSB/dps)
*/

#include <Wire.h>

// ── Pin definitions (match config.h) ────────────────────────────────────
#define I2C_SDA  21
#define I2C_SCL  22
#define MPU_ADDR 0x68

// ── MPU registers ────────────────────────────────────────────────────────
#define MPU_REG_SMPLRT_DIV  0x19
#define MPU_REG_CONFIG      0x1A
#define MPU_REG_GYRO_CFG    0x1B
#define MPU_REG_ACCEL_CFG   0x1C
#define MPU_REG_PWR_MGMT_1  0x6B
#define MPU_REG_ACCEL_XOUT  0x3B

// ── Constants ────────────────────────────────────────────────────────────
#define FS_HZ              125
#define WINDOW_SAMPLES     125
#define SAMPLE_INTERVAL_US (1000000 / FS_HZ)   // 8000 us

static int8_t  current_label = 0;
static bool    collecting    = false;
static int16_t sample_buf[WINDOW_SAMPLES][6];
static int     sample_idx = 0;
static uint32_t window_count = 0;

void writeMPUReg(uint8_t reg, uint8_t val) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(reg);
    Wire.write(val);
    Wire.endTransmission();
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Wire.begin(I2C_SDA, I2C_SCL, 400000);   // 400 kHz I2C for speed
    delay(100);

    // Wake up MPU
    writeMPUReg(MPU_REG_PWR_MGMT_1, 0x00);
    delay(10);
    // Sample rate: 1000/(1+7) = 125 Hz
    writeMPUReg(MPU_REG_SMPLRT_DIV, 0x07);
    // DLPF: 44 Hz bandwidth (matches main firmware)
    writeMPUReg(MPU_REG_CONFIG,     0x03);
    // Gyro: +-500 dps
    writeMPUReg(MPU_REG_GYRO_CFG,   0x08);
    // Accel: +-8g
    writeMPUReg(MPU_REG_ACCEL_CFG,  0x10);

    Serial.println("# IMU Logger — Phase 6 Real Data Collector");
    Serial.println("# Send class digit: 0=normal 1=shock 2=drop 3=rough_handling");
    Serial.println("# Format: label,ax,ay,az,gx,gy,gz,timestamp_us");
    Serial.println("# Press any class key to begin collecting.");
    Serial.printf("# Config: %d Hz, +-8g, +-500dps, DLPF=44Hz\n", FS_HZ);
}

bool readMPU(int16_t raw[6]) {
    Wire.beginTransmission(MPU_ADDR);
    Wire.write(MPU_REG_ACCEL_XOUT);
    if (Wire.endTransmission(false) != 0) return false;
    if (Wire.requestFrom(MPU_ADDR, 14) != 14) return false;
    raw[0] = (Wire.read() << 8) | Wire.read();  // AX
    raw[1] = (Wire.read() << 8) | Wire.read();  // AY
    raw[2] = (Wire.read() << 8) | Wire.read();  // AZ
    Wire.read(); Wire.read();                    // TEMP discard
    raw[3] = (Wire.read() << 8) | Wire.read();  // GX
    raw[4] = (Wire.read() << 8) | Wire.read();  // GY
    raw[5] = (Wire.read() << 8) | Wire.read();  // GZ
    return true;
}

void loop() {
    // Check for label change
    if (Serial.available()) {
        char c = Serial.read();
        if (c >= '0' && c <= '3') {
            current_label = c - '0';
            collecting    = true;
            sample_idx    = 0;
            Serial.printf("# Label set to %d — collecting window...\n", current_label);
        } else if (c == 's' || c == 'S') {
            collecting = !collecting;
            Serial.printf("# Collection %s\n", collecting ? "resumed" : "paused");
        }
    }

    if (!collecting) return;

    // Rate-limit to FS_HZ
    static uint32_t last_us = 0;
    uint32_t now_us = micros();
    if (now_us - last_us < SAMPLE_INTERVAL_US) return;
    last_us = now_us;

    int16_t raw[6];
    if (!readMPU(raw)) return;

    sample_buf[sample_idx][0] = raw[0];
    sample_buf[sample_idx][1] = raw[1];
    sample_buf[sample_idx][2] = raw[2];
    sample_buf[sample_idx][3] = raw[3];
    sample_buf[sample_idx][4] = raw[4];
    sample_buf[sample_idx][5] = raw[5];
    sample_idx++;

    if (sample_idx >= WINDOW_SAMPLES) {
        // Flush window as CSV
        uint32_t ts = micros();
        for (int i = 0; i < WINDOW_SAMPLES; i++) {
            Serial.printf("%d,%d,%d,%d,%d,%d,%d,%lu\n",
                current_label,
                sample_buf[i][0], sample_buf[i][1], sample_buf[i][2],
                sample_buf[i][3], sample_buf[i][4], sample_buf[i][5],
                (unsigned long)(ts - (WINDOW_SAMPLES - i) * SAMPLE_INTERVAL_US));
        }
        Serial.printf("# Window %lu done (label=%d)\n", ++window_count, current_label);
        sample_idx = 0;
        // Auto-repeat same label
        Serial.printf("# Send class key to change label, or keep moving for label=%d\n",
                       current_label);
    }
}
