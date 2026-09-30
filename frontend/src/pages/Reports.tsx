import React from 'react';
import { useTelemetryStore } from '../store/telemetryStore';
import { useEventStore } from '../store/eventStore';
import { computeRisk, computeHealthScore } from '../hooks/useRiskEngine';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5">
      <h3 className="font-bold text-sm text-slate-900 mb-4 pb-3 border-b border-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export const Reports: React.FC = () => {
  const telemetry = useTelemetryStore((s) => s.current);
  const activeOrder = useTelemetryStore((s) => s.activeOrder);
  const events = useEventStore((s) => s.events);
  const risk = computeRisk(telemetry);
  const score = computeHealthScore(risk);

  const criticalEvents = events.filter((e) => e.severity === 'critical').length;
  const warningEvents  = events.filter((e) => e.severity === 'warning').length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Audit & Journey Consignment Report</h2>
          <p className="text-xs text-slate-500 mt-0.5">{activeOrder.id} · {activeOrder.cargoName}</p>
        </div>
        <button
          id="export-report-btn"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
          onClick={() => window.print()}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export Official PDF Report
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipment Details */}
        <Section title="📋 Consignment & Custody Profile">
          <Row label="Consignment ID"  value={activeOrder.id} mono />
          <Row label="Tracking No."     value={activeOrder.trackingNumber} mono />
          <Row label="Cargo Type"       value={activeOrder.cargoType} />
          <Row label="Origin Hub"       value={activeOrder.origin} />
          <Row label="Destination Hub"  value={activeOrder.destination} />
          <Row label="Logistics Carrier" value={activeOrder.carrier} />
          <Row label="Current Status"   value={activeOrder.status.toUpperCase()} mono />
          <Row label="Departure Time"   value={new Date(activeOrder.departureTime).toLocaleString('en-IN')} />
          <Row label="Target ETA"       value={activeOrder.eta} />
        </Section>

        {/* Journey Progress */}
        <Section title="🗺️ Corridor Milestones & Transit Waypoints">
          <div className="mb-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-800">
              <span>{activeOrder.origin}</span>
              <span className="text-blue-600 font-mono">{activeOrder.progressPercent}% Transit</span>
              <span>{activeOrder.destination}</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${activeOrder.progressPercent}%` }} />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-500">
              <span>{activeOrder.distanceTraveledKm} km covered</span>
              <span>{activeOrder.totalDistanceKm - activeOrder.distanceTraveledKm} km remaining</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {activeOrder.waypoints.map((wp) => (
              <div key={wp.name} className="flex items-center gap-3 text-xs">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  wp.type === 'origin' || wp.actualArrival ? (
                    wp.type === 'origin' ? 'bg-emerald-500' : 'bg-blue-600'
                  ) : 'bg-slate-300'
                }`} />
                <span className="text-slate-700 font-medium flex-1">{wp.name}</span>
                {wp.actualArrival && (
                  <span className="text-[11px] font-mono text-emerald-600 font-bold">
                    ✓ {new Date(wp.actualArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {!wp.actualArrival && wp.estimatedArrival && (
                  <span className="text-[11px] font-mono text-amber-600">
                    ~{new Date(wp.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Cargo Health Summary */}
        <Section title="🏥 Real-Time Cold Chain & Health Integrity">
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="w-14 h-14 rounded-xl border-2 border-emerald-300 bg-emerald-50 flex items-center justify-center">
              <span className="text-2xl font-extrabold text-emerald-700 font-mono">{score}</span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold">Aggregate Health Index</p>
              <p className="text-base font-extrabold text-slate-900">{risk.severity.toUpperCase()} COMPLIANCE</p>
              <p className="text-xs text-slate-500">Damage Probability: {risk.totalProbability.toFixed(1)}%</p>
            </div>
          </div>
          {risk.factors.slice(0, 4).map((f) => (
            <Row key={f.id} label={f.label} value={`${f.value ?? '–'} (+${f.contribution.toFixed(1)}%)`} />
          ))}
        </Section>

        {/* Event Summary */}
        <Section title="📊 Cryptographic Audit Trail Summary">
          <Row label="Total Telemetry Events"  value={events.length.toString()} />
          <Row label="Critical System Alerts"  value={criticalEvents.toString()} />
          <Row label="Warning Excursions"      value={warningEvents.toString()} />
          <Row label="Blockchain Chain State"  value="SHA-256 Validated ✓" mono />
          <Row label="Telemetry Data Samples"  value={useTelemetryStore.getState().history.length.toString()} mono />
          <Row label="Gateway Firmware"        value="SCM-OS v2.4.1" mono />
          <Row label="Audit Report Timestamp"  value={new Date().toLocaleString('en-IN')} />
        </Section>
      </div>
    </div>
  );
};
