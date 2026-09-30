import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SeverityLevel } from '../../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  id: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  severity: SeverityLevel;
  onClick?: () => void;
  expanded?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const BORDER_COLORS: Record<SeverityLevel, string> = {
  safe:     'border-emerald-200/80 bg-white hover:border-emerald-300 hover:shadow-sm',
  warning:  'border-amber-200/90 bg-amber-50/20 hover:border-amber-300 hover:shadow-sm',
  critical: 'border-rose-200/90 bg-rose-50/20 hover:border-rose-300 hover:shadow-sm',
  info:     'border-blue-200/80 bg-blue-50/20 hover:border-blue-300 hover:shadow-sm',
  offline:  'border-slate-200 bg-slate-50/50 hover:border-slate-300',
};

export const SensorChip: React.FC<Props> = ({
  id, icon, label, value, unit, severity, onClick, expanded, children, className = '',
}) => {
  return (
    <div className={`rounded-xl border transition-all duration-200 ${BORDER_COLORS[severity]} ${className}`}>
      <button
        id={`sensor-chip-${id}`}
        className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left cursor-pointer"
        onClick={onClick}
        aria-expanded={expanded}
        aria-controls={`sensor-detail-${id}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider truncate">{label}</p>
            <p className="font-bold text-[#0F172A] text-sm font-mono tabular-nums leading-snug">
              {value}<span className="text-xs text-[#94A3B8] font-sans font-normal ml-0.5">{unit}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge severity={severity} size="sm" />
          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400 text-xs flex-shrink-0"
          >
            ▾
          </motion.span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`sensor-detail-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 border-t border-slate-100 mt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
