# Smart Cargo Monitor — ESP32 Hardware Wiring & Pinout Guide

This guide details every physical pin connection between the **ESP32 DevKit (WROOM-32)** and all sensors, actuators, and power modules used in the `smart_cargo_monitor` project.

---

## 1. Quick Master Pinout Table

| ESP32 Pin | Module / Sensor | Sensor Pin | Signal Type | Function / Code Reference |
| :--- | :--- | :--- | :--- | :--- |
| **3V3** | MPU-6050 | VCC | Power (3.3V) | Power supply for I2C IMU |
| **GND** | MPU-6050 | GND | Ground | Common Ground |
| **GPIO 21** | MPU-6050 | SDA | I2C Data | `#define I2C_SDA 21` |
| **GPIO 22** | MPU-6050 | SCL | I2C Clock | `#define I2C_SCL 22` |
| **GND** | MPU-6050 | AD0 | Logic Low | Sets I2C address to `0x68` |
| **5V / VIN** | NEO-6M GPS | VCC | Power (5V) | Onboard regulator input |
| **GND** | NEO-6M GPS | GND | Ground | Common Ground |
| **GPIO 16** | NEO-6M GPS | TX | UART2 RX | `#define GPS_RX_PIN 16` (ESP32 receives data) |
| **GPIO 17** | NEO-6M GPS | RX | UART2 TX | `#define GPS_TX_PIN 17` (Optional GPS config) |
| **GPIO 34** | LDR Divider / Module | Signal / A0 | Analog Input | `#define LDR_PIN 34` (ADC1_CH6, input only) |
| **3V3** | LDR Divider | 3.3V Rail | Power | Top of voltage divider / VCC |
| **GND** | LDR Divider | GND Rail | Ground | Bottom of 10kΩ pull-down resistor |
| **GPIO 26** | Active Buzzer | (+) / Signal | Digital Output | `#define BUZZER_PIN 26` |
| **GND** | Active Buzzer | (-) / GND | Ground | Common Ground |
| **VIN (5V)** | TP4056 + Step-Up | OUT+ (5V) | System Power | Main 5V power input to ESP32 |
| **GND** | TP4056 + Step-Up | OUT- (GND) | Ground | Main power ground |

---

## 2. Sensor-by-Sensor Detailed Wiring

### A. MPU-6050 (6-Axis Gyroscope & Accelerometer)
Monitors cargo shocks, drops, vibration, and tilt angles.

```
       ESP32 DevKit                  MPU-6050 Module
     +---------------+             +-----------------+
     |          3.3V |------------>| VCC             |
     |           GND |------------>| GND             |
     |       GPIO 22 |------------>| SCL             |
     |       GPIO 21 |------------>| SDA             |
     |           GND |------------>| AD0 (sets 0x68) |
     +---------------+             +-----------------+
```
* **Notes**:
  - `AD0` pin tied to **GND** sets the default I2C address to `0x68`.
  - `INT` pin can remain unconnected (polling mode).

---

### B. NEO-6M GPS Module
Tracks cargo geolocation, transit route, speed, and satellite lock.

```
       ESP32 DevKit                  NEO-6M GPS Module
     +---------------+             +-----------------+
     |       VIN (5V)|------------>| VCC             |
     |           GND |------------>| GND             |
     |       GPIO 16 |<------------| TX (GPS Out)    |
     |       GPIO 17 |------------>| RX (GPS In)     |
     +---------------+             +-----------------+
```
* **Notes**:
  - Connect **GPS TX** -> **ESP32 GPIO 16 (RX2)**.
  - Connect **GPS RX** -> **ESP32 GPIO 17 (TX2)**.
  - Ensure the ceramic patch antenna is securely attached and has a clear line of sight to the sky for initial satellite acquisition (~30–60s).

---

### C. LDR (Light Dependent Resistor) Tamper Circuit
Detects unauthorized opening of the cargo box/container lid.

#### Option 1: Using Raw LDR + 10kΩ Resistor (Voltage Divider)
```
          +3.3V
            |
          [ LDR ]
            |
            +------------> ESP32 GPIO 34 (Analog Read)
            |
         [ 10kΩ ]
            |
           GND
```

#### Option 2: Using 3-Pin / 4-Pin LDR Sensor Module
* **VCC** -> **ESP32 3.3V**
* **GND** -> **ESP32 GND**
* **AO (Analog Out)** -> **ESP32 GPIO 34**

---

### D. Active Buzzer (Acoustic Alert)
Triggers audible alarms during shock, tilt, or container tamper events.

```
       ESP32 DevKit                    Active Buzzer
     +---------------+             +-----------------+
     |       GPIO 26 |------------>| (+) / Signal    |
     |           GND |------------>| (-) / GND       |
     +---------------+             +-----------------+
```

---

### E. Power Supply System (18650 Li-ion + TP4056 + 5V Boost)
Provides untethered mobile operation for the tracking unit.

```
 [ 18650 Li-ion ]
  (3.7V - 4.2V)
       |
       v
 [ TP4056 Charger ] ----(B+/B-)----> Battery
       |
    (OUT+/OUT-)
       v
 [ MT3608 Boost ] -----> Step-up to 5.0V
       |
       +-------------> ESP32 VIN & GPS VCC (5V Rail)
       +-------------> Common GND
```

---

## 3. Hardware Verification Checklist

1. [ ] Connect ESP32 to PC via Micro-USB cable.
2. [ ] Open Arduino Serial Monitor at **115200 baud**.
3. [ ] Verify `[OK] MPU-6050 initialized successfully at address 0x68`.
4. [ ] Verify `[OK] NEO-6M GPS UART2 started on GPIO 16 & 17`.
5. [ ] Check serial logs for live acceleration magnitude and GPS fix status.
