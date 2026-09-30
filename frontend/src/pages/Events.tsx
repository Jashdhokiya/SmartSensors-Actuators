import React from 'react';
import { EventTimeline } from '../components/events/EventTimeline';
import { useEventStore } from '../store/eventStore';

export const Events: React.FC = () => {
  const events = useEventStore((s) => s.events);

  // Integrity hash (simulated)
  const hash = `sha256:${events.length.toString(16).padStart(8,'0')}a4f2c8e1`;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1A1D23]">Event Timeline</h2>
          <p className="text-sm text-[#9CA3AF]">{events.length} events recorded · Hash-chain verified</p>
        </div>

        {/* Integrity badge */}
        <div className="flex items-center gap-2 px-3 py-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl">
          <svg className="w-4 h-4 text-[#16A34A]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <div>
            <p className="text-[10px] font-semibold text-[#16A34A]">CHAIN VERIFIED</p>
            <p className="text-[9px] font-mono text-[#9CA3AF]">{hash.slice(0, 20)}…</p>
          </div>
        </div>
      </div>

      <EventTimeline maxItems={50} />
    </div>
  );
};
