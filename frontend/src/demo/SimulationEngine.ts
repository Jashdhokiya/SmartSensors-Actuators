/**
 * SimulationEngine.ts
 *
 * Drives realistic sensor data updates in demo mode.
 * Real-time reactive triggers for all scenarios including stoppage detection.
 */

import type { ScenarioId } from '../types';
import { useTelemetryStore } from '../store/telemetryStore';
import { useEventStore } from '../store/eventStore';
import { useDemoStore } from '../store/demoStore';
import { CURRENT_GPS } from './routes';

// ---- Utility ----
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const noise = (scale = 1) => (Math.random() - 0.5) * 2 * scale;
const rand = (min: number, max: number) => min + Math.random() * (max - min);

// ---- Scenario state machine ----
interface ScenarioState {
  startTime: number;
  elapsed: number;
}

let scenarioState: ScenarioState = { startTime: Date.now(), elapsed: 0 };
let lastScenario: ScenarioId = 'normal';
let gpsOffset = 0;

export function triggerScenarioImmediate(scenarioId: ScenarioId) {
  scenarioState = { startTime: Date.now(), elapsed: 0 };
  lastScenario = scenarioId;
  useDemoStore.getState().setScenario(scenarioId);

  const t = useTelemetryStore.getState();
  const e = useEventStore.getState();

  switch (scenarioId) {
    case 'normal':
      t.resetToDefault();
      e.acknowledgeAll();
      break;

    case 'stoppageAlert':
      t.updateTelemetry({
        speed: { value: 0, unit: 'km/h', timestamp: Date.now(), status: 'warning' },
        stoppage: {
          isStationary: true,
          stationaryDurationMinutes: 74,
          thresholdMinutes: 60,
          locationName: 'Neemrana NH48 Highway Shoulder (Km 118)',
          hasAlert: true,
        },
      });
      e.addEvent(
        'stoppage_alert', 'warning',
        'UNSCHEDULED STOPPAGE: Stationary > 1h',
        'Vehicle stationary for 1h 14m outside designated depot on NH48 corridor. Anti-theft geo-immobilizer pinged.',
        { minutesStationary: 74, speedKmH: 0 }
      );
      e.addAlert({
        type: 'stoppage_alert', severity: 'warning',
        title: '⚠️ Unscheduled Stoppage Alert (>1hr)',
        message: 'Vehicle stationary for 74 minutes at unauthorized highway coordinates (NH48 Km 118).',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;

    case 'temperatureExcursion':
      t.updateTemperature(9.8);
      e.addEvent(
        'temperature_excursion', 'warning',
        'Temperature Warning: 9.8°C',
        'Cold-chain setpoint breach (Threshold: 8.0°C). Active reefer cycle compensatory pulse initiated.',
        { peak: 9.8, setpoint: 8.0 }
      );
      e.addAlert({
        type: 'temperature_excursion', severity: 'warning',
        title: 'Temperature Excursion (+9.8°C)',
        message: 'Cargo interior temperature at 9.8°C — above safe refrigerated max of 8.0°C.',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;

    case 'doorOpen':
      t.setDoorOpen(true);
      t.updateTelemetry({ lightLevel: { ...t.current.lightLevel, value: 950, status: 'critical' } });
      e.addEvent('door_open', 'critical', 'SECURITY: Rear Container Door Opened', 'Magnetic reed switch open circuit + optical sensor detection (>900 lux).', { lightLux: 950 });
      e.addAlert({
        type: 'door_open', severity: 'critical',
        title: 'Security Alert: Door Opened!',
        message: 'Unauthorized container door opening in transit. Potential cargo tampering.',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;

    case 'shockEvent':
      t.updateShock({ x: 1.2, y: -0.8, z: 4.8, peak: 4.8, timestamp: Date.now() });
      e.addEvent('shock_event', 'critical', 'Critical Impact Shock: 4.8g', 'High-G physical impact detected along Z-axis. Potential mechanical structural load.', { peak: 4.8 });
      e.addAlert({
        type: 'shock_event', severity: 'critical',
        title: 'Critical Impact Shock (4.8g)',
        message: 'Severe 4.8g impact recorded. High risk of internal pallet shift or vial breakage.',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;

    case 'tiltEvent':
      t.updateOrientation({ roll: 28.5, pitch: -4.2, yaw: t.current.orientation.yaw });
      e.addEvent('tilt_event', 'warning', 'Tilt Warning: 28.5° Roll Angle', 'Excessive lateral roll detected by 6-DOF IMU.', { roll: 28.5 });
      e.addAlert({
        type: 'tilt_event', severity: 'warning',
        title: 'Cargo Tilt Angle Warning',
        message: 'Container tilted 28.5° on lateral axis. Exceeds safe 15.0° vertical limit.',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;

    case 'batteryDepletion':
      t.updateBattery({ percentage: 14, voltage: 3.32, estimatedRuntime: 12 });
      e.addEvent('battery_low', 'warning', 'Battery Critical: 14%', 'Telemetry node backup power degraded. Entering ultra-low power polling.', { pct: 14 });
      e.addAlert({
        type: 'battery_low', severity: 'critical',
        title: 'Battery Depletion (14%)',
        message: 'Device battery critical (3.32V). Telemetry frequency throttled.',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;

    case 'roughHandling':
      t.updateShock({ x: 0.9, y: 1.4, z: 2.6, peak: 2.6, timestamp: Date.now() });
      t.updateTelemetry({ vibration: { ...t.current.vibration, value: 0.65, status: 'warning' } });
      e.addEvent('shock_event', 'warning', 'Continuous Vibration / Rough Road', 'Sustained road vibration 0.65 g-rms.', { peak: 2.6 });
      break;

    case 'tamperAlert':
      t.setTamper(true);
      t.updateTelemetry({ lightLevel: { ...t.current.lightLevel, value: 450, status: 'critical' } });
      e.addEvent('tamper_alert', 'critical', 'TAMPER SENSOR BREACH', 'Enclosure cover switch broken. Immediate security dispatch recommended.', {});
      e.addAlert({
        type: 'tamper_alert', severity: 'critical',
        title: '⚠️ Tamper Security Breach',
        message: 'IoT hardware cover breach detected.',
        timestamp: Date.now(), status: 'active', acknowledged: false,
      });
      break;
  }

  t.pushHistory();
}

// ---- Continuous simulation tick ----
function runNormal() {
  const t = useTelemetryStore.getState();
  t.updateTemperature(clamp(t.current.temperature.value + noise(0.04), 3.8, 4.8));
  t.updateHumidity(clamp(t.current.humidity.value + noise(0.2), 59, 65));
  t.updateTelemetry({
    pressure: { ...t.current.pressure, value: clamp(t.current.pressure.value + noise(0.1), 1011, 1015) },
    vibration: { ...t.current.vibration, value: rand(0.02, 0.05), status: 'safe' },
    shock: { ...t.current.shock, value: rand(0.04, 0.12), vector: { x: noise(0.03), y: noise(0.04), z: rand(0.04, 0.1), peak: rand(0.04, 0.12), timestamp: Date.now() }, status: 'safe' },
    speed: { ...t.current.speed, value: clamp(t.current.speed.value + noise(2), 68, 76), status: 'safe' },
    connectivity: { ...t.current.connectivity, signalStrength: clamp(t.current.connectivity.signalStrength + noise(1), 78, 92) },
    stoppage: { isStationary: false, stationaryDurationMinutes: 0, thresholdMinutes: 60, locationName: 'Neemrana NH48 Expressway', hasAlert: false },
  });
  gpsOffset += 0.00008;
  t.updateGPS({ ...CURRENT_GPS, lat: CURRENT_GPS.lat - gpsOffset * 0.4, lng: CURRENT_GPS.lng + gpsOffset * 0.25, timestamp: Date.now() });
  t.pushHistory();
}

function runStoppageAlert() {
  const t = useTelemetryStore.getState();
  const e = scenarioState.elapsed;
  const mins = 74 + Math.floor(e / 1000);
  t.updateTelemetry({
    speed: { value: 0, unit: 'km/h', timestamp: Date.now(), status: 'warning' },
    stoppage: {
      isStationary: true,
      stationaryDurationMinutes: mins,
      thresholdMinutes: 60,
      locationName: 'Neemrana NH48 Highway Shoulder (Km 118)',
      hasAlert: true,
    },
  });
  t.pushHistory();
}

function runTemperatureExcursion() {
  const t = useTelemetryStore.getState();
  const e = scenarioState.elapsed;
  let target: number;
  if (e < 12_000)      target = lerp(9.8, 12.4, e / 12_000);
  else if (e < 24_000) target = lerp(12.4, 11.2, (e - 12_000) / 12_000);
  else                  target = lerp(11.2, 5.2, (e - 24_000) / 10_000);

  t.updateTemperature(target + noise(0.1));
  t.pushHistory();
}

function runDoorOpen() {
  const t = useTelemetryStore.getState();
  const e = scenarioState.elapsed;
  if (e > 18_000 && t.current.doorOpen) {
    t.setDoorOpen(false);
    t.updateTelemetry({ lightLevel: { ...t.current.lightLevel, value: 3, status: 'safe' } });
    useEventStore.getState().addEvent('door_close', 'info', 'Rear Door Re-Secured', 'Door contact sensor closed. Light level normalized.', {});
  }
  t.pushHistory();
}

function runShockEvent() {
  const t = useTelemetryStore.getState();
  const e = scenarioState.elapsed;
  if (e > 3000) {
    t.updateShock({ x: noise(0.05), y: noise(0.05), z: rand(0.08, 0.2), peak: rand(0.08, 0.2), timestamp: Date.now() });
  }
  t.pushHistory();
}

function runTiltEvent() {
  const t = useTelemetryStore.getState();
  const e = scenarioState.elapsed;
  if (e < 10_000) {
    const roll = lerp(28.5, 36.0, e / 10_000);
    t.updateOrientation({ roll: roll + noise(0.4), pitch: -4.2 + noise(0.2), yaw: t.current.orientation.yaw });
  } else {
    const roll = lerp(36.0, 1.0, (e - 10_000) / 6_000);
    t.updateOrientation({ roll: Math.max(0, roll), pitch: 0, yaw: t.current.orientation.yaw });
  }
  t.pushHistory();
}

function runBatteryDepletion() {
  const t = useTelemetryStore.getState();
  const battPct = Math.max(2, t.current.battery.percentage - 0.2);
  t.updateBattery({ percentage: battPct, voltage: lerp(3.2, 3.4, battPct / 20), estimatedRuntime: battPct * 0.8 });
  t.pushHistory();
}

function runRoughHandling() {
  const t = useTelemetryStore.getState();
  const peak = rand(1.4, 2.9);
  t.updateShock({ x: noise(1), y: noise(1), z: peak, peak, timestamp: Date.now() });
  t.updateTelemetry({ vibration: { ...t.current.vibration, value: rand(0.4, 0.8), status: 'warning' } });
  t.pushHistory();
}

function runTamperAlert() {
  const t = useTelemetryStore.getState();
  const e = scenarioState.elapsed;
  if (e > 15_000 && t.current.tamperDetected) {
    t.setTamper(false);
    t.updateTelemetry({ lightLevel: { ...t.current.lightLevel, value: 2, status: 'safe' } });
  }
  t.pushHistory();
}

export function simulationTick() {
  const { isRunning, activeScenario, tickRate } = useDemoStore.getState();
  if (!isRunning) return tickRate;

  if (activeScenario !== lastScenario) {
    lastScenario = activeScenario;
    scenarioState = { startTime: Date.now(), elapsed: 0 };
  }

  scenarioState.elapsed = Date.now() - scenarioState.startTime;

  switch (activeScenario) {
    case 'normal':              runNormal(); break;
    case 'stoppageAlert':       runStoppageAlert(); break;
    case 'temperatureExcursion':runTemperatureExcursion(); break;
    case 'doorOpen':            runDoorOpen(); break;
    case 'shockEvent':          runShockEvent(); break;
    case 'tiltEvent':           runTiltEvent(); break;
    case 'batteryDepletion':    runBatteryDepletion(); break;
    case 'roughHandling':       runRoughHandling(); break;
    case 'tamperAlert':         runTamperAlert(); break;
  }

  return tickRate;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startSimulation() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    simulationTick();
  }, 900);
}

export function stopSimulation() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
