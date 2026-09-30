import React from 'react';
import { useUIStore } from '../../store/uiStore';

type ViewMode = 'exterior' | 'interior' | 'sensors';

const modes: { id: ViewMode; label: string; icon: string; desc: string }[] = [
  { id: 'exterior', label: 'Exterior', icon: '🏗️', desc: 'Solid ISO container enclosure' },
  { id: 'interior', label: 'Interior', icon: '📦', desc: 'Cutaway cargo & thermal view' },
  { id: 'sensors',  label: 'Sensors',  icon: '📡', desc: '3D interactive sensor beacons' },
];

export const ViewModeSelector: React.FC = () => {
  const { twinViewMode, setTwinViewMode } = useUIStore();

  return (
    <div className="flex items-center bg-[#F1F5F9] p-1 rounded-xl gap-1 border border-[#E2E8F0] shadow-inner">
      {modes.map(({ id, label, icon }) => {
        const isActive = twinViewMode === id;
        return (
          <button
            key={id}
            id={`twin-view-${id}`}
            onClick={() => setTwinViewMode(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
              isActive
                ? 'bg-white text-[#0F172A] shadow-sm ring-1 ring-slate-900/5'
                : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/50'
            }`}
          >
            <span className="text-sm">{icon}</span>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
