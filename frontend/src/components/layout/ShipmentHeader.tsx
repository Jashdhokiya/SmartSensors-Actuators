import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LiveIndicator } from '../ui/LiveIndicator';
import { StatusBadge } from '../ui/StatusBadge';
import { NotificationBell } from '../ui/NotificationBell';
import { useTelemetryStore } from '../../store/telemetryStore';

export const ShipmentHeader: React.FC = () => {
  const telemetry = useTelemetryStore((s) => s.current);
  const activeOrder = useTelemetryStore((s) => s.activeOrder);
  const isBackendLive = useTelemetryStore((s) => s.isBackendLive);
  const backendInfo = useTelemetryStore((s) => s.backendInfo);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Overview' },
    { path: '/analytics', label: 'Analytics' },
    { path: '/events', label: 'Events' },
    { path: '/alerts', label: 'Alerts' },
    { path: '/reports', label: 'Reports' },
    { path: '/admin', label: 'Fleet Admin (3 Orders)', badge: 'Admin' },
  ];

  return (
    <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-40 shadow-2xs">
      {/* Top row */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        {/* Logo + ID */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-xs">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Shipment Consignment</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                {activeOrder.cargoType}
              </span>
            </div>
            <p className="font-mono text-sm font-extrabold text-[#0F172A] leading-tight mt-0.5">{activeOrder.id}</p>
          </div>
        </div>

        {/* Route Corridor */}
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80">
          <span className="text-xs font-bold text-slate-800">{activeOrder.origin}</span>
          <div className="flex items-center gap-1">
            <div className="h-0.5 w-3.5 bg-blue-600" />
            <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
          <span className="text-xs font-bold text-slate-800">{activeOrder.destination}</span>
          <span className="text-[11px] font-mono text-slate-400 ml-1">({activeOrder.totalDistanceKm} km)</span>
        </div>

        {/* Journey Progress */}
        <div className="hidden lg:flex flex-col gap-1 min-w-[130px]">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Progress</span>
            <span className="font-bold text-slate-900 font-mono">{activeOrder.progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all duration-700"
              style={{ width: `${activeOrder.progressPercent}%` }}
            />
          </div>
        </div>

        {/* Right side live status, Cloud API status & notifications */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {/* Cloud REST API / MQTT Status pill */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
              isBackendLive
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-2xs'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
            title={
              isBackendLive
                ? `Cloud REST API Connected | MQTT: ${backendInfo?.mqttConnected ? 'Connected (' + backendInfo?.broker + ')' : 'Connecting'} | DB: ${backendInfo?.dbConnected ? 'PostgreSQL Live' : 'Memory Cache'}`
                : 'Cloud REST API not detected on localhost:5000 (Running in standalone demo simulator mode)'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isBackendLive ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-300' : 'bg-amber-400 ring-2 ring-amber-200'
              }`}
            />
            <span>{isBackendLive ? 'Cloud REST Live' : 'Demo Local Sim'}</span>
          </div>

          <StatusBadge
            severity={activeOrder.healthSeverity}
            label={activeOrder.status === 'under_inspection' ? 'UNDER INSPECTION' : activeOrder.status === 'exception' ? 'EXCEPTION' : 'IN TRANSIT'}
            pulse
          />
          <LiveIndicator lastUpdate={telemetry.lastUpdate} />
          <NotificationBell />
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Dashboard navigation">
          {navItems.map(({ path, label, badge }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => navigate(path)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all duration-150 whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  active
                    ? 'border-blue-600 text-blue-600 bg-blue-50/40'
                    : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <span>{label}</span>
                {badge && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-600 text-white font-mono">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
