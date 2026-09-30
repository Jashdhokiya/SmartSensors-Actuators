import React, { useState } from 'react';
import { useEventStore } from '../../store/eventStore';
import { motion, AnimatePresence } from 'framer-motion';
import type { SeverityLevel, EventType } from '../../types';

const EVENT_ICONS: Partial<Record<EventType, string>> = {
  temperature_excursion: '🌡️',
  humidity_excursion:    '💧',
  shock_event:           '💥',
  door_open:             '🚪',
  door_close:            '🔒',
  tilt_event:            '📐',
  tamper_alert:          '⚠️',
  battery_low:           '🔋',
  gps_loss:              '📡',
  route_deviation:       '🗺️',
  checkpoint:            '📍',
  handover:              '🤝',
  custom:                '📌',
};

const SEVERITY_COLORS: Record<SeverityLevel, { dot: string; border: string; bg: string; text: string }> = {
  safe:     { dot: 'bg-emerald-500', border: 'border-emerald-200', bg: 'bg-emerald-50/40', text: 'text-emerald-800' },
  warning:  { dot: 'bg-amber-500',   border: 'border-amber-200',   bg: 'bg-amber-50/40',   text: 'text-amber-800' },
  critical: { dot: 'bg-rose-500',    border: 'border-rose-200',    bg: 'bg-rose-50/40',    text: 'text-rose-800' },
  info:     { dot: 'bg-blue-500',    border: 'border-blue-200',    bg: 'bg-blue-50/40',    text: 'text-blue-800' },
  offline:  { dot: 'bg-slate-400',   border: 'border-slate-200',   bg: 'bg-slate-50/40',   text: 'text-slate-800' },
};

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export const EventTimeline: React.FC<{ maxItems?: number }> = ({ maxItems = 8 }) => {
  const events = useEventStore((s) => s.events);
  const acknowledgeEvent = useEventStore((s) => s.acknowledgeEvent);
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp).slice(0, maxItems);

  return (
    <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-card p-5 sm:p-6">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-sm text-[#0F172A]">Event Intelligence & Audit Log</h3>
          <p className="text-xs text-[#64748B]">Cryptographically signed telemetry events</p>
        </div>
        <span className="text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
          {events.length} Events
        </span>
      </div>

      <div className="relative">
        {/* Timeline vertical connector */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-200" />

        <div className="space-y-3">
          {sorted.map((event, i) => {
            const colors = SEVERITY_COLORS[event.severity];
            const isSelected = selected === event.id;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative pl-10"
              >
                {/* Status Dot */}
                <div className={`absolute left-2.5 top-3.5 w-3 h-3 rounded-full border-2 border-white ${colors.dot} shadow-xs`} />

                <div
                  className={`rounded-xl border p-3.5 transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? `border-blue-300 ring-2 ring-blue-500/10 ${colors.bg}`
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-xs'
                  }`}
                  onClick={() => setSelected(isSelected ? null : event.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="text-lg flex-shrink-0">{EVENT_ICONS[event.type] ?? '📌'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold leading-tight ${colors.text}`}>{event.title}</p>
                          {!event.acknowledged && (
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{event.description}</p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                      {timeAgo(event.timestamp)}
                    </span>
                  </div>

                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500"
                      >
                        <div className="flex items-center gap-3">
                          <span>{event.measured ? '🔬 Direct Sensor' : `🤖 Inferred Model (${event.confidence}%)`}</span>
                          <span>·</span>
                          <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                          {event.location && (
                            <>
                              <span>·</span>
                              <span className="font-mono">📍 {event.location.lat.toFixed(3)}°N, {event.location.lng.toFixed(3)}°E</span>
                            </>
                          )}
                        </div>

                        {!event.acknowledged && (
                          <button
                            onClick={(e) => { e.stopPropagation(); acknowledgeEvent(event.id); }}
                            className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                          >
                            Acknowledge Event
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
