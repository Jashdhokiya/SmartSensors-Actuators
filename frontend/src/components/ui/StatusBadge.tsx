import React from 'react';
import type { SeverityLevel } from '../../types';

interface Props {
  severity: SeverityLevel;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  className?: string;
}

const LABELS: Record<SeverityLevel, string> = {
  safe: 'SAFE',
  warning: 'WARNING',
  critical: 'CRITICAL',
  info: 'INFO',
  offline: 'OFFLINE',
};

const STYLES: Record<SeverityLevel, string> = {
  safe:     'text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]',
  warning:  'text-[#D97706] bg-[#FFFBEB] border-[#FDE68A]',
  critical: 'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA]',
  info:     'text-[#2563EB] bg-[#EFF6FF] border-[#BFDBFE]',
  offline:  'text-[#9CA3AF] bg-[#F9FAFB] border-[#E5E7EB]',
};

const DOT_STYLES: Record<SeverityLevel, string> = {
  safe:     'bg-[#16A34A]',
  warning:  'bg-[#D97706]',
  critical: 'bg-[#DC2626]',
  info:     'bg-[#2563EB]',
  offline:  'bg-[#9CA3AF]',
};

const SIZES = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

export const StatusBadge: React.FC<Props> = ({
  severity, label, size = 'md', pulse = false, className = '',
}) => {
  const text = label ?? LABELS[severity];
  return (
    <span
      className={`inline-flex items-center font-semibold border rounded-full tracking-wide uppercase ${STYLES[severity]} ${SIZES[size]} ${className}`}
    >
      <span
        className={`inline-block rounded-full flex-shrink-0 ${DOT_STYLES[severity]} ${
          size === 'sm' ? 'w-1.5 h-1.5' : size === 'lg' ? 'w-2.5 h-2.5' : 'w-2 h-2'
        } ${pulse && severity !== 'offline' ? 'animate-pulse' : ''}`}
      />
      {text}
    </span>
  );
};
