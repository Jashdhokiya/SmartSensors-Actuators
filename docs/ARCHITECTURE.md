# Smart Cargo Monitor — System Architecture & Design

## 1. System Overview

The **Smart Cargo Monitor** is an end-to-end IoT and Predictive Analytics system designed for cold-chain, pharmaceutical, and high-value cargo transport monitoring. It combines on-device statistical prediction on ESP32 microcontrollers with real-time cloud data ingestion, PostgreSQL time-series storage, and a React + TypeScript digital twin dashboard.

---

## 2. Architecture Diagram

```
+-------------------------------------------------------+
|                 ESP32 Firmware Node                   |
|                                                       |
|  [MPU-6050 IMU] ----> (I2C)     [NEO-6M GPS] -> (UART)|
|         |                            |                |
|         v                            v                |
|  [Motion Sampling]          [NMEA Stream Feeder]      |
|         \                            /                |
|          v                          v                 |
|       [On-Device Least-Squares Regression Engine]     |
|          - Shock Exposure Trend                       |
|          - Temperature Time-to-Breach                 |
|          - Battery Depletion Projection               |
|                         |                             |
|                         v                             |
|              [JSON Payload Builder]                   |
|                         |                             |
|                         v                             |
|                [PubSubClient MQTT]                    |
+-------------------------|-----------------------------+
                          | (WiFi / 4G Uplink)
                          v
               [Cloud MQTT Broker]
               (HiveMQ / AWS IoT)
                          |
                          v
+-------------------------------------------------------+
|               Node.js / Express Backend               |
|                                                       |
|  [MQTT Subscriber] ----> [Ingestion & Normalizer]     |
|                                |                      |
|                +---------------+---------------+      |
|                |                               |      |
|                v                               v      |
|       [PostgreSQL DB]                 [In-Memory Cache|
|       - cargo_telemetry               - SSE Broadcast |
|       - cargo_alerts                  - REST API]     |
+-------------------------------------------------------+
                                                 | (HTTP/SSE)
                                                 v
+-------------------------------------------------------+
|             React + TypeScript Dashboard              |
|                                                       |
|  - Real-Time Digital Twin & Geofence Map              |
|  - Predictive Trend & Time-to-Breach Indicators       |
|  - Multi-Sensor Telemetry Charts (Accel, Temp, Hum)   |
|  - Incident & Audit Trail Management                  |
+-------------------------------------------------------+
```

---

## 3. Directory Structure

```
smart_cargo_monitor/
├── firmware/
│   └── smart_cargo_monitor/
│       ├── smart_cargo_monitor.ino     # Main Arduino sketch (setup & loop)
│       ├── config.h                    # WiFi, MQTT, Pinouts & Threshold definitions
│       ├── types.h                     # Data structures (CargoReading, TrendChannel)
│       ├── mpu6050_sensor.h            # Motion sensor driver header
│       ├── mpu6050_sensor.cpp          # I2C scanning, init & direct register reads
│       ├── gps_tracker.h               # NEO-6M GPS driver header
│       ├── gps_tracker.cpp             # UART2 feeder & telemetry extraction
│       ├── predictive_engine.h         # Linear regression & time-to-breach header
│       ├── predictive_engine.cpp       # Math implementation & duration formatting
│       ├── telemetry_publisher.h       # Cloud WiFi, MQTT & JSON builder header
│       └── telemetry_publisher.cpp     # Network logic & Serial debug printers
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── config.js               # Centralized env vars & connection configs
│   │   ├── db/
│   │   │   └── db.js                   # PostgreSQL connection pool with fallback
│   │   ├── services/
│   │   │   ├── mqttService.js          # MQTT client & subscriber handler
│   │   │   ├── telemetryService.js     # Normalization, SSE broadcast & DB writer
│   │   │   └── store.js                # In-memory real-time cache & history buffer
│   │   ├── controllers/
│   │   │   ├── deviceController.js     # Device listing & status controllers
│   │   │   ├── telemetryController.js  # Telemetry latest & historical endpoints
│   │   │   ├── alertController.js      # Alert queries & acknowledge/resolve actions
│   │   │   └── eventController.js      # Audit log & milestone event controllers
│   │   ├── routes/
│   │   │   └── apiRoutes.js            # Express API router definition
│   │   └── server.js                   # Express app entrypoint & SSE handler
│   ├── simulator/
│   │   └── mqtt_simulator.js           # ESP32 realistic telemetry generator
│   ├── database/
│   │   └── database_schema.sql         # PostgreSQL production schema & views
│   ├── .env.example
│   └── package.json                    # Backend dependencies & npm scripts
│
├── frontend/                           # React + TypeScript + Tailwind Web Dashboard
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── docs/
│   ├── WIRING_GUIDE.md                 # Pinout table, schematics & troubleshooting
│   └── ARCHITECTURE.md                 # System architecture overview & data flow
│
├── README.md                           # Master Project Readme with setup instructions
└── package.json                        # Root workspace scripts (run backend, frontend, sim)
```

---

## 4. Key Predictive Algorithms

### Least-Squares Linear Regression
Each predictive channel maintains a circular buffer of $(t_i, v_i)$ sample points over a rolling window (default $N=20$).

The slope $m$ and intercept $c$ are computed continuously on the ESP32:
$$m = \frac{N \sum(t_i v_i) - \sum t_i \sum v_i}{N \sum(t_i^2) - (\sum t_i)^2}$$
$$c = \bar{v} - m \bar{t}$$

### Time-to-Breach Estimation
Given an operating threshold $L_{safe}$ and direction indicator $d \in \{+1, -1\}$:
$$\Delta t_{breach} = \frac{(L_{safe} - v_{current}) \cdot d}{m \cdot d}$$
If $m \cdot d \le 0$, no breach is projected (system is stable or recovering).
