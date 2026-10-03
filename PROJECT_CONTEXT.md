# Smart Cargo Monitor — Full Project Context

> **Last Updated:** 2026-09-30  
> **Purpose:** Complete reference for onboarding, further development, and AI-assisted coding.  
> **Known Issues:** See Section 9 below.

---

## 1. Project Overview

**Smart In-Transit Cargo Monitoring System** — An end-to-end IoT + TinyML + Cloud + Dashboard solution for cold-chain, pharmaceutical, and high-value cargo transport monitoring.

### Core Value Proposition
- **Edge Intelligence:** ESP32 runs on-device Random Forest classifier + least-squares regression to detect shock, drop, and rough handling events *before* cloud round-trip.
- **Cloud Ingestion:** Node.js backend subscribes to MQTT, normalizes telemetry, stores in PostgreSQL, and pushes to frontend via SSE.
- **Live Dashboard:** React + TypeScript + Tailwind dashboard with digital twin, geofence map, multi-sensor charts, alert management, and demo simulation engine.

---

## 2. Technology Stack

| Layer | Technology | Key Libraries |
|---|---|---|
| **Firmware** | C++ / Arduino-ESP32 | TinyGPSPlus, ArduinoJson v6, PubSubClient, Wire |
| **TinyML** | Python 3.x | scikit-learn, numpy, joblib, (optional: tensorflow for MLP/CNN) |
| **Backend** | Node.js / Express | mqtt v5, pg (PostgreSQL), cors, dotenv |
| **Frontend** | React 18 + TypeScript + Vite | zustand (state), react-router-dom, tailwindcss, recharts |
| **Database** | PostgreSQL (partitioned) | uuid-ossp extension, BRIN indexes |
| **Broker** | HiveMQ (public, no auth) | MQTT v3.1.1 over TCP:1883 |

---

## 3. Directory Structure

```
smart_cargo_monitor/
├── firmware/smart_cargo_monitor/     # ESP32 Arduino project (16 files)
│   ├── smart_cargo_monitor.ino       # Main sketch: setup() + loop()
│   ├── config.h                      # WiFi, MQTT, pin defs, thresholds
│   ├── types.h                       # CargoReading, TrendChannel structs
│   ├── mpu6050_sensor.{h,cpp}        # MPU-6050 I2C driver (±8g, ±500°/s)
│   ├── gps_tracker.{h,cpp}           # NEO-6M GPS UART2 driver
│   ├── predictive_engine.{h,cpp}     # Least-squares regression (4 channels)
│   ├── telemetry_publisher.{h,cpp}   # WiFi, MQTT publish, JSON builder
│   ├── classifier.{h,cpp}           # TinyML ring-buffer + RF inference
│   ├── feature_extractor.{h,cpp}    # 16-feature extraction (C++ mirror of features.py)
│   └── model_rf.h                    # Auto-generated RF C header (~100 KB)
│
├── tinyml/                           # ML pipeline (Python)
│   ├── generate_dataset.py           # Physics-based synthetic IMU generator
│   ├── features.py                   # 16-feature extraction (reference Python impl)
│   ├── train_model.py                # RF + MLP + CNN training + C export
│   ├── robustness_test.py            # OOD/adversarial testing suite
│   ├── mix_real_data.py              # Real-synthetic data mixer (Phase 6)
│   ├── validate_real.py              # Real data validation script
│   ├── PARAMETERS.md                 # Physics parameters with citations
│   ├── TINYML_README.md              # TinyML pipeline documentation
│   └── requirements.txt             # Python deps
│
├── dataset/                          # Generated synthetic dataset
│   ├── X_{train,val,test}.npy        # (N, 125, 6) int16 windows
│   ├── y_{train,val,test}.npy        # (N,) int8 labels
│   └── config.json                   # Dataset metadata
│
├── models/                           # Trained model artifacts
│   ├── model_rf.h                    # C header for ESP32
│   ├── model_rf.joblib               # sklearn RF pickle
│   └── scaler_{min,max}.npy          # Feature normalization stats
│
├── backend/                          # Node.js cloud service
│   ├── src/
│   │   ├── server.js                 # Express entry (CORS, JSON, MQTT init)
│   │   ├── config/config.js          # ENV vars, MQTT topics
│   │   ├── db/db.js                  # PostgreSQL pool + fallback
│   │   ├── services/
│   │   │   ├── mqttService.js        # MQTT subscriber
│   │   │   ├── telemetryService.js   # Normalize, cache, SSE broadcast, DB ingest
│   │   │   └── store.js             # In-memory cache (Map) with seed data
│   │   ├── controllers/
│   │   │   ├── deviceController.js   # GET /devices
│   │   │   ├── telemetryController.js # GET /devices/:id/telemetry
│   │   │   ├── alertController.js    # GET/POST /alerts
│   │   │   └── eventController.js    # GET /events
│   │   └── routes/apiRoutes.js       # Router + SSE /stream endpoint
│   ├── simulator/mqtt_simulator.js   # Simulated ESP32 MQTT publisher
│   ├── database/database_schema.sql  # Full PostgreSQL DDL
│   ├── .env.example
│   └── package.json
│
├── frontend/                         # React + TS + Vite dashboard
│   ├── src/
│   │   ├── App.tsx                   # Router + simulation engine init
│   │   ├── main.tsx                  # ReactDOM.createRoot
│   │   ├── types/index.ts            # All TypeScript interfaces (276 lines)
│   │   ├── services/api.ts           # REST + SSE client
│   │   ├── hooks/
│   │   │   ├── useLiveBackendSync.ts # REST poll (3.5s) + SSE live stream
│   │   │   └── useRiskEngine.ts      # Damage probability calculator
│   │   ├── store/
│   │   │   ├── telemetryStore.ts     # Zustand: telemetry, history, backend info
│   │   │   ├── eventStore.ts         # Zustand: events + alerts
│   │   │   ├── demoStore.ts          # Zustand: simulation controls
│   │   │   └── uiStore.ts           # Zustand: UI state
│   │   ├── demo/
│   │   │   ├── SimulationEngine.ts   # 9-scenario simulation engine
│   │   │   └── routes.ts             # Fleet orders + GPS polylines
│   │   ├── pages/                    # Overview, Analytics, Events, Alerts, Reports, Admin
│   │   └── components/              # UI components (layout, sensors, map, twin, etc.)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── docs/
│   ├── ARCHITECTURE.md               # System architecture & data flow
│   └── WIRING_GUIDE.md               # Hardware wiring guide
└── README.md
```

---

## 4. Data Flow (End-to-End)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ESP32 Firmware                                                         │
│                                                                        │
│  MPU-6050 (I2C @125Hz) ──► Ring Buffer (125×6 int16, 1.5KB)           │
│       │                         │                                      │
│       │                    Feature Extractor (16 float32 features)      │
│       │                         │                                      │
│       │                    RF Classifier (model_rf.h, 20 trees)        │
│       │                         │                                      │
│       ▼                         ▼                                      │
│  readMotionSensor()        ClassifierResult {label, confidence, votes} │
│       │                         │                                      │
│  NEO-6M GPS (UART2)            │                                      │
│       │                         │                                      │
│  Predictive Engine              │                                      │
│  (4 trend channels)            │                                      │
│       │                         │                                      │
│       ▼                         ▼                                      │
│  buildJSONPayload() ──── merges all ──► JSON (~800 bytes)             │
│       │                                                                │
│       ▼                                                                │
│  PubSubClient.publish("cargo/cargo_esp32_01/telemetry", QoS=0)        │
└───────────┬────────────────────────────────────────────────────────────┘
            │ WiFi / TCP:1883
            ▼
┌───────────────────────────────────────────────────────────────────┐
│ MQTT Broker (broker.hivemq.com:1883, public, no TLS)             │
└───────────┬───────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────┐
│ Node.js Backend                                                   │
│                                                                   │
│  mqttService.js subscribes to:                                    │
│    cargo/+/telemetry, cargo/telemetry,                           │
│    devices/+/telemetry, cargo/+/alerts, devices/+/alerts         │
│                                                                   │
│  telemetryService.processIncomingTelemetry(payload):              │
│    1. Normalize raw ESP32 JSON → standardized TelemetryState     │
│    2. Update in-memory cache (Map<deviceId, TelemetryState>)     │
│    3. Push to telemetry history buffer (max 500 points)           │
│    4. Auto-register unknown devices                               │
│    5. Generate alerts for critical events                         │
│    6. SSE broadcast to all connected frontend clients             │
│    7. INSERT into PostgreSQL (if connected)                       │
│                                                                   │
│  REST API (/api):                                                 │
│    GET  /health                                                   │
│    GET  /devices, /devices/:id                                   │
│    GET  /devices/:id/telemetry/latest                            │
│    GET  /devices/:id/telemetry/history?range=1h&limit=300        │
│    POST /telemetry (REST ingest fallback)                         │
│    GET  /alerts, POST /alerts/:id/acknowledge, /alerts/:id/resolve│
│    POST /alerts/acknowledge-all                                   │
│    GET  /events                                                   │
│    GET  /stream (SSE live push)                                   │
└───────────┬───────────────────────────────────────────────────────┘
            │ HTTP + SSE
            ▼
┌───────────────────────────────────────────────────────────────────┐
│ React Frontend                                                    │
│                                                                   │
│  useLiveBackendSync():                                            │
│    - REST poll every 3.5s (health, telemetry, history, alerts)   │
│    - SSE EventSource for zero-latency push                        │
│    - Falls back to local SimulationEngine if backend offline     │
│                                                                   │
│  SimulationEngine: 9 scenarios (normal, shock, drop, temp,        │
│    door, tilt, battery, rough handling, tamper, stoppage)          │
│    Runs at 900ms tick rate                                         │
│                                                                   │
│  Pages: Overview | Analytics | Events | Alerts | Reports | Admin  │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5. Firmware Architecture Details

### 5.1 Loop Timing
| Task | Frequency | Method |
|---|---|---|
| GPS feed | Every loop() | `feedGPS()` — drains UART FIFO for up to 30ms |
| MQTT heartbeat | Every loop() | `maintainNetworkConnections()` |
| Classifier feed | 125 Hz (8ms) | `classifierFeedSample()` — rate-limited internally |
| Sensor poll + publish | 1 Hz (1000ms) | `SENSOR_READ_INTERVAL_MS` gated |

### 5.2 Classifier Pipeline
- **Ring buffer:** 125 × 6 × int16 = 1,500 bytes
- **Feature extraction:** 16 features in ~0.5ms on ESP32@240MHz
- **Model:** Random Forest, 20 trees, max_depth=8 → ~100KB flash, 256B RAM
- **Classes:** 0=normal, 1=shock, 2=drop, 3=rough_handling, 4=uncertain
- **Confidence threshold:** 0.45 (below → class 4 "uncertain")
- **Window overlap:** 50% (62 samples retained after inference)

### 5.3 Predictive Channels
| Channel | Sensor Required | Status |
|---|---|---|
| Shock Exposure | MPU-6050 (built-in) | ✅ Working |
| Temperature | SHT31 / DS18B20 | ❌ Stubbed (commented out) |
| Humidity | SHT31 / DHT22 | ❌ Stubbed (commented out) |
| Battery Voltage | INA219 / ADC divider | ❌ Stubbed (commented out) |

### 5.4 MQTT Payload Schema (from firmware)
```json
{
  "device_id": "cargo_esp32_01",
  "timestamp_ms": 123456789,
  "motion": {
    "accel_x_g": 0.02,
    "accel_y_g": 0.04,
    "accel_z_g": 0.98,
    "accel_magnitude_g": 0.98,
    "tilt_deg": 2.1,
    "shock_detected": false,
    "tilt_exceeded": false
  },
  "gps": {
    "fix_valid": true,
    "latitude": 28.4595,
    "longitude": 77.0266,
    "speed_kmph": 72.0,
    "altitude_m": 242.5,
    "satellites": 9,
    "timestamp_utc": "2026-09-30 10:00:00 UTC"
  },
  "alert_active": false,
  "alert_reason": "",
  "predictions": {
    "shock_exposure": { "valid": true, "current_total": 12.4, "budget": 500.0, "rate_per_sec": 0.015, "seconds_to_breach": 14200 },
    "temperature": { "valid": false, "rate_c_per_min": 0, "seconds_to_breach": -1 },
    "humidity": { "valid": false, "rate_pct_per_min": 0, "seconds_to_breach": -1 },
    "battery": { "valid": false, "rate_v_per_hr": 0, "seconds_to_empty": -1 }
  },
  "classification": {
    "valid": true,
    "label": "normal",
    "label_id": 0,
    "confidence": 0.85,
    "votes": [0.85, 0.10, 0.00, 0.05]
  }
}
```

---

## 6. TinyML Pipeline Details

### 6.1 Dataset Generation
- **Generator:** `generate_dataset.py` — physics-based synthetic IMU data
- **Classes:** normal (4 sub-types), shock, drop, rough_handling
- **Sensor model:** Noise (datasheet sigma), bias, scale error, random orientation
- **Hard negatives:** Loud vibration, hard set-down (labeled as "normal")
- **Boundary windows:** Events straddling window edges
- **Split:** 70% train / 15% val / 15% test (by run, not by window)
- **Current dataset:** ~12,472 total windows (8,630 train / 1,926 val / 1,916 test)

### 6.2 Feature Vector (16 float32)
| Index | Name | Description |
|---|---|---|
| 0 | accel_peak_g | Max accel magnitude |
| 1 | accel_rms_g | RMS of accel magnitude |
| 2 | accel_min_g | Min accel magnitude (free-fall proxy) |
| 3 | free_fall_ratio | Fraction of samples < 0.3g |
| 4 | jerk_peak_g_per_s | Max |d(a_mag)/dt| * Fs |
| 5-7 | accel_std_{x,y,z} | Per-axis std |
| 8 | gyro_energy | RMS of gyro magnitude |
| 9 | gyro_peak | Max gyro magnitude |
| 10 | zero_cross_rate | ZCR of (|a| - 1.0g) |
| 11 | impulse_count | Samples where |a| > 2.5g |
| 12 | skewness_mag | Skewness of accel magnitude |
| 13 | kurtosis_mag | Excess kurtosis of accel magnitude |
| 14 | accel_iqr_g | IQR of accel magnitude |
| 15 | gyro_std | Std of gyro magnitude |

### 6.3 Model Candidates
| Model | Test Acc | Flash | Arena | Selected |
|---|---|---|---|---|
| **Random Forest** (20 trees, depth 8) | High | ~100 KB | ~256 B | Yes |
| MLP (32-16-4) | Medium | ~2 KB | ~4 KB | No |
| 1D-CNN (8-16 filters) | Medium | ~5 KB | ~12 KB | No |

---

## 7. Code Verification Findings

### 7.1 Firmware — Verified (with notes)

1. **`classifier.cpp` line 39:** ~~Uses `extern uint8_t MPU_ADDR` but `mpu6050_sensor.cpp` declares `static uint8_t mpuAddress` — the linker symbol `MPU_ADDR` doesn't exist.~~ **FIXED:** Added `getMPUAddress()` getter in `mpu6050_sensor.h/.cpp`. Classifier now calls this getter at runtime and correctly resolves the active MPU address (0x68 or 0x69).

2. **`classifier.cpp` line 131:** ~~Calls `runInference()` on `s_ringbuf` (circular buffer) but passes `s_ringbuf` which still has circular ordering — the re-linearized `s_ordered` buffer is computed but never actually passed to `runInference()`.~~ **FIXED:** `runInference()` now accepts a `const int16_t window[]` parameter. `classifierFeedSample()` passes `s_ordered` (linearized time-ordered buffer) into inference.

3. **Predictive channels 2-4** (temp, humidity, battery) are stubbed out — no sensor reads. The firmware compiles and runs without them, but the predictive layer only works for shock exposure.

4. **`StaticJsonDocument<1024>`** — ~~Payload is about 800 bytes serialized. With the classifier block added (Phase 5), this is tight.~~ **FIXED:** Increased to `StaticJsonDocument<1536>`. PubSubClient buffer also increased to 1536.

5. **~~PubSubClient buffer is set to `1024` bytes~~** — **FIXED:** Increased to `1536` via `setBufferSize(1536)`.

6. **No NTP sync** — `timestamp_ms` uses `millis()` (uptime) not wall-clock time. GPS UTC time is in the payload but not used for timestamp_ms.

### 7.2 Backend — Verified (with notes)

1. **`telemetryService.js` normalizeTelemetry()** — Fabricates data for sensors that don't exist on the ESP32:
   - `temperature.value` defaults to 4.2C (hardcoded fallback)
   - `humidity.value` defaults to 62% (hardcoded fallback)
   - `battery.percentage` defaults to 88% (hardcoded fallback)
   - `pressure.value` is always 1013.2 hPa (completely static)
   - `connectivity.type` is always "4G" (hardcoded)
   
   This is by design for demo purposes but means **no real environmental data flows through** until those sensors are wired.

2. **`store.js`** — Contains 4 hardcoded seed devices with fabricated Indian logistics routes. Good for demo, but these are not backed by real hardware.

3. **~~No authentication on any REST endpoint — `cors: origin: '*'` with no auth middleware.~~** — **PARTIALLY FIXED:** CORS origin is now configurable via `CORS_ORIGIN` env var. Security headers added (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy). JWT/API key auth still needs implementation.

4. **~~No rate limiting on the POST /telemetry endpoint or MQTT ingestion.~~** — **FIXED:** In-memory rate limiter added to `server.js` (configurable via `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS` env vars). SSE stream is exempt from rate limiting.

5. **Database is optional** — Backend works entirely from in-memory cache if PostgreSQL is unavailable. History is lost on restart.

### 7.3 Frontend — Verified (with notes)

1. **Dual data source:** Frontend receives data from both:
   - Local SimulationEngine (runs always, 900ms tick)
   - Backend REST/SSE sync (useLiveBackendSync, 3.5s poll)
   
   When backend is live, SSE telemetry updates overwrite simulation data. When backend is offline, simulation continues autonomously.

2. **`useRiskEngine.ts`** — Risk model uses hardcoded confidence of 92% and a static 1.5% baseline risk. Not connected to real model confidence from the classifier.

3. **SSE stream** has no reconnection logic beyond EventSource's built-in auto-reconnect.

4. **No error boundary** — React app will crash on unhandled component errors.

5. **VITE_API_URL** defaults to `http://localhost:5000/api` — needs to be changed for production deployment.

### 7.4 TinyML — Verified

1. **Feature parity verified:** `features.py` and `feature_extractor.cpp` compute the same 16 features with matching constants (ACCEL_LSB_G=4096, GYRO_LSB_DPS=65.5, FS_HZ=125).

2. **IQR computation differs slightly:** Python uses `np.percentile` (interpolation), C++ uses direct index (`N/4`, `3*N/4`). For N=125: Python Q25 ~ index 31.0, C++ Q25=index 31 — close enough for float32.

3. **Population vs. sample std:** Both Python and C++ use population std (divide by N, not N-1) — consistent.

4. **Zero-cross sign handling:** Python uses `np.sign()` (returns 0 for 0), C++ uses `>= 1.0f ? 1 : -1` — slight difference when accel_mag == 1.0g exactly. Negligible in practice.

---

## 8. MQTT Communication Gap Analysis

### 8.1 Critical Issues

| # | Issue | Severity | Status | Details |
|---|---|---|---|---|
| 1 | **~~QoS 0 (Fire-and-forget)~~** | HIGH | **FIXED** | Firmware now publishes at QoS 1 (`MQTT_TELEMETRY_QOS`). Backend subscribes at QoS 1. At-least-once delivery guaranteed. |
| 2 | **No TLS encryption** | HIGH | OPEN | Connection to `broker.hivemq.com:1883` is unencrypted TCP. Requires switching to port 8883 with TLS certificates (broker-dependent). |
| 3 | **~~Public broker, no authentication~~** | HIGH | **FIXED** | MQTT auth credentials added to both firmware (`MQTT_USERNAME`/`MQTT_PASSWORD` in config.h) and backend (env vars). Still using public broker by default — swap for private broker in production. |
| 4 | **No message ordering guarantee** | MEDIUM | MITIGATED | Sequence numbers (`seq` field) now added to every firmware message. Backend detects and logs gaps. |
| 5 | **~~No Last Will and Testament (LWT)~~** | MEDIUM | **FIXED** | Firmware publishes LWT to `cargo/<device_id>/status` with offline payload. Backend subscribes to `cargo/+/status` and tracks device online/offline state. |
| 6 | **No retained messages** | MEDIUM | PARTIALLY FIXED | LWT and online status messages are now retained. Telemetry messages remain non-retained (by design — stale telemetry shouldn't appear as current). |
| 7 | **No MQTT keep-alive tuning** | MEDIUM | OPEN | PubSubClient default keepalive is 15 seconds. Could be tuned for flaky WiFi environments. |

### 8.2 Topic Mismatch

**Firmware publishes to:** `cargo/cargo_esp32_01/telemetry`  
**Backend subscribes to:** `cargo/+/telemetry`, `cargo/telemetry`, `devices/+/telemetry`, `cargo/+/alerts`, `devices/+/alerts`

- `cargo/+/telemetry` matches `cargo/cargo_esp32_01/telemetry` — **working**
- `devices/+/telemetry` — firmware never publishes to this topic
- `cargo/+/alerts` — firmware never publishes dedicated alert messages to a separate topic
- `devices/+/alerts` — firmware never publishes to this topic
- `cargo/telemetry` — firmware doesn't publish to this exact (no device ID) topic

**Impact:** The `cargo/+/telemetry` wildcard subscription is sufficient for current firmware, but the extra topic subscriptions suggest planned firmware changes for dedicated alert topics and alternate device topic namespaces that haven't been implemented yet.

### 8.3 Payload Size and Buffer Alignment

| Component | Buffer Size | Typical Payload |
|---|---|---|
| Firmware `StaticJsonDocument` | **1536 bytes** (was 1024) | ~800-900 bytes (with classifier block) |
| PubSubClient send buffer | **1536 bytes** (was 1024) | Same payload |
| Backend MQTT receive | Unlimited (mqtt.js) | Same payload |

- **Risk:** If more fields are added to the JSON payload (e.g., full gyro data), the 1024-byte limit will silently truncate or fail to publish.

### 8.4 Reconnection Behavior

**Firmware side:**
- `maintainNetworkConnections()` checks WiFi status first, then MQTT.
- MQTT reconnect attempts are throttled to every 5 seconds.
- No exponential backoff — fixed 5s retry.
- No WiFi reconnect logic — relies on ESP32 auto-reconnect.

**Backend side:**
- `mqtt.connect()` with `reconnectPeriod: 5000` — auto-reconnects every 5s.
- `connectTimeout: 30s` — fairly generous.
- No message buffering during disconnect — messages published to broker while backend is disconnected are lost (QoS 0).

### 8.5 Data Integrity

- **No message deduplication:** At QoS 1, MQTT may retransmit. Backend should idempotently handle duplicates (sequence number + device_id can be used as a dedup key).
- **~~No sequence numbers~~** — **FIXED:** Firmware now includes a monotonic `seq` counter in every payload. Backend tracks per-device sequences and logs gaps.
- **No checksum/HMAC:** Payloads can be tampered with in transit.
- **`timestamp_ms` is millis():** Not synchronized to wall clock. Backend uses server-side `Date.now()` for `recorded_at`, creating potential clock skew issues.

---

## 9. Known Issues and Missing Architecture

### 9.1 Known Issues (User-Reported)
1. **No real data used for ML model** — Dataset is 100% synthetic (generate_dataset.py). Real-world accuracy is unknown and expected to be lower due to sim-to-real gap. Pipeline for real data collection exists (`imu_logger/`, `mix_real_data.py`, `validate_real.py`) but has not been exercised with actual sensor data.
2. **Cloud setup not done** — PostgreSQL not provisioned, no cloud VM/container, no domain/DNS, no CI/CD.

### 9.2 Missing Architecture Components

| Category | Missing Component | Priority | Notes |
|---|---|---|---|
| **Security** | MQTT TLS/mTLS | P0 | Switch to port 8883 with TLS; use private broker |
| **Security** | ~~MQTT authentication~~ | ~~P0~~ | **FIXED** — Username/password fields added to firmware config.h and backend .env |
| **Security** | REST API authentication | P0 | JWT or API key auth on all endpoints |
| **Security** | ~~CORS origin restriction~~ | ~~P1~~ | **FIXED** — Configurable via `CORS_ORIGIN` env var |
| **Reliability** | ~~MQTT QoS 1 (at-least-once)~~ | ~~P0~~ | **FIXED** — Both firmware and backend now use QoS 1 |
| **Reliability** | Offline message buffer (firmware) | P1 | Queue unsent messages in SPIFFS/PSRAM and replay after reconnect |
| **Reliability** | ~~MQTT LWT message~~ | ~~P1~~ | **FIXED** — Firmware sets LWT; backend subscribes to status topic |
| **Reliability** | ~~Message sequence numbers~~ | ~~P1~~ | **FIXED** — Monotonic `seq` field in firmware payload; backend detects gaps |
| **Reliability** | Database migration tool | P1 | No Flyway/Knex migrations; schema applied manually |
| **Sensors** | Temperature sensor (SHT31/DS18B20) | P1 | Stubbed in firmware |
| **Sensors** | Humidity sensor (SHT31/DHT22) | P1 | Stubbed in firmware |
| **Sensors** | Battery voltage monitor | P1 | Stubbed in firmware |
| **Firmware** | OTA firmware updates | P2 | No ArduinoOTA or HTTP OTA mechanism |
| **Firmware** | Deep sleep / power management | P2 | Currently always-on; no duty cycling |
| **Firmware** | NTP time sync | P1 | millis() is not wall-clock time |
| **Firmware** | Watchdog timer | P1 | No WDT; if loop hangs, device locks |
| **Backend** | WebSocket upgrade from SSE | P2 | SSE is unidirectional; WebSocket enables bidirectional |
| **Backend** | ~~Rate limiting and input validation~~ | ~~P1~~ | **FIXED** — In-memory rate limiter added (configurable). Input validation (Joi/Zod) still needed. |
| **Backend** | Logging framework | P1 | Uses console.log; no winston/pino structured logging |
| **Backend** | Graceful shutdown | P1 | No SIGTERM handler; no drain of MQTT/DB connections |
| **Frontend** | Error boundaries | P1 | No React error boundary components |
| **Frontend** | Service worker / offline support | P2 | Dashboard goes blank if backend is unreachable and page reloads |
| **Frontend** | Multi-device switching (full) | P2 | Partial: fleet orders exist in demo, but real multi-device view needs backend device enumeration |
| **ML** | Real sensor data collection pipeline | P0 | `imu_logger/` directory exists but empty/unused |
| **ML** | Model performance monitoring | P2 | No drift detection or accuracy tracking in production |
| **ML** | ~~Classifier result to alert pipeline~~ | ~~P1~~ | **FIXED** — Backend `normalizeTelemetry()` now extracts `classification` block. ML-driven alerts generated for shock/drop/rough_handling with ≥65% confidence. |
| **DevOps** | Docker Compose | P1 | No containerization |
| **DevOps** | CI/CD pipeline | P2 | No GitHub Actions / Jenkins |
| **DevOps** | Environment-based config | P1 | Frontend API URL hardcoded to localhost |
| **DevOps** | Cloud deployment (AWS/GCP/Azure) | P0 | Nothing deployed |

### 9.3 Firmware Bugs Found — ALL FIXED ✅

1. **`classifier.cpp:131`** — ~~Inference runs on circular `s_ringbuf` instead of linearized `s_ordered`.~~
   - **FIXED:** `runInference()` now accepts a `const int16_t window[]` parameter. `s_ordered` is passed in.

2. **`classifier.cpp:39`** — ~~`extern uint8_t MPU_ADDR` references a symbol that doesn't exist.~~
   - **FIXED:** `getMPUAddress()` getter added to `mpu6050_sensor.h/.cpp`. Classifier calls it at runtime.

3. **`telemetry_publisher.cpp:54`** — ~~`StaticJsonDocument<1024>` may overflow.~~
   - **FIXED:** Increased to `StaticJsonDocument<1536>`. PubSubClient buffer also increased to 1536.

---

## 10. Configuration Reference

### 10.1 Firmware Thresholds
| Parameter | Value | Source |
|---|---|---|
| Shock threshold | 2.5g | config.h |
| Tilt threshold | 45 deg | config.h |
| Sensor poll interval | 1000ms | config.h |
| Prediction window | 20 samples | config.h |
| Min samples for regression | 8 | config.h |
| Safe temp range | 2-8C | config.h |
| Safe humidity max | 65% | config.h |
| Battery safe min | 3.3V | config.h |
| Shock exposure budget | 500g cumulative | config.h |
| Classifier confidence threshold | 0.45 | classifier.h |
| Classifier sample rate | 125 Hz (8ms) | classifier.h |

### 10.2 Backend Configuration
| Variable | Default | Source |
|---|---|---|
| PORT | 5000 | .env / config.js |
| DATABASE_URL | postgresql://postgres:postgres@localhost:5432/smart_cargo_db | .env |
| MQTT_BROKER_URL | mqtt://broker.hivemq.com:1883 | .env |
| MQTT_CLIENT_ID | smart_cargo_server_{random} | config.js |
| Telemetry history max | 500 points/device | telemetryService.js |
| Alert buffer max | 200 alerts | telemetryService.js |
| MQTT reconnect period | 5000ms | mqttService.js |

### 10.3 Frontend Configuration
| Variable | Default | Source |
|---|---|---|
| VITE_API_URL | http://localhost:5000/api | api.ts |
| REST poll interval | 3500ms | useLiveBackendSync.ts |
| Simulation tick rate | 900ms | SimulationEngine.ts |
| History display max | 300 points | telemetryStore.ts |

---

## 11. Development Commands

```bash
# Backend
cd backend
npm install
cp .env.example .env          # Edit with real values
npm start                      # Start server on port 5000
npm run simulate               # Run MQTT simulator

# Frontend
cd frontend
npm install
npm run dev                    # Vite dev server (usually :5173)
npm run build                  # Production build to dist/

# TinyML Pipeline
cd tinyml
pip install -r requirements.txt
python generate_dataset.py --seed 42 --n_runs 125 --output ../dataset/
python train_model.py --dataset ../dataset/ --output ../models/
python robustness_test.py --dataset ../dataset/ --models ../models/

# Copy model to firmware
cp models/model_rf.h firmware/smart_cargo_monitor/model_rf.h
```

---

## 12. Key Decisions and Design Rationale

1. **Why Random Forest over TFLite CNN?** — RF runs with ~256B RAM and ~100KB flash (pure C, no TFLite Micro runtime needed). CNN needs 12KB arena + TFLite Micro (~50KB flash overhead). RF was selected for simplicity and reliability on ESP32.

2. **Why SSE over WebSocket?** — Simpler server implementation, automatic reconnection in browsers, sufficient for unidirectional telemetry push. WebSocket adds complexity for bidirectional which isn't needed yet.

3. **Why in-memory cache before DB?** — Ensures zero-downtime frontend responsiveness even when PostgreSQL is unavailable. The memory store acts as an L1 cache with SSE broadcast.

4. **Why synthetic data?** — Real data collection requires actual hardware deployed on vehicles for extended periods. Synthetic data allows immediate model training and firmware development while hardware validation is pending.

5. **Why dual data sources in frontend?** — The SimulationEngine provides a rich demo experience without any backend. When the backend comes online, live data overrides simulation seamlessly — makes the dashboard deployable standalone for presentations.

---

## 13. Glossary

| Term | Meaning |
|---|---|
| CargoReading | Firmware struct containing one snapshot of all sensor data |
| TrendChannel | Circular buffer + least-squares fit for one predictive metric |
| ClassifierResult | Output of RF inference: label, confidence, per-class votes |
| TelemetryState | Frontend/backend normalized snapshot of all telemetry |
| DamageProbabilityModel | Frontend risk engine output: probability + contributing factors |
| ShipmentOrder | Frontend demo fleet order with route polyline + metadata |
| SSE | Server-Sent Events — one-way push from backend to frontend |
| BRIN | Block Range Index — PostgreSQL index type optimized for time-series |
| LWT | Last Will and Testament — MQTT message sent when client disconnects ungracefully |
