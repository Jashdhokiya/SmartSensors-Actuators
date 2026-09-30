import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelemetryStore } from '../store/telemetryStore';
import { FLEET_ORDERS } from '../demo/routes';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { ShipmentOrder } from '../types';

export const Admin: React.FC = () => {
  const activeOrder = useTelemetryStore((s) => s.activeOrder);
  const setActiveOrder = useTelemetryStore((s) => s.setActiveOrder);
  const navigate = useNavigate();

  const handleSelectOrder = (order: ShipmentOrder) => {
    setActiveOrder(order);
    navigate('/');
  };

  const totalOrders = FLEET_ORDERS.length;
  const underInspection = FLEET_ORDERS.filter((o) => o.status === 'under_inspection' || o.status === 'exception').length;
  const safeCount = FLEET_ORDERS.filter((o) => o.healthSeverity === 'safe').length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-[#0F172A] tracking-tight">Fleet Inspection Command Center</h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
              Admin Portal
            </span>
          </div>
          <p className="text-xs text-[#64748B] mt-0.5">
            Real-time multi-shipment digital-twin inspection & exception triage
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 font-medium">Active Twin:</span>
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-slate-900 text-white shadow-xs">
            {activeOrder.id}
          </span>
        </div>
      </div>

      {/* Fleet KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active In-Transit Assets</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-extrabold font-mono text-slate-900">{totalOrders}</p>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              100% Monitored
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Flagged Under Inspection</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-extrabold font-mono text-amber-600">{underInspection}</p>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              Requires Review
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-card">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Optimal Condition (Safe)</p>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-extrabold font-mono text-emerald-600">{safeCount}</p>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Normal Transit
            </span>
          </div>
        </div>
      </div>

      {/* In-Transit Inspection Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">In-Transit Cargo Orders Under Active Inspection</h3>
          <span className="text-xs text-slate-500">Click any consignment to launch its Digital Twin & Live Telemetry</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {FLEET_ORDERS.map((order) => {
            const isSelected = activeOrder.id === order.id;

            return (
              <div
                key={order.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-card flex flex-col justify-between overflow-hidden relative ${
                  isSelected
                    ? 'border-blue-600 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-card-hover'
                }`}
              >
                {/* Status Bar */}
                <div className={`px-4 py-2.5 border-b flex items-center justify-between ${
                  order.healthSeverity === 'critical'
                    ? 'bg-rose-50/80 border-rose-100'
                    : order.healthSeverity === 'warning'
                    ? 'bg-amber-50/80 border-amber-100'
                    : 'bg-emerald-50/80 border-emerald-100'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-slate-900">{order.id}</span>
                    {isSelected && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-600 text-white rounded-full">
                        Active Twin
                      </span>
                    )}
                  </div>
                  <StatusBadge severity={order.healthSeverity} size="sm" pulse={order.healthSeverity !== 'safe'} />
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3.5 flex-1">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 leading-snug">{order.cargoName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{order.cargoDescription}</p>
                  </div>

                  {/* Route & Progress */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                      <span>{order.origin}</span>
                      <span className="text-blue-600 font-mono">➔</span>
                      <span>{order.destination}</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-500">
                        <span>{order.distanceTraveledKm} / {order.totalDistanceKm} km</span>
                        <span>{order.progressPercent}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${order.progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                      <span>ETA: <strong className="text-slate-800">{order.eta}</strong></span>
                      <span className="font-mono">Speed: <strong className="text-slate-800">{order.speedKmH} km/h</strong></span>
                    </div>
                  </div>

                  {/* Telemetry Snapshot */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Temp</p>
                      <p className="font-mono font-bold text-slate-900">{order.temperature}°C</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Health</p>
                      <p className={`font-mono font-bold ${
                        order.healthScore > 85 ? 'text-emerald-600' : order.healthScore > 70 ? 'text-amber-600' : 'text-rose-600'
                      }`}>{order.healthScore}/100</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Battery</p>
                      <p className="font-mono font-bold text-slate-900">{order.batteryPct}%</p>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    <span>Location: <strong className="text-slate-700">{order.currentLocationName}</strong></span>
                  </p>
                </div>

                {/* Footer Action */}
                <div className="p-4 pt-0">
                  <button
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    <span>{isSelected ? '✓ Currently Inspected (View Dashboard)' : '🔍 Inspect & Load Digital Twin'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fleet Inspection Protocol Summary Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Cargo Compliance & Custody Protocol</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Shipment Identifier</th>
                <th className="px-4 py-3">Cargo Classification</th>
                <th className="px-4 py-3">Carrier / Custodian</th>
                <th className="px-4 py-3">SLA Threshold</th>
                <th className="px-4 py-3">Integrity Chain</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FLEET_ORDERS.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-slate-900">{order.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">{order.cargoType}</td>
                  <td className="px-4 py-3 text-slate-600">{order.carrier}</td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    {order.id.includes('DL-JP') ? '2.0°C – 8.0°C' : order.id.includes('MB-PN') ? '<1.0g Shock' : '< -15°C Cryo'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <span>✓</span>
                      <span>SHA-256 Verified</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSelectOrder(order)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      Inspect ➔
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
