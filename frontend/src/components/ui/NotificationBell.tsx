import React from 'react';
import { useEventStore } from '../../store/eventStore';
import { useUIStore } from '../../store/uiStore';
import { motion, AnimatePresence } from 'framer-motion';

export const NotificationBell: React.FC = () => {
  const { alerts, unreadCount, acknowledgeAll, acknowledgeAlert } = useEventStore();
  const { notificationsOpen, toggleNotifications } = useUIStore();

  const sorted = [...alerts].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  const SEVERITY_COLORS: Record<string, string> = {
    critical: 'border-l-[#DC2626] bg-[#FEF2F2]',
    warning:  'border-l-[#D97706] bg-[#FFFBEB]',
    info:     'border-l-[#2563EB] bg-[#EFF6FF]',
    safe:     'border-l-[#16A34A] bg-[#F0FDF4]',
    offline:  'border-l-[#9CA3AF] bg-[#F9FAFB]',
  };

  return (
    <div className="relative">
      <button
        id="notification-bell-btn"
        onClick={toggleNotifications}
        className="relative p-2 rounded-xl hover:bg-[#F3F4F6] transition-colors duration-150"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 bg-[#DC2626] text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {notificationsOpen && (
          <motion.div
            id="notification-dropdown"
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#E5E7EB] z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
              <h3 className="font-semibold text-sm text-[#1A1D23]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={acknowledgeAll}
                  className="text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium"
                >
                  Acknowledge all
                </button>
              )}
            </div>

            <div className="max-h-[360px] overflow-y-auto">
              {sorted.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#9CA3AF]">No notifications</div>
              ) : (
                sorted.map((alert) => (
                  <div
                    key={alert.id}
                    className={`border-l-4 px-4 py-3 border-b border-[#F9FAFB] last:border-b-0 ${SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info} ${!alert.acknowledged ? 'opacity-100' : 'opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#1A1D23] leading-tight">{alert.title}</p>
                        <p className="text-[11px] text-[#6B7280] mt-0.5 leading-snug">{alert.message}</p>
                        <p className="text-[10px] text-[#9CA3AF] mt-1">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      {!alert.acknowledged && (
                        <button
                          onClick={() => acknowledgeAlert(alert.id)}
                          className="text-[10px] text-[#6B7280] hover:text-[#1A1D23] mt-0.5 flex-shrink-0 border border-[#E5E7EB] rounded px-1.5 py-0.5"
                        >
                          ACK
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
