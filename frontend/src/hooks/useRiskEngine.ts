import type { TelemetryState, DamageProbabilityModel, RiskFactor, SeverityLevel } from '../types';

function tempFactor(t: TelemetryState): RiskFactor {
  const val = t.temperature.value;
  const excursion = Math.max(0, val - 8);
  const contribution = Math.min(excursion * 2.5, 20);
  return {
    id: 'temperature',
    label: 'Temperature Excursion',
    contribution,
    severity: val > 12 ? 'critical' : val > 8 ? 'warning' : 'safe',
    description: val > 8 ? `Cargo temp ${val.toFixed(1)}°C exceeds safe max of 8°C` : 'Temperature within safe range',
    value: `${val.toFixed(1)}°C`,
  };
}

function humidityFactor(t: TelemetryState): RiskFactor {
  const val = t.humidity.value;
  const excursion = val > 75 ? val - 75 : val < 40 ? 40 - val : 0;
  const contribution = Math.min(excursion * 0.6, 12);
  return {
    id: 'humidity',
    label: 'Humidity',
    contribution,
    severity: excursion > 15 ? 'critical' : excursion > 5 ? 'warning' : 'safe',
    description: excursion > 0 ? `Humidity ${val.toFixed(0)}% outside optimal 40-75%` : 'Humidity optimal',
    value: `${val.toFixed(0)}%`,
  };
}

function shockFactor(t: TelemetryState): RiskFactor {
  const val = t.shock.value;
  const contribution = val > 3 ? Math.min((val - 3) * 4, 25) : val > 1.5 ? (val - 1.5) * 2 : 0;
  return {
    id: 'shock',
    label: 'Impact / Shock',
    contribution,
    severity: val > 4 ? 'critical' : val > 2 ? 'warning' : 'safe',
    description: val > 1.5 ? `Peak shock ${val.toFixed(2)}g detected` : 'No significant impacts',
    value: `${val.toFixed(2)}g`,
  };
}

function orientationFactor(t: TelemetryState): RiskFactor {
  const roll = Math.abs(t.orientation.roll);
  const contribution = roll > 25 ? Math.min((roll - 25) * 0.8, 15) : roll > 10 ? (roll - 10) * 0.4 : 0;
  return {
    id: 'orientation',
    label: 'Tilt / Orientation',
    contribution,
    severity: roll > 35 ? 'critical' : roll > 15 ? 'warning' : 'safe',
    description: roll > 10 ? `Container roll ${roll.toFixed(1)}°` : 'Orientation normal',
    value: `${roll.toFixed(1)}° roll`,
  };
}

function tamperFactor(t: TelemetryState): RiskFactor {
  const contribution = t.tamperDetected ? 20 : t.doorOpen ? 8 : 0;
  return {
    id: 'tamper',
    label: 'Security / Tamper',
    contribution,
    severity: t.tamperDetected ? 'critical' : t.doorOpen ? 'warning' : 'safe',
    description: t.tamperDetected ? 'Tamper detection triggered!' : t.doorOpen ? 'Container door is open' : 'No security events',
    value: t.tamperDetected ? 'TAMPER' : t.doorOpen ? 'DOOR OPEN' : 'Secure',
  };
}

function batteryFactor(t: TelemetryState): RiskFactor {
  const pct = t.battery.percentage;
  const contribution = pct < 10 ? 5 : pct < 20 ? 2 : 0;
  return {
    id: 'battery',
    label: 'Battery / Connectivity',
    contribution,
    severity: pct < 10 ? 'critical' : pct < 20 ? 'warning' : 'safe',
    description: pct < 20 ? `Battery at ${pct.toFixed(0)}% — data loss risk` : 'Power adequate',
    value: `${pct.toFixed(0)}%`,
  };
}

function computeSeverity(prob: number): SeverityLevel {
  if (prob >= 20) return 'critical';
  if (prob >= 8)  return 'warning';
  return 'safe';
}

export function computeRisk(telemetry: TelemetryState): DamageProbabilityModel {
  const factors = [
    tempFactor(telemetry),
    humidityFactor(telemetry),
    shockFactor(telemetry),
    orientationFactor(telemetry),
    tamperFactor(telemetry),
    batteryFactor(telemetry),
  ].filter((f) => f.contribution >= 0);

  const total = Math.min(
    factors.reduce((sum, f) => sum + f.contribution, 0) + 1.5, // baseline 1.5%
    100
  );

  return {
    totalProbability: parseFloat(total.toFixed(1)),
    severity: computeSeverity(total),
    factors: factors.sort((a, b) => b.contribution - a.contribution),
    confidence: 92,
    updatedAt: Date.now(),
  };
}

export function computeHealthScore(prob: DamageProbabilityModel): number {
  return Math.max(0, Math.round(100 - prob.totalProbability * 1.5));
}
