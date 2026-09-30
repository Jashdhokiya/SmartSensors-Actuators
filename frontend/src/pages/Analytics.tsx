import React from 'react';
import {
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { useTelemetryStore } from '../store/telemetryStore';

type TimeRange = '30m' | '1h' | '6h' | 'full';

const RANGE_LABELS: Record<TimeRange, string> = {
  '30m': '30 Min', '1h': '1 Hour', '6h': '6 Hours', 'full': 'Full Journey',
};

type HistoryEntry = {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  shock: number;
  battery: number;
  speed: number;
  lat: number;
  lng: number;
};

function filterByRange(data: HistoryEntry[], range: TimeRange) {
  const now = Date.now();
  const windows: Record<TimeRange, number> = { '30m': 1800_000, '1h': 3600_000, '6h': 21600_000, 'full': Infinity };
  const cutoff = now - windows[range];
  return data.filter((d: HistoryEntry) => d.timestamp >= cutoff);
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

interface TooltipItem {
  name: string;
  value: number | string;
  color: string;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-card p-3 text-xs">
      <p className="font-medium text-[#1A1D23] mb-2">{label ? formatTime(label) : ''}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#6B7280]">{p.name}:</span>
          <span className="font-mono text-[#1A1D23]">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const Analytics: React.FC = () => {
  const history = useTelemetryStore((s) => s.history);
  const telemetry = useTelemetryStore((s) => s.current);
  const [range, setRange] = React.useState<TimeRange>('1h');

  const filtered = filterByRange(history, range);

  const chartProps = {
    width: 500, height: 200,
    margin: { top: 8, right: 12, left: -20, bottom: 0 },
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1A1D23]">Historical Analytics</h2>
          <p className="text-sm text-[#9CA3AF]">Sensor telemetry over time · SCM-2024-DL-MB-7821</p>
        </div>

        {/* Time range selector */}
        <div className="flex items-center bg-[#F3F4F6] rounded-xl p-0.5 gap-0.5">
          {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
            <button
              key={r}
              id={`range-${r}`}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                range === r ? 'bg-white text-[#1A1D23] shadow-sm' : 'text-[#9CA3AF] hover:text-[#6B7280]'
              }`}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length < 3 && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 text-sm text-[#D97706]">
          ⏳ Telemetry data points are accumulating in real-time. Live stream is active.
        </div>
      )}

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Temperature */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[#1A1D23]">🌡️ Temperature</h3>
            <span className="text-xs font-mono text-[#1A1D23]">{telemetry.temperature.value.toFixed(1)}°C</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={filtered} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <YAxis tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={8}  stroke="#D97706" strokeDasharray="4 4" label={{ value: 'Max 8°C', fontSize: 9 }} />
              <ReferenceLine y={2}  stroke="#2563EB" strokeDasharray="4 4" label={{ value: 'Min 2°C', fontSize: 9 }} />
              <defs>
                <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16A34A" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#16A34A" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="temperature" name="Temp (°C)" stroke="#16A34A" fill="url(#tempGrad)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Humidity */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[#1A1D23]">💧 Humidity</h3>
            <span className="text-xs font-mono text-[#1A1D23]">{telemetry.humidity.value.toFixed(0)}%</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={filtered} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <YAxis tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="humidity" name="Humidity (%)" stroke="#2563EB" fill="url(#humGrad)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Shock */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[#1A1D23]">⚡ Shock / Vibration</h3>
            <span className="text-xs font-mono text-[#1A1D23]">{telemetry.shock.value.toFixed(2)}g peak</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={filtered} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <YAxis tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={1.5} stroke="#D97706" strokeDasharray="4 4" />
              <ReferenceLine y={3.0} stroke="#DC2626" strokeDasharray="4 4" />
              <Bar dataKey="shock" name="Shock (g)" fill="#D97706" opacity={0.7} radius={[2, 2, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Battery + Speed */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-[#1A1D23]">🔋 Battery & Speed</h3>
            <span className="text-xs font-mono text-[#1A1D23]">
              {telemetry.battery.percentage.toFixed(0)}% · {telemetry.speed.value.toFixed(0)} km/h
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={filtered} {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#E5E7EB" />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="left"  type="monotone" dataKey="battery" name="Battery (%)" stroke="#16A34A" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="speed"   name="Speed (km/h)" stroke="#7C3AED" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
