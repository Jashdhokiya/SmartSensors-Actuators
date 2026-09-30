import React from 'react';
import { useTelemetryStore } from '../../store/telemetryStore';
import { computeRisk, computeHealthScore } from '../../hooks/useRiskEngine';
import { StatusBadge } from '../ui/StatusBadge';
import { motion } from 'framer-motion';

function HealthRing({ score, severity }: { score: number; severity: string }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  const colorMap: Record<string, string> = {
    safe: '#10B981',
    warning: '#F59E0B',
    critical: '#EF4444',
  };
  const color = colorMap[severity] ?? '#3B82F6';

  return (
    <div className="relative flex items-center justify-center">
      <svg width={120} height={120} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={60} cy={60} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={10} />
        <motion.circle
          cx={60} cy={60} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute text-center flex flex-col items-center justify-center">
        <p className="text-3xl font-extrabold text-[#0F172A] font-mono tracking-tight">{score}</p>
        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase">Health / 100</p>
      </div>
    </div>
  );
}

export const CargoHealthPanel: React.FC = () => {
  const telemetry = useTelemetryStore((s) => s.current);
  const [showWhy, setShowWhy] = React.useState(false);

  const risk = computeRisk(telemetry);
  const score = computeHealthScore(risk);
  const severity = risk.severity;

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card p-5">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-2 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-sm text-[#0F172A]">Cargo Integrity & Health</h3>
          <p className="text-xs text-[#64748B]">Real-time cold chain risk index</p>
        </div>
        <StatusBadge severity={severity} pulse={severity !== 'safe'} />
      </div>

      {/* Ring + Key Risk Metrics */}
      <div className="flex items-center gap-5">
        <HealthRing score={score} severity={severity} />

        <div className="flex-1 space-y-2.5">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Damage Probability</p>
            <p className="text-xl font-extrabold font-mono text-[#0F172A]">
              {risk.totalProbability.toFixed(1)}
              <span className="text-xs font-normal text-[#94A3B8] ml-0.5">%</span>
            </p>
          </div>
          <div className="flex justify-between items-center text-xs px-1">
            <span className="text-slate-500">Model Confidence</span>
            <span className="font-mono font-bold text-slate-800">{risk.confidence}%</span>
          </div>
        </div>
      </div>

      {/* Top 3 Risk Factors */}
      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Primary Risk Contributors</p>
        {risk.factors.slice(0, 3).map((f) => (
          <div key={f.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium truncate">{f.label}</span>
              <span className="font-mono font-bold text-slate-900 ml-2">+{f.contribution.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  backgroundColor: f.severity === 'critical' ? '#EF4444' : f.severity === 'warning' ? '#F59E0B' : '#10B981',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(f.contribution * 5, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Explainability toggle */}
      <button
        id="health-why-btn"
        onClick={() => setShowWhy(!showWhy)}
        className="mt-3.5 w-full py-1.5 px-2 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer"
      >
        <span>{showWhy ? '▴ Hide risk factor breakdown' : '▾ Why this health score?'}</span>
        <span className="text-[11px] font-mono">{risk.factors.length} factors evaluated</span>
      </button>

      {showWhy && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden mt-2 pt-2 border-t border-slate-100 space-y-2"
        >
          {risk.factors.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-2 text-xs bg-slate-50/70 p-2 rounded-lg">
              <div className="flex items-start gap-2">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  f.severity === 'critical' ? 'bg-rose-500' :
                  f.severity === 'warning'  ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <div>
                  <p className="font-semibold text-slate-800">{f.label}</p>
                  <p className="text-[11px] text-slate-500">{f.description}</p>
                </div>
              </div>
              <span className="font-mono font-bold text-slate-900 flex-shrink-0">{f.value}</span>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 pt-1 text-center">
            ISO-22367 / WHO TRS 961 Cold Chain Compliance Engine
          </p>
        </motion.div>
      )}
    </div>
  );
};
