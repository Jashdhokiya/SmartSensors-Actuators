import React from 'react';
import { useEventStore } from '../store/eventStore';
import { StatusBadge } from '../components/ui/StatusBadge';
import type { SeverityLevel } from '../types';

type FilterSeverity = 'all' | SeverityLevel;

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const BG_COLORS: Record<string, string> = {
  active:       'bg-white',
  acknowledged: 'bg-[#F9FAFB]',
  resolved:     'bg-[#F9FAFB]',
};

export const Alerts: React.FC = () => {
  const { alerts, acknowledgeAlert, acknowledgeAll, resolveAlert } = useEventStore();
  const [filter, setFilter] = React.useState<FilterSeverity>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'acknowledged' | 'resolved'>('all');

  const filtered = alerts.filter((a) => {
    const severityOk = filter === 'all' || a.severity === filter;
    const statusOk = statusFilter === 'all' || a.status === statusFilter;
    return severityOk && statusOk;
  }).sort((a, b) => b.timestamp - a.timestamp);

  const activeCount = alerts.filter((a) => a.status === 'active').length;

  const SEVERITY_BORDER: Record<string, string> = {
    critical: 'border-l-[#DC2626]',
    warning:  'border-l-[#D97706]',
    info:     'border-l-[#2563EB]',
    safe:     'border-l-[#16A34A]',
    offline:  'border-l-[#9CA3AF]',
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#1A1D23]">Alert Center</h2>
          <p className="text-sm text-[#9CA3AF]">
            {activeCount > 0 ? `${activeCount} active alert${activeCount > 1 ? 's' : ''}` : 'No active alerts'} ·
            {alerts.length} total
          </p>
        </div>
        {activeCount > 0 && (
          <button
            id="ack-all-btn"
            onClick={acknowledgeAll}
            className="px-4 py-2 bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl text-xs font-semibold text-[#2563EB] hover:bg-[#DBEAFE] transition-colors"
          >
            ✓ Acknowledge All
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Severity filter */}
        <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-xl p-0.5">
          {(['all', 'critical', 'warning', 'info'] as const).map((s) => (
            <button
              key={s}
              id={`alert-filter-${s}`}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 capitalize ${
                filter === s ? 'bg-white text-[#1A1D23] shadow-sm' : 'text-[#9CA3AF] hover:text-[#6B7280]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-1 bg-[#F3F4F6] rounded-xl p-0.5">
          {(['all', 'active', 'acknowledged', 'resolved'] as const).map((s) => (
            <button
              key={s}
              id={`status-filter-${s}`}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 capitalize ${
                statusFilter === s ? 'bg-white text-[#1A1D23] shadow-sm' : 'text-[#9CA3AF] hover:text-[#6B7280]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-sm font-medium text-[#1A1D23]">No alerts matching filters</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Cargo is performing within expected parameters</p>
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-r-2xl border border-l-4 shadow-card p-4 ${SEVERITY_BORDER[alert.severity]} ${BG_COLORS[alert.status]} border-[#E5E7EB]`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge severity={alert.severity} size="sm" />
                    <p className="text-sm font-semibold text-[#1A1D23]">{alert.title}</p>
                  </div>
                  <p className="text-xs text-[#6B7280] mb-2">{alert.message}</p>
                  <div className="flex items-center gap-3 text-[10px] text-[#9CA3AF]">
                    <span>{timeAgo(alert.timestamp)}</span>
                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                    {alert.acknowledgedAt && <span>ACK'd {timeAgo(alert.acknowledgedAt)}</span>}
                    {alert.resolvedAt && <span>Resolved {timeAgo(alert.resolvedAt)}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {alert.status === 'active' && (
                    <>
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE] rounded-lg hover:bg-[#DBEAFE]"
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] rounded-lg hover:bg-[#DCFCE7]"
                      >
                        Resolve
                      </button>
                    </>
                  )}
                  {alert.status === 'acknowledged' && (
                    <button
                      onClick={() => resolveAlert(alert.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] rounded-lg hover:bg-[#DCFCE7]"
                    >
                      Resolve
                    </button>
                  )}
                  {alert.status === 'resolved' && (
                    <span className="px-3 py-1.5 text-xs font-medium bg-[#F3F4F6] text-[#9CA3AF] border border-[#E5E7EB] rounded-lg">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
