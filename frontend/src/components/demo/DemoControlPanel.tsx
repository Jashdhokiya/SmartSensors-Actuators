import React from 'react';
import { useDemoStore, SCENARIOS } from '../../store/demoStore';
import { useUIStore } from '../../store/uiStore';
import { triggerScenarioImmediate } from '../../demo/SimulationEngine';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScenarioId } from '../../types';

const SEVERITY_COLORS: Record<string, string> = {
  safe:     'border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]',
  warning:  'border-[#FDE68A] bg-[#FFFBEB] text-[#D97706]',
  critical: 'border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]',
  info:     'border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]',
};

export const DemoControlPanel: React.FC = () => {
  const { isRunning, activeScenario, speedMultiplier, startDemo, stopDemo, setSpeed } = useDemoStore();
  const { demoControlsOpen, toggleDemoControls } = useUIStore();

  const handleSelectScenario = (id: ScenarioId) => {
    triggerScenarioImmediate(id);
  };

  const handleReset = () => {
    triggerScenarioImmediate('normal');
  };

  return (
    <>
      {/* Floating button */}
      <button
        id="demo-panel-toggle"
        onClick={toggleDemoControls}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all duration-200 backdrop-blur-md ${
          isRunning
            ? 'bg-white/95 border-[#E5E7EB] text-[#1A1D23] hover:shadow-2xl hover:border-[#CBD5E1]'
            : 'bg-[#F3F4F6]/95 border-[#E5E7EB] text-[#9CA3AF]'
        }`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? 'bg-[#16A34A] animate-pulse' : 'bg-[#9CA3AF]'}`} />
        <span>Demo Simulation</span>
        <span className="text-xs bg-[#F1F5F9] text-[#475569] px-2 py-0.5 rounded-md font-mono">{activeScenario}</span>
        <span className="text-[#9CA3AF]">▾</span>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {demoControlsOpen && (
          <motion.div
            id="demo-control-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 right-6 z-50 w-84 max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.18)] border border-[#E5E7EB] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#0F172A] text-white">
              <div>
                <h3 className="text-sm font-semibold tracking-wide">Live Demo Engine</h3>
                <p className="text-[10px] text-slate-400">Trigger IoT events & test twin reactions</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={isRunning ? stopDemo : startDemo}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    isRunning
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {isRunning ? '⏸ Pause' : '▶ Resume'}
                </button>
              </div>
            </div>

            {/* Scenarios Grid */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Select Scenario</p>
                <span className="text-[10px] text-[#64748B]">Click to trigger instantly</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[260px] overflow-y-auto pr-0.5">
                {SCENARIOS.map((scenario) => {
                  const isActive = activeScenario === scenario.id;
                  return (
                    <button
                      key={scenario.id}
                      id={`scenario-${scenario.id}`}
                      onClick={() => handleSelectScenario(scenario.id as ScenarioId)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all duration-150 relative ${
                        isActive
                          ? `${SEVERITY_COLORS[scenario.severity]} ring-2 ring-blue-500/30 shadow-sm`
                          : 'border-[#F1F5F9] bg-[#FAFAFA] hover:bg-white hover:border-[#CBD5E1] text-[#475569]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 w-full">
                        <span className="text-base">{scenario.icon}</span>
                        <span className="text-xs font-semibold leading-tight truncate">{scenario.label}</span>
                      </div>
                      <p className="text-[9px] text-[#94A3B8] mt-1 line-clamp-1 leading-snug">{scenario.description}</p>
                      {isActive && (
                        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Speed control */}
            <div className="px-4 py-2.5 border-t border-[#F1F5F9] bg-[#F8FAFC]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">Tick Multiplier</span>
                <span className="text-xs font-mono font-bold text-[#1E293B]">{speedMultiplier}× Speed</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={speedMultiplier}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[9px] font-mono text-[#94A3B8] mt-1">
                <span>0.5×</span><span>1.0×</span><span>2.0×</span><span>4.0×</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-3 border-t border-[#F1F5F9] bg-white flex gap-2">
              <button
                id="demo-reset-btn"
                onClick={handleReset}
                className="flex-1 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-emerald-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <span>↺</span>
                <span>Reset to Normal</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
