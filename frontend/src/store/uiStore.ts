import { create } from 'zustand';

type ActiveSensor = 'temperature' | 'humidity' | 'shock' | 'pressure' | 'battery' | 'door' | 'gas' | null;
type ViewMode = 'exterior' | 'interior' | 'sensors';
type ActivePage = 'overview' | 'analytics' | 'events' | 'alerts' | 'reports';

interface UIStore {
  activePage: ActivePage;
  activeSensor: ActiveSensor;
  twinViewMode: ViewMode;
  mapExpanded: boolean;
  notificationsOpen: boolean;
  demoControlsOpen: boolean;
  sidebarOpen: boolean;

  setActivePage: (page: ActivePage) => void;
  setActiveSensor: (sensor: ActiveSensor) => void;
  setTwinViewMode: (mode: ViewMode) => void;
  toggleMap: () => void;
  toggleNotifications: () => void;
  toggleDemoControls: () => void;
  toggleSidebar: () => void;
  closePanels: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activePage: 'overview',
  activeSensor: null,
  twinViewMode: 'exterior',
  mapExpanded: false,
  notificationsOpen: false,
  demoControlsOpen: false,
  sidebarOpen: false,

  setActivePage: (page) => set({ activePage: page }),
  setActiveSensor: (sensor) => set((s) => ({ activeSensor: s.activeSensor === sensor ? null : sensor })),
  setTwinViewMode: (mode) => set({ twinViewMode: mode }),
  toggleMap: () => set((s) => ({ mapExpanded: !s.mapExpanded })),
  toggleNotifications: () => set((s) => ({ notificationsOpen: !s.notificationsOpen, demoControlsOpen: false })),
  toggleDemoControls: () => set((s) => ({ demoControlsOpen: !s.demoControlsOpen, notificationsOpen: false })),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closePanels: () => set({ notificationsOpen: false, demoControlsOpen: false }),
}));
