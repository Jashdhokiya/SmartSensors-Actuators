# 📦 Smart In-Transit Cargo Monitoring System

> An enterprise-grade, end-to-end IoT and Predictive Monitoring platform for high-value and temperature-sensitive cargo (cold-chain pharmaceuticals, biologics, precision electronics).

---

## 🏗️ Repository Architecture

The codebase is organized into distinct, modular subsystems:

```
smart_cargo_monitor/
├── firmware/                           # ESP32 C++ Modular Firmware
│   └── smart_cargo_monitor/
│       ├── smart_cargo_monitor.ino     # Main entry point (setup & loop)
│       ├── config.h                    # Pins, thresholds & credentials
│       ├── types.h                     # Data structures (CargoReading, TrendChannel)
│       ├── mpu6050_sensor.h / .cpp     # I2C driver & motion tracking
│       ├── gps_tracker.h / .cpp        # NEO-6M UART2 feeder & parser
│       ├── predictive_engine.h / .cpp  # Least-squares linear regression & time-to-breach
│       └── telemetry_publisher.h / .cpp# WiFi, MQTT & JSON serialization
│
├── backend/                            # Node.js + Express + MQTT + PostgreSQL
│   ├── src/
│   │   ├── config/                     # Centralized environment configs
│   │   ├── db/                         # PostgreSQL connection pool with fallback
│   │   ├── services/                   # MQTT subscriber, telemetry processor, cache
│   │   ├── controllers/                # REST API controllers (devices, alerts, etc.)
│   │   ├── routes/                     # Express API routes
│   │   └── server.js                   # Application entrypoint
│   ├── simulator/                      # Realistic ESP32 MQTT telemetry generator
│   └── database/                       # PostgreSQL schema, partitions & views
│
├── frontend/                           # React + TypeScript + Vite + Tailwind Dashboard
│   ├── src/                            # Digital Twin UI, charts, and telemetry maps
│   └── ...
│
└── docs/                               # Hardware wiring guides & architecture documents
    ├── WIRING_GUIDE.md                 # Complete pinout & schematics
    └── ARCHITECTURE.md                 # System data flow & algorithms
```

---

## 🚀 Quick Start Guide

### 1. Run the Backend Service
```bash
# From repository root
npm run dev:backend

# Or inside backend directory:
cd backend
npm install
npm run dev
```

### 2. Run the Telemetry Simulator (Test without hardware)
```bash
npm run simulate
```

### 3. Run the Frontend Dashboard
```bash
# From repository root
npm run dev:frontend

# Or inside frontend directory:
cd frontend
npm install
npm run dev
```

### 4. Flashing the ESP32 Firmware
1. Open the Arduino IDE.
2. Open [`firmware/smart_cargo_monitor/smart_cargo_monitor.ino`](file:///c:/Users/jashd/Downloads/smart_cargo_monitor/firmware/smart_cargo_monitor/smart_cargo_monitor.ino).
3. Install required libraries via Arduino Library Manager:
   - `TinyGPSPlus` (by Mikal Hart)
   - `ArduinoJson` (v6.x)
   - `PubSubClient` (by Nick O'Leary)
4. Update your WiFi SSID and Password in [`firmware/smart_cargo_monitor/config.h`](file:///c:/Users/jashd/Downloads/smart_cargo_monitor/firmware/smart_cargo_monitor/config.h).
5. Select Board: **ESP32 Dev Module** and Flash to your board.

---

## 📑 Hardware Pinouts & Schematics

See the complete hardware wiring table in [docs/WIRING_GUIDE.md](file:///c:/Users/jashd/Downloads/smart_cargo_monitor/docs/WIRING_GUIDE.md).
