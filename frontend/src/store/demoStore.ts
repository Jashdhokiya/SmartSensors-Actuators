import { create } from 'zustand';
import type { ScenarioId, SimulationScenario } from '../types';

export const SCENARIOS: SimulationScenario[] = [
  { id: 'normal',              label: 'Normal Transit',          description: 'All sensors within safe thresholds',             icon: '✅', severity: 'safe',     duration: 0 },
  { id: 'stoppageAlert',       label: 'Stoppage Alert (>1hr)',   description: 'Vehicle halted outside depot for 1h 14m',         icon: '🛑', severity: 'warning',  duration: 40_000 },
  { id: 'temperatureExcursion',label: 'Temperature Excursion',   description: 'Temperature exceeds cold chain threshold',       icon: '🌡️', severity: 'warning',  duration: 30_000 },
  { id: 'doorOpen',            label: 'Door Open Breach',        description: 'Rear container lock opened in-transit',          icon: '🚪', severity: 'critical', duration: 20_000 },
  { id: 'shockEvent',          label: '4.8g Severe Impact',      description: 'High-G physical shock & load shift',             icon: '💥', severity: 'critical', duration: 10_000 },
  { id: 'tiltEvent',           label: '28° Tilt / Roll Angle',   description: 'Container tilted beyond lateral limit',          icon: '📐', severity: 'warning',  duration: 15_000 },
  { id: 'batteryDepletion',    label: 'Critical Battery (14%)',  description: 'Gateway battery dropping critically low',        icon: '🔋', severity: 'warning',  duration: 60_000 },
  { id: 'roughHandling',       label: 'Rough Road Vibration',    description: 'Continuous road vibration 0.65 g-rms',          icon: '⚡', severity: 'warning',  duration: 20_000 },
  { id: 'tamperAlert',         label: 'Enclosure Tamper Switch', description: 'IoT hardware cover breach detected',             icon: '🔒', severity: 'critical', duration: 15_000 },
];

interface DemoStore {
  isRunning: boolean;
  activeScenario: ScenarioId;
  speedMultiplier: number;
  tickRate: number; // ms

  startDemo: () => void;
  stopDemo: () => void;
  setScenario: (id: ScenarioId) => void;
  setSpeed: (mult: number) => void;
  resetToNormal: () => void;
}

export const useDemoStore = create<DemoStore>((set) => ({
  isRunning: true,
  activeScenario: 'normal',
  speedMultiplier: 1,
  tickRate: 800,

  startDemo: () => set({ isRunning: true }),
  stopDemo: () => set({ isRunning: false }),
  setScenario: (id) => set({ activeScenario: id }),
  setSpeed: (mult) => set({ speedMultiplier: mult, tickRate: Math.round(800 / mult) }),
  resetToNormal: () => set({ activeScenario: 'normal', isRunning: true }),
}));
