import React from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { useUIStore } from '../../store/uiStore';
import { SensorChip } from '../ui/SensorChip';
import { MiniGraph } from '../ui/MiniGraph';
import type { SeverityLevel } from '../../types';

export const SensorSummary: React.FC = () => {
  const telemetry = useTelemetryStore((s) => s.current);
  const history   = useTelemetryStore((s) => s.history);
  const { activeSensor, setActiveSensor } = useUIStore();

  const tempHistory  = history.map((h) => ({ timestamp: h.timestamp, value: h.temperature }));
  const humidHistory = history.map((h) => ({ timestamp: h.timestamp, value: h.humidity }));
  const shockHistory = history.map((h) => ({ timestamp: h.timestamp, value: h.shock }));

  const sensors: {
    id: 'temperature' | 'humidity' | 'shock' | 'pressure' | 'battery' | 'door';
    icon: string;
    label: string;
    value: string;
    unit: string;
    severity: SeverityLevel;
    extra?: React.ReactNode;
  }[] = [
    {
      id: 'temperature',
      icon: '🌡️', label: 'Internal Temperature', value: telemetry.temperature.value.toFixed(1),
      unit: '°C', severity: telemetry.temperature.status,
      extra: (
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span>Min: <strong className="text-slate-900">{telemetry.temperature.min?.toFixed(1)}°C</strong></span>
            <span>Avg: <strong className="text-slate-900">{telemetry.temperature.avg?.toFixed(1)}°C</strong></span>
            <span>Max: <strong className="text-slate-900">{telemetry.temperature.max?.toFixed(1)}°C</strong></span>
          </div>
          <MiniGraph data={tempHistory.slice(-30)} severity={telemetry.temperature.status} height={56} unit="°C" />
          <p className="text-[10px] text-slate-400">Target Range: 2.0°C – 8.0°C (Pharma Cold Chain Protocol)</p>
        </div>
      ),
    },
    {
      id: 'humidity',
      icon: '💧', label: 'Relative Humidity', value: telemetry.humidity.value.toFixed(0),
      unit: '%', severity: telemetry.humidity.status,
      extra: (
        <div className="space-y-2 pt-1">
          <MiniGraph data={humidHistory.slice(-30)} severity={telemetry.humidity.status} height={56} unit="%" />
          <p className="text-[10px] text-slate-400">Acceptable Condensation Window: 40% – 70% RH</p>
        </div>
      ),
    },
    {
      id: 'shock',
      icon: '⚡', label: '3-Axis Shock / Impact', value: telemetry.shock.value.toFixed(2),
      unit: 'g', severity: telemetry.shock.status,
      extra: (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
            {(['x','y','z'] as const).map((axis) => (
              <div key={axis} className="text-center">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">{axis}-axis</p>
                <p className="text-xs font-mono font-bold text-slate-900">{telemetry.shock.vector[axis].toFixed(2)}g</p>
              </div>
            ))}
          </div>
          <MiniGraph data={shockHistory.slice(-30)} severity={telemetry.shock.status} height={50} unit="g" />
          <p className="text-[10px] text-slate-400">Dynamic Threshold: Normal &lt;1.5g · Warning 1.5–3.0g · Severe &gt;3.0g</p>
        </div>
      ),
    },
    {
      id: 'door',
      icon: '🚪', label: 'Door & Enclosure Tamper',
      value: telemetry.doorOpen ? 'DOOR OPEN' : 'SECURE',
      unit: '',
      severity: telemetry.doorOpen ? 'critical' : telemetry.tamperDetected ? 'critical' : 'safe',
      extra: (
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-500">Optical Ambient Light</span>
            <span className="font-mono font-bold text-slate-900">{telemetry.lightLevel.value.toFixed(0)} lux</span>
          </div>
          <div className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
            <span className="text-slate-500">Physical Switch</span>
            <span className={`font-bold ${telemetry.tamperDetected ? 'text-rose-600' : 'text-emerald-600'}`}>
              {telemetry.tamperDetected ? 'TAMPER DETECTED' : 'Contact Intact'}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'pressure',
      icon: '🌬️', label: 'Barometric Pressure', value: telemetry.pressure.value.toFixed(1),
      unit: 'hPa', severity: telemetry.pressure.status,
      extra: (
        <div className="pt-1 text-[11px] text-slate-500">
          Atmospheric baseline seal: 1013.2 hPa · Altitude compensation active
        </div>
      ),
    },
    {
      id: 'battery',
      icon: '🔋', label: 'IoT Gateway Battery', value: telemetry.battery.percentage.toFixed(0),
      unit: '%', severity: telemetry.battery.percentage < 20 ? 'critical' : telemetry.battery.percentage < 40 ? 'warning' : 'safe',
      extra: (
        <div className="space-y-1.5 pt-1">
          <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 p-2 rounded-lg border border-slate-100">
            <div>
              <p className="text-[10px] text-slate-400">Voltage</p>
              <p className="text-xs font-mono font-bold text-slate-900">{telemetry.battery.voltage.toFixed(2)}V</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Current</p>
              <p className="text-xs font-mono font-bold text-slate-900">{telemetry.battery.current}mA</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400">Est. Runtime</p>
              <p className="text-xs font-mono font-bold text-slate-900">{telemetry.battery.estimatedRuntime.toFixed(0)}h</p>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between pb-1 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-sm text-[#0F172A]">Telemetry Sensors</h3>
          <p className="text-xs text-[#64748B]">Click any card to expand waveform history</p>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
          6 Active Probes
        </span>
      </div>

      <div className="space-y-2.5">
        {sensors.map((s) => (
          <SensorChip
            key={s.id}
            id={s.id}
            icon={s.icon}
            label={s.label}
            value={s.value}
            unit={s.unit}
            severity={s.severity}
            expanded={activeSensor === s.id}
            onClick={() => setActiveSensor(s.id as Parameters<typeof setActiveSensor>[0])}
          >
            {s.extra}
          </SensorChip>
        ))}
      </div>
    </div>
  );
};
