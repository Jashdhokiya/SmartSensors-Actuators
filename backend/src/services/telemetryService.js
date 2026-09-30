const { pool, isDbConnected } = require('../db/db');
const memoryStore = require('./store');

const sseClients = new Set();

function addSSEClient(client) {
  sseClients.add(client);
}

function removeSSEClient(client) {
  sseClients.delete(client);
}

function broadcastToClients(data) {
  const jsonStr = JSON.stringify(data);
  for (const client of sseClients) {
    try {
      client.write(`data: ${jsonStr}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

function parseRecordedAt(gpsTimestamp) {
  if (gpsTimestamp && typeof gpsTimestamp === 'string' && !gpsTimestamp.includes('Waiting')) {
    const parsed = new Date(gpsTimestamp);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function normalizeTelemetry(payload) {
  const deviceId = payload.device_id || payload.deviceId || 'cargo_esp32_01';
  const recordedAt = parseRecordedAt(payload.gps?.timestamp_utc || payload.recorded_at);
  const ts = recordedAt.getTime();

  const motion = payload.motion || {};
  const gps = payload.gps || {};
  const predictions = payload.predictions || {};

  const accelX = motion.accel_x_g ?? payload.accel_x_g ?? 0.02;
  const accelY = motion.accel_y_g ?? payload.accel_y_g ?? 0.04;
  const accelZ = motion.accel_z_g ?? payload.accel_z_g ?? 0.98;
  const accelMag = motion.accel_magnitude_g ?? payload.accel_magnitude_g ?? 0.98;
  const tiltDeg = motion.tilt_deg ?? payload.tilt_deg ?? 0.0;
  const shockDetected = Boolean(motion.shock_detected ?? payload.shock_detected);
  const tiltExceeded = Boolean(motion.tilt_exceeded ?? payload.tilt_exceeded);

  const gpsFix = Boolean(gps.fix_valid ?? payload.gps_fix_valid);
  const lat = gpsFix ? (gps.latitude ?? payload.latitude ?? 27.9889) : 27.9889;
  const lng = gpsFix ? (gps.longitude ?? payload.longitude ?? 76.3883) : 76.3883;
  const speed = gpsFix ? (gps.speed_kmph ?? payload.speed_kmph ?? 72) : 72;
  const alt = gpsFix ? (gps.altitude_m ?? payload.altitude_m ?? 240) : 240;

  const tempVal = payload.temperature?.value ?? payload.temp_c ?? 4.2;
  const humidityVal = payload.humidity?.value ?? payload.humidity_pct ?? 62;
  const batteryPct = payload.battery?.percentage ?? payload.battery_pct ?? 88;
  const batteryVolt = payload.battery?.voltage ?? payload.battery_v ?? 3.92;

  const tempStatus = tempVal < 2 || tempVal > 8 ? (tempVal < -2 || tempVal > 12 ? 'critical' : 'warning') : 'safe';
  const shockStatus = accelMag > 3.0 ? 'critical' : accelMag > 1.5 ? 'warning' : 'safe';

  const standardized = {
    deviceId,
    lastUpdate: ts,
    firmwareVersion: payload.firmwareVersion || '2.4.1-predictive',
    temperature: {
      value: Number(tempVal),
      unit: '°C',
      timestamp: ts,
      status: tempStatus,
      min: 2.0,
      max: 8.0,
      avg: Number(tempVal)
    },
    humidity: {
      value: Number(humidityVal),
      unit: '%',
      timestamp: ts,
      status: (humidityVal < 45 || humidityVal > 80) ? 'warning' : 'safe',
      min: 55,
      max: 70,
      avg: Number(humidityVal)
    },
    pressure: {
      value: 1013.2,
      unit: 'hPa',
      timestamp: ts,
      status: 'safe',
      min: 980,
      max: 1040,
      avg: 1010
    },
    shock: {
      value: Number(accelMag),
      unit: 'g',
      timestamp: ts,
      status: shockStatus,
      vector: {
        x: Number(accelX),
        y: Number(accelY),
        z: Number(accelZ),
        peak: Number(accelMag),
        timestamp: ts
      }
    },
    orientation: {
      roll: Number(accelX * 10),
      pitch: Number(accelY * 10),
      yaw: Number(tiltDeg)
    },
    vibration: {
      value: Number(Math.abs(accelMag - 1.0)),
      unit: 'g-rms',
      timestamp: ts,
      status: shockStatus
    },
    doorOpen: Boolean(payload.doorOpen),
    lightLevel: {
      value: payload.doorOpen ? 350 : 2,
      unit: 'lux',
      timestamp: ts,
      status: 'safe'
    },
    tamperDetected: Boolean(payload.tamperDetected),
    gps: {
      lat: Number(lat),
      lng: Number(lng),
      altitude: Number(alt),
      timestamp: ts
    },
    speed: {
      value: Number(speed),
      unit: 'km/h',
      timestamp: ts,
      status: speed === 0 ? 'warning' : 'safe'
    },
    stoppage: {
      isStationary: speed === 0,
      stationaryDurationMinutes: speed === 0 ? 30 : 0,
      thresholdMinutes: 60,
      locationName: payload.locationName || 'Live In-Transit Location',
      hasAlert: speed === 0
    },
    battery: {
      voltage: Number(batteryVolt),
      percentage: Number(batteryPct),
      current: -45,
      estimatedRuntime: Number((batteryPct * 1.1).toFixed(0)),
      isCharging: false,
      temperature: 28
    },
    connectivity: {
      type: '4G',
      signalStrength: 88,
      lastSeen: ts,
      isOnline: true
    },
    alert_active: Boolean(payload.alert_active),
    alert_reason: payload.alert_reason || '',
    predictions: predictions
  };

  return { deviceId, recordedAt, standardized, rawPayload: payload };
}

async function processIncomingTelemetry(payload) {
  const { deviceId, recordedAt, standardized, rawPayload } = normalizeTelemetry(payload);

  // 1. In-Memory Cache
  memoryStore.latestTelemetry.set(deviceId, standardized);

  if (!memoryStore.telemetryHistory.has(deviceId)) {
    memoryStore.telemetryHistory.set(deviceId, []);
  }
  const hist = memoryStore.telemetryHistory.get(deviceId);
  hist.push({
    timestamp: standardized.lastUpdate,
    temperature: standardized.temperature.value,
    humidity: standardized.humidity.value,
    pressure: standardized.pressure.value,
    shock: standardized.shock.value,
    battery: standardized.battery.percentage,
    speed: standardized.speed.value,
    lat: standardized.gps.lat,
    lng: standardized.gps.lng
  });
  if (hist.length > 500) hist.shift();

  if (!memoryStore.devices.has(deviceId)) {
    memoryStore.devices.set(deviceId, {
      deviceId,
      deviceName: `Cargo Unit ${deviceId}`,
      cargoType: 'Standard Telemetry Consignment',
      origin: 'Logistics Origin',
      destination: 'Logistics Destination',
      status: 'in_transit',
      lastSeen: Date.now(),
      batteryPct: standardized.battery.percentage,
      speedKmH: standardized.speed.value,
      temperature: standardized.temperature.value,
      healthScore: 95,
      healthSeverity: 'safe',
      currentLocationName: 'GPS Tracked Position'
    });
  } else {
    const dev = memoryStore.devices.get(deviceId);
    dev.lastSeen = Date.now();
    dev.batteryPct = standardized.battery.percentage;
    dev.speedKmH = standardized.speed.value;
    dev.temperature = standardized.temperature.value;
  }

  // 2. Alert Processing
  if (standardized.alert_active || standardized.shock.status === 'critical' || standardized.temperature.status === 'critical') {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAlert = {
      id: alertId,
      deviceId,
      type: standardized.shock.status === 'critical' ? 'shock_event' : 'temperature_excursion',
      severity: 'critical',
      title: standardized.alert_reason || 'Critical In-Transit Event Triggered',
      message: `Impact/Breach detected on unit ${deviceId}. Accel: ${standardized.shock.value}g, Temp: ${standardized.temperature.value}°C`,
      timestamp: standardized.lastUpdate,
      status: 'active',
      acknowledged: false,
    };
    memoryStore.alerts.unshift(newAlert);
    if (memoryStore.alerts.length > 200) memoryStore.alerts.pop();
  }

  // 3. SSE Broadcast to React Frontend
  broadcastToClients({
    type: 'TELEMETRY_UPDATE',
    deviceId,
    telemetry: standardized
  });

  // 4. Ingest into PostgreSQL if connected
  if (isDbConnected()) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        await client.query(
          `INSERT INTO devices (device_id, device_name)
           VALUES ($1, $2)
           ON CONFLICT (device_id) DO NOTHING`,
          [deviceId, deviceId]
        );

        const motion = rawPayload.motion || {};
        const gps = rawPayload.gps || {};
        const shockPred = rawPayload.predictions?.shock_exposure || {};
        const tempPred = rawPayload.predictions?.temperature || {};
        const humPred = rawPayload.predictions?.humidity || {};
        const batPred = rawPayload.predictions?.battery || {};

        await client.query(
          `INSERT INTO cargo_telemetry (
            device_id, recorded_at, uptime_ms,
            accel_x_g, accel_y_g, accel_z_g, accel_magnitude_g, tilt_deg,
            shock_detected, tilt_exceeded,
            gps_fix_valid, latitude, longitude, speed_kmph, altitude_m, satellites,
            alert_active, alert_reason,
            pred_shock_valid, pred_shock_current_total, pred_shock_budget, pred_shock_rate_per_sec, pred_shock_seconds_to_breach,
            pred_temp_valid, pred_temp_rate_c_per_min, pred_temp_seconds_to_breach,
            pred_humidity_valid, pred_humidity_rate_pct_per_min, pred_humidity_seconds_to_breach,
            pred_battery_valid, pred_battery_rate_v_per_hr, pred_battery_seconds_to_empty,
            raw_payload
          ) VALUES (
            $1, $2, $3,
            $4, $5, $6, $7, $8,
            $9, $10,
            $11, $12, $13, $14, $15, $16,
            $17, $18,
            $19, $20, $21, $22, $23,
            $24, $25, $26,
            $27, $28, $29,
            $30, $31, $32,
            $33
          )`,
          [
            deviceId, recordedAt, rawPayload.timestamp_ms || 0,
            standardized.shock.vector.x, standardized.shock.vector.y, standardized.shock.vector.z, standardized.shock.value, standardized.orientation.yaw,
            motion.shock_detected || false, motion.tilt_exceeded || false,
            gps.fix_valid || false, standardized.gps.lat, standardized.gps.lng, standardized.speed.value, standardized.gps.altitude || 0, gps.satellites || 0,
            standardized.alert_active, standardized.alert_reason,
            Boolean(shockPred.valid), shockPred.current_total ?? null, shockPred.budget ?? null, shockPred.rate_per_sec ?? null, shockPred.seconds_to_breach ?? null,
            Boolean(tempPred.valid), tempPred.rate_c_per_min ?? null, tempPred.seconds_to_breach ?? null,
            Boolean(humPred.valid), humPred.rate_pct_per_min ?? null, humPred.seconds_to_breach ?? null,
            Boolean(batPred.valid), batPred.rate_v_per_hr ?? null, batPred.seconds_to_empty ?? null,
            JSON.stringify(rawPayload)
          ]
        );

        if (standardized.alert_active) {
          await client.query(
            `INSERT INTO cargo_alerts (
              device_id, recorded_at, alert_type, severity, message,
              accel_magnitude_g, tilt_deg, latitude, longitude
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              deviceId, recordedAt, motion.shock_detected ? 'SHOCK_EVENT' : 'GENERAL', 'CRITICAL', standardized.alert_reason || 'Alert active',
              standardized.shock.value, standardized.orientation.yaw, standardized.gps.lat, standardized.gps.lng
            ]
          );
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[DB INGEST ERROR]`, err.message);
      } finally {
        client.release();
      }
    } catch (err) {
      console.warn('[DB POOL CONNECT ERROR]', err.message);
    }
  }

  console.log(`📡 [INGEST OK] Device: ${deviceId} | Temp: ${standardized.temperature.value}°C | Shock: ${standardized.shock.value}g | Speed: ${standardized.speed.value}km/h | Alert: ${standardized.alert_active}`);
}

module.exports = {
  processIncomingTelemetry,
  normalizeTelemetry,
  broadcastToClients,
  addSSEClient,
  removeSSEClient
};
