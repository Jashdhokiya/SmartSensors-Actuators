import React from 'react';
import { ContainerScene } from '../components/twin/ContainerScene';
import { CargoHealthPanel } from '../components/health/CargoHealthPanel';
import { SensorSummary } from '../components/sensors/SensorSummary';
import { LiveMap } from '../components/map/LiveMap';
import { EventTimeline } from '../components/events/EventTimeline';
import { useTelemetryStore } from '../store/telemetryStore';
import { useEventStore } from '../store/eventStore';
import { StatusBadge } from '../components/ui/StatusBadge';

function ActiveAlertsBanner() {
  const alerts = useEventStore((s) => s.alerts.filter((a) => a.status === 'active' && !a.acknowledged));
  const acknowledgeAll = useEventStore((s) => s.acknowledgeAll);
  if (alerts.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-red-50 via-rose-50 to-amber-50 border border-red-200/80 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-red-600 font-bold flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-900 tracking-wide uppercase">
              {alerts.length} Active System Alert{alerts.length > 1 ? 's' : ''}
            </span>
            <StatusBadge severity="critical" size="sm" pulse />
          </div>
          <p className="text-xs text-slate-700 mt-0.5 font-medium">
            {alerts[0]?.title} — <span className="text-slate-500">{alerts[0]?.message}</span>
          </p>
        </div>
      </div>
      <button
        onClick={acknowledgeAll}
        className="px-3.5 py-1.5 rounded-xl bg-white border border-red-200 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer"
      >
        ✓ Acknowledge All
      </button>
    </div>
  );
}

// Quick stats bar with sleek SVG vector icons (NO emojis)
function QuickStats() {
  const telemetry = useTelemetryStore((s) => s.current);

  const stats = [
    {
      label: 'Temperature',
      value: `${telemetry.temperature.value.toFixed(1)}°C`,
      severity: telemetry.temperature.status,
      sub: 'Setpoint: 2.0–8.0°C',
      icon: (
        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m0 0a3 3 0 100 6 3 3 0 000-6zm0-12a3 3 0 00-3 3v8.17a5 5 0 106 0V6a3 3 0 00-3-3z" />
        </svg>
      ),
    },
    {
      label: 'Humidity',
      value: `${telemetry.humidity.value.toFixed(0)}%`,
      severity: telemetry.humidity.status,
      sub: 'Target: 60% RH',
      icon: (
        <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      label: 'Impact Shock',
      value: `${telemetry.shock.value.toFixed(2)}g`,
      severity: telemetry.shock.status,
      sub: '3-Axis Peak Acceleration',
      icon: (
        <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
    {
      label: 'Battery',
      value: `${telemetry.battery.percentage.toFixed(0)}%`,
      severity: (telemetry.battery.percentage < 20 ? 'critical' : telemetry.battery.percentage < 40 ? 'warning' : 'safe') as import('../types').SeverityLevel,
      sub: `${telemetry.battery.estimatedRuntime.toFixed(0)}h Remaining`,
      icon: (
        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 10.5h.75a1.5 1.5 0 011.5 1.5v0a1.5 1.5 0 01-1.5 1.5H21M3.75 6.75h14.25a2.25 2.25 0 012.25 2.25v6a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 15V9a2.25 2.25 0 012.25-2.25z" />
        </svg>
      ),
    },
    {
      label: 'Road Speed',
      value: `${telemetry.speed.value.toFixed(0)} km/h`,
      severity: telemetry.speed.value === 0 ? 'warning' : 'info' as const,
      sub: telemetry.speed.value === 0 ? '🛑 Stationary' : 'Transit Corridor',
      icon: (
        <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
        </svg>
      ),
    },
    {
      label: 'Telemetry Link',
      value: `${telemetry.connectivity.type} ${telemetry.connectivity.signalStrength}%`,
      severity: telemetry.connectivity.isOnline ? 'safe' : 'offline' as const,
      sub: '4G LTE Node Online',
      icon: (
        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.008H12V12z" />
        </svg>
      ),
    },
  ];

  const DOT: Record<string, string> = {
    safe: 'bg-emerald-500 ring-emerald-200',
    warning: 'bg-amber-500 ring-amber-200',
    critical: 'bg-rose-500 ring-rose-200',
    info: 'bg-blue-500 ring-blue-200',
    offline: 'bg-slate-400 ring-slate-200',
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card hover:shadow-card-hover transition-all duration-200 p-3.5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{s.label}</span>
            <span className={`w-2 h-2 rounded-full ring-4 ${DOT[s.severity]}`} />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-base font-bold font-mono text-[#0F172A] tracking-tight">{s.value}</p>
            <div className="p-1 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
              {s.icon}
            </div>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-1 font-medium">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

export const Overview: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Quick live telemetry stats with SVG icons */}
      <QuickStats />

      {/* Active alerts warning banner */}
      <ActiveAlertsBanner />

      {/* Main Grid: Twin + Map on Left, Health + Sensors on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Digital Twin & Live Map */}
        <div className="lg:col-span-7 space-y-6">
          <ContainerScene />
          <LiveMap />
        </div>

        {/* Right Column (5 cols): Cargo Health & Sensor Suite */}
        <div className="lg:col-span-5 space-y-6">
          <CargoHealthPanel />
          <SensorSummary />
        </div>
      </div>

      {/* Bottom Section: Full Width Event Timeline */}
      <div className="pt-2">
        <EventTimeline maxItems={8} />
      </div>
    </div>
  );
};
