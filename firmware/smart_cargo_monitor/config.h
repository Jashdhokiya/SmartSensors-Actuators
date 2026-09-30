#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ===========================================================================
// CLOUD / MQTT CONFIGURATION
// ===========================================================================
#define DEFAULT_WIFI_SSID       "YOUR_WIFI_SSID"     // Enter WiFi SSID
#define DEFAULT_WIFI_PASSWORD   "YOUR_WIFI_PASSWORD" // Enter WiFi Password
#define DEFAULT_MQTT_SERVER     "broker.hivemq.com"  // Public broker or Cloud IP
#define DEFAULT_MQTT_PORT       1883
#define DEFAULT_MQTT_TOPIC      "cargo/cargo_esp32_01/telemetry"
#define DEFAULT_MQTT_CLIENT_ID  "esp32_cargo_node_01"
#define DEVICE_ID               "cargo_esp32_01"

// ===========================================================================
// PIN DEFINITIONS (ESP32 DevKit WROOM-32)
// ===========================================================================
#define I2C_SDA        21   // Hardware I2C SDA
#define I2C_SCL        22   // Hardware I2C SCL

#define GPS_RX_PIN     16   // ESP32 Hardware UART2 RX (connect to GPS TX)
#define GPS_TX_PIN     17   // ESP32 Hardware UART2 TX (connect to GPS RX)
#define GPS_BAUD       9600

// ===========================================================================
// MPU-6050 REGISTERS
// ===========================================================================
#define MPU_ADDR_PRIMARY   0x68
#define MPU_ADDR_SECONDARY 0x69
#define MPU_REG_SMPLRT_DIV 0x19
#define MPU_REG_CONFIG     0x1A
#define MPU_REG_GYRO_CFG   0x1B
#define MPU_REG_ACCEL_CFG  0x1C
#define MPU_REG_PWR_MGMT_1 0x6B
#define MPU_REG_WHO_AM_I   0x75
#define MPU_REG_ACCEL_XOUT 0x3B

// ===========================================================================
// REACTIVE THRESHOLDS & TIMING
// ===========================================================================
#define SHOCK_THRESHOLD_G         2.5f    // Trigger alert if acceleration exceeds 2.5g
#define TILT_THRESHOLD_DEG        45.0f   // Trigger alert if tilt angle exceeds 45 degrees

#define SENSOR_READ_INTERVAL_MS   1000    // Sensor poll interval (1 second)
#define GPS_FEED_BUDGET_MS        30      // Max time spent parsing GPS stream per loop pass

// ===========================================================================
// PREDICTIVE LAYER CONFIGURATION
// ===========================================================================
#define PREDICTION_WINDOW_SIZE     20     // Rolling buffer sample count
#define PREDICTION_MIN_SAMPLES     8      // Minimum samples required before regression is valid

// Safe operating limits for cargo (e.g. cold-chain pharmaceuticals)
#define TEMP_SAFE_MAX_C            8.0f   // Safe maximum temperature (°C)
#define TEMP_SAFE_MIN_C            2.0f   // Safe minimum temperature (°C)
#define HUMIDITY_SAFE_MAX_PCT      65.0f  // Safe maximum relative humidity (%)
#define BATTERY_SAFE_MIN_V         3.3f   // Safe minimum battery voltage (V)

// Cumulative shock exposure budget
#define SHOCK_EXPOSURE_BUDGET      500.0f // Cumulative g-force fatigue budget
#define SHOCK_MEANINGFUL_G         1.3f   // Base g-force threshold for cumulative exposure

#endif // CONFIG_H
