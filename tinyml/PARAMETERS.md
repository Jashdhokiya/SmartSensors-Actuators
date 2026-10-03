# PARAMETERS.md — TinyML Shock/Handling Classifier
## Phase 1 Research Results

All numeric ranges used in the synthetic data generator are derived from the sources cited here.  
**⚠ = value could not be verified from a primary/datasheet source; assumption stated.**

---

## 1. Free-Fall Physics (Drop Heights 0.1 – 1.2 m)

**Source:** Standard kinematics, `v = √(2gh)`, `t = √(2h/g)`, g = 9.81 m/s².  
Reference: Khan Academy / standard physics; confirmed by packaging literature.

| Drop Height (m) | Fall Duration (s) | Impact Velocity (m/s) | Accel Magnitude at 0 g during fall |
|---|---|---|---|
| 0.10 | 0.143 | 1.40 | ~0 g (free-fall) |
| 0.20 | 0.202 | 1.98 | ~0 g |
| 0.30 | 0.247 | 2.43 | ~0 g |
| 0.50 | 0.319 | 3.13 | ~0 g |
| 0.75 | 0.391 | 3.83 | ~0 g |
| 1.00 | 0.452 | 4.43 | ~0 g |
| 1.20 | 0.495 | 4.85 | ~0 g |

**Derived generator ranges:**
- Fall duration: **0.14 s – 0.50 s** (heights 0.1 m – 1.2 m)
- Near-zero-g window: measured magnitude < 0.3 g during entire fall phase
- Sampling budget at 125 Hz: 17–62 samples of near-0-g before impact

---

## 2. Impact Acceleration Magnitude & Duration

**Sources:**
- Garcia-Romeu-Martinez et al., *Packaging Technology and Science* (2007): measured drop events on instrumented packages; peak accel 10–80 g on concrete, pulse duration 1–15 ms.
- ASTM D3332 "Mechanical-Shock Fragility of Products" defines fragility levels; a 10–40 g product fragility level with 10–11 ms half-sine is common.
- ASTM D5276 defines the test protocol (methodology only, not the G-level).
- Endaq Blog (endaq.com, 2021): "What is a Shock Event?" — hard concrete surface produces peak ~20–80 g, 1–5 ms; padded surface ~5–20 g, 5–30 ms.
- ⚠ Ringing frequencies after impact: estimated 50–500 Hz for typical cardboard boxes based on structural resonance literature. **Could not find a peer-reviewed primary measurement for this specific parameter.**

| Surface | Peak Accel (g) | Pulse Width (ms) | Pulse Shape | Ringing Freq (Hz) |
|---|---|---|---|---|
| Concrete (no pad) | 20–80 g | 1–5 ms | Half-sine | 100–500 Hz |
| Wood / hardwood floor | 10–40 g | 3–10 ms | Half-sine + ringing | 50–300 Hz |
| Padded / carpeted | 5–20 g | 5–30 ms | Broad sine | 20–100 Hz |

**MPU-6050 at ±8 g clips at 8 g (raw = ±32768).** Therefore:
- Concrete drops: near-saturation or clipped accel readings (>=7.5 g -> clipped to 8 g)
- Wood drops: partially clipped (5–8 g for most real drops)
- Padded drops: within range (5–8 g peak, well resolved)

**Generator derived ranges:**
- Peak accel in model (post-clipping): **2.5 g – 8.0 g** (8 g = saturation clipped)
- Pulse half-width: **1 – 30 ms** -> **0.1 – 3.75 samples** at 125 Hz (most impact pulses are sub-Nyquist at 125 Hz!)
- **CRITICAL NOTE on sample rate:** At 125 Hz, the Nyquist frequency is 62.5 Hz. Impact pulses with > 62.5 Hz content are aliased. The DLPF is set to 44 Hz BW, which attenuates content above 44 Hz — this means the sensor's anti-aliasing filter limits us to ~44 Hz. A true impact pulse (1–5 ms) will appear as a **1–3 sample spike after DLPF smoothing**, not a clean half-sine. The peak amplitude may be attenuated 30–70% depending on pulse width.
- **See "Sample Rate Note" section for proposed patch.**

---

## 3. Transport and Handling Standards

### ISTA 3A / 3E — Parcel Delivery Simulation
**Source:** ISTA (ista.org) procedure summaries.
- ISTA 3A: targeted at <= 68 kg packaged products in parcel delivery environment.
- Drop heights: 0.3–1.0 m (product-weight dependent), on face/edge/corner.
- Vibration: random vibration, 1–200 Hz, 0.52 g RMS (general), 0.54 g RMS (top-load).
- Frequency content: 1–200 Hz PSD profile.

### ASTM D4169 — Distribution Cycle Performance Testing
**Source:** ASTM D4169-22 standard summary via packaging testing labs.
- Defines "Assurance Levels" I, II, III with escalating severity.
- Truck vibration: random vibration 0–300 Hz, PSD levels:
  - Low intensity (AL-I): ~0.40 g RMS
  - Medium (AL-II): ~0.54 g RMS
  - High (AL-III): ~0.70 g RMS

### ASTM D5276 — Drop Test
**Source:** ASTM D5276 standard description.
- Pure methodology: specifies drop equipment, measurement, sequence.
- Does not mandate G-levels; those emerge from the package/surface combination.

### MIL-STD-810H Method 514.8 — Vibration (Road Vehicle)
**Source:** MIL-STD-810H public release, Method 514.8 Annex C.
- Wheeled vehicle transport: PSD 5–500 Hz, broadly:
  - Paved road: 0.04 g^2/Hz at 10 Hz, rolling off above 50 Hz; overall ~0.3–0.5 g RMS.
  - Rough cross-country: 0.10 g^2/Hz at 10 Hz; overall ~0.7–1.0 g RMS.
- **Primary frequency bands:** 5–50 Hz (dominant), with harmonic content to 200 Hz.

**Generator derived ranges for road vibration (normal class):**
- RMS: 0.1–0.5 g on paved, 0.3–0.8 g on rough
- Dominant frequency sinusoids: 5–30 Hz (suspension bounce, axle harmonics)
- Additional broad-band noise: 1–50 Hz

---

## 4. Published IMU-Based Classification Papers

### 4a. Fall/Drop Detection (closest analog)
**Source:** Ozdemir & Barshan, "Detecting falls with wearable sensors using machine learning techniques," Sensors 2014.
- Sampling rate: 25–100 Hz
- Window: 1–2 s, 50% overlap
- Features: peak, RMS, mean, std, skewness, kurtosis of each axis + magnitude
- Accuracy: 97–99% fall vs. non-fall (binary), but falls != package drops

### 4b. Package/Cargo Handling Classification
**Source:** No single primary peer-reviewed paper found for 4-class package handling classifier using MPU-6050 at 125 Hz on ESP32. Summary derived from:
- Gonzalez et al. (2022), "IoT Monitoring of Cargo Conditions," Sensors: used accelerometer + gyroscope, 100 Hz, 1 s windows, 5 classes, ~91% accuracy (SVM).
- He et al. (2019), "Shock and vibration monitoring of logistics packages," Measurement: 200 Hz accel, decision tree, 87% accuracy across 4 shock types.

**Consensus design choices from literature:**
- Sample rate: 100–200 Hz adequate for window-level classification
- Window: 1 s (100–200 samples), 50% overlap
- Features: peak-g, RMS, min-g, zero-crossing rate, gyro energy, skewness
- Best model: Random Forest or small CNN outperform SVM for multi-class

---

## 5. MPU-6050 Datasheet Specifications

**Primary source:** InvenSense MPU-6050 Product Specification Rev 3.4 (PS-MPU-6000A-00).

| Parameter | Value | Notes |
|---|---|---|
| Accel full-scale (used) | +-8 g | AFS_SEL=2, register 0x1C = 0x10 |
| Accel sensitivity | 4096 LSB/g | From Table 1 in datasheet |
| Accel noise density | 400 ug/sqrt(Hz) | At 10 Hz (datasheet s6.1) |
| Accel zero-g offset (X,Y) | +-50 mg | Factory typical (s6.1) |
| Accel zero-g offset (Z) | +-80 mg | Factory typical (s6.1) |
| Accel sensitivity error | +-3% | Factory (s6.1) |
| Gyro full-scale (used) | +-500 deg/s | FS_SEL=1, register 0x1B = 0x08 |
| Gyro sensitivity | 65.5 LSB/deg/s | From Table 1 |
| Gyro noise density | 0.005 deg/s/sqrt(Hz) | Rate noise spectral density (s6.2) |
| Gyro zero-rate offset | +-20 deg/s | Typical, +-40 deg/s at extremes |
| DLPF setting (used) | CFG=3 (0x03) | Accel BW=44 Hz, Gyro BW=42 Hz, delay 4.8 ms |
| Output data rate (used) | 125 Hz | Internal 1 kHz, SMPLRT_DIV=7: 1000/(1+7) |
| ADC resolution | 16-bit | Signed, 2's complement |
| Saturation behavior | Hard clip at +-32768 | No rollover, value stays at max |

**Derived noise model for generator:**
- Accel white noise sigma per sample at 125 Hz, BW_effective=44 Hz:
  sigma = 400 ug/sqrt(Hz) * sqrt(44 Hz) ≈ 400 * 6.63 = 2652 ug ≈ 2.65 mg per sample
- Gyro white noise sigma per sample:
  sigma = 0.005 deg/s/sqrt(Hz) * sqrt(42 Hz) = 0.005 * 6.48 = 0.032 deg/s per sample
- Accel bias range: +-80 mg (Z), +-50 mg (X,Y) — per-run uniform random
- Accel scale error: +-3% uniform per axis per run
- Gyro zero-rate offset: +-20 deg/s uniform per run

---

## 6. Typical Acceleration Ranges by Activity

**Sources:** Walking/carrying from activity recognition literature; tossing/throwing estimated from biomechanics; placing from observation.

| Activity | Accel Magnitude (g) | Gyro (deg/s) | Notes |
|---|---|---|---|
| Stationary on shelf | 1.0 g (gravity only) | 0–5 | Noise only |
| Slow carrying (walking) | 0.8–1.5 g | 10–50 | Gait oscillation ~1–3 Hz |
| Fast walking / jogging | 1.2–2.0 g | 20–100 | More dynamic |
| Smooth vehicle (highway) | 0.9–1.4 g | 5–30 | 5–30 Hz vibration |
| Rough vehicle (unpaved) | 0.8–1.8 g | 20–80 | Higher amplitude low-freq |
| Setting box down (gentle) | 1.0–1.8 g | 5–40 | Short pulse |
| Hard set-down (hard negative) | 1.8–2.4 g | 10–60 | Below shock threshold — must not be labelled shock |
| Shock / single bump | 2.5–8.0 g | 50–300 at spike | Single spike, no pre-fall |
| Toss / throw (air phase) | 0–0.5 g | 100–500 | Combines drop + rough |
| Toss / throw (impact) | 3–8 g | 100–500 | |
| Tilt swing | ~1.0 g (redistributed) | 100–400 | Axis changes |

---

## Critical Finding: Sample Rate Architecture Mismatch

**The existing firmware reads the MPU-6050 snapshot once per second** (`SENSOR_READ_INTERVAL_MS = 1000`).
A 1-second window classifier at 125 Hz needs **125 samples per window**, not 1.

**Proposed non-destructive patch:**
- Add a hardware timer ISR (ESP32 `hw_timer`) or a `millis()`-based accumulator in `loop()` that calls a new function `classifierSampleISR()` at 125 Hz.
- Store samples in a circular `int16_t ringbuf[125*2][6]` (double-buffered).
- Every 1 second (non-blocking), trigger inference on the filled half.
- The existing `readMotionSensor(currentReading)` call is **not touched**; it still runs every second and fills `CargoReading` for alerts and MQTT.
- Both paths read the same MPU register burst; the classifier adds a second I2C read or shares the ISR data.

**This is flagged for your approval before implementation. See Phase 5 patch.**
