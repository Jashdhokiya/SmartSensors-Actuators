import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import type { SeverityLevel } from '../../types';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface Props {
  data: DataPoint[];
  severity?: SeverityLevel;
  height?: number;
  showTooltip?: boolean;
  unit?: string;
}

const COLORS: Record<SeverityLevel, string> = {
  safe:     '#16A34A',
  warning:  '#D97706',
  critical: '#DC2626',
  info:     '#2563EB',
  offline:  '#9CA3AF',
};

export const MiniGraph: React.FC<Props> = ({
  data, severity = 'safe', height = 48, showTooltip = true, unit = '',
}) => {
  const color = COLORS[severity];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`gradient-${severity}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {showTooltip && (
          <Tooltip
            contentStyle={{
              background: '#fff',
              border: '1px solid #E5E7EB',
              borderRadius: '8px',
              fontSize: '11px',
              padding: '4px 8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            formatter={(val: unknown) => [`${typeof val === 'number' ? val.toFixed(2) : String(val)}${unit}`, '']}
            labelFormatter={() => ''}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#gradient-${severity})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};
