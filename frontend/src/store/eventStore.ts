import { create } from 'zustand';
import type { EventRecord, AlertRecord, EventType, SeverityLevel } from '../types';
import { api } from '../services/api';

let eventCounter = 0;

function makeEvent(
  type: EventType,
  severity: SeverityLevel,
  title: string,
  description: string,
  data?: Record<string, unknown>,
): EventRecord {
  return {
    id: `evt-${Date.now()}-${++eventCounter}`,
    type,
    severity,
    timestamp: Date.now(),
    title,
    description,
    measured: true,
    confidence: 95,
    data,
    acknowledged: false,
  };
}

// Seed events
const SEED_EVENTS: EventRecord[] = [
  {
    id: 'evt-seed-1', type: 'checkpoint', severity: 'info',
    timestamp: Date.now() - 4 * 3600_000,
    title: 'Checkpoint: Agra Toll', description: 'Shipment passed Agra toll checkpoint successfully.',
    measured: true, acknowledged: true,
    location: { lat: 27.1767, lng: 78.0081, timestamp: Date.now() - 4 * 3600_000 },
  },
  {
    id: 'evt-seed-2', type: 'temperature_excursion', severity: 'warning',
    timestamp: Date.now() - 3 * 3600_000,
    title: 'Temperature Warning: +8.7°C', description: 'Temperature briefly exceeded safe range during loading dock wait.',
    measured: true, acknowledged: false, confidence: 98,
    location: { lat: 27.2, lng: 78.0, timestamp: Date.now() - 3 * 3600_000 },
    data: { peak: 8.7, duration: 420 },
  },
  {
    id: 'evt-seed-3', type: 'shock_event', severity: 'warning',
    timestamp: Date.now() - 2 * 3600_000,
    title: 'Shock: 2.3g Impact', description: 'Moderate shock detected, likely road bump.',
    measured: true, acknowledged: false, confidence: 99,
    location: { lat: 26.4499, lng: 77.9896, timestamp: Date.now() - 2 * 3600_000 },
    data: { x: 0.8, y: 1.2, z: 2.3, peak: 2.3 },
  },
  {
    id: 'evt-seed-4', type: 'checkpoint', severity: 'info',
    timestamp: Date.now() - 1 * 3600_000,
    title: 'Checkpoint: Gwalior Depot', description: 'Shipment arrived at Gwalior transit depot. Brief stop.',
    measured: true, acknowledged: true,
    location: { lat: 26.2124, lng: 78.1772, timestamp: Date.now() - 1 * 3600_000 },
  },
];

interface EventStore {
  events: EventRecord[];
  alerts: AlertRecord[];
  unreadCount: number;
  syncFromBackend: (alerts: AlertRecord[], events?: EventRecord[]) => void;
  addEvent: (type: EventType, severity: SeverityLevel, title: string, description: string, data?: Record<string, unknown>) => void;
  addAlert: (alert: Omit<AlertRecord, 'id'>) => void;
  acknowledgeEvent: (id: string) => void;
  acknowledgeAlert: (id: string) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
  resolveAlert: (id: string) => Promise<void>;
  clearUnread: () => void;
}

export const useEventStore = create<EventStore>((set) => ({
  events: SEED_EVENTS,
  alerts: [
    {
      id: 'alert-seed-1',
      type: 'temperature_excursion',
      severity: 'warning',
      title: 'Temperature Excursion Recorded',
      message: 'Temperature exceeded 8°C briefly 3h ago. Within acceptable limits now.',
      timestamp: Date.now() - 3 * 3600_000,
      status: 'active',
      acknowledged: false,
    },
    {
      id: 'alert-seed-2',
      type: 'shock_event',
      severity: 'warning',
      title: 'Moderate Shock Event',
      message: '2.3g impact recorded 2h ago near Gwalior. No structural damage inferred.',
      timestamp: Date.now() - 2 * 3600_000,
      status: 'active',
      acknowledged: false,
    },
  ],
  unreadCount: 2,

  syncFromBackend: (backendAlerts, backendEvents) => {
    set((s) => {
      // Merge unique alerts
      const existingIds = new Set(s.alerts.map((a) => a.id));
      const mergedAlerts = [...s.alerts];
      backendAlerts.forEach((ba) => {
        const idx = mergedAlerts.findIndex((a) => a.id === ba.id);
        if (idx >= 0) {
          mergedAlerts[idx] = { ...mergedAlerts[idx], ...ba };
        } else if (!existingIds.has(ba.id)) {
          mergedAlerts.unshift(ba);
        }
      });

      let mergedEvents = s.events;
      if (backendEvents && backendEvents.length > 0) {
        const evIds = new Set(s.events.map((e) => e.id));
        const newEvs = backendEvents.filter((e) => !evIds.has(e.id));
        mergedEvents = [...newEvs, ...s.events];
      }

      const activeUnread = mergedAlerts.filter((a) => a.status === 'active' && !a.acknowledged).length;

      return {
        alerts: mergedAlerts,
        events: mergedEvents,
        unreadCount: activeUnread,
      };
    });
  },

  addEvent: (type, severity, title, description, data) => {
    const event = makeEvent(type, severity, title, description, data);
    set((s) => ({
      events: [event, ...s.events],
      unreadCount: s.unreadCount + (severity !== 'info' ? 1 : 0),
    }));
  },

  addAlert: (alert) => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      alerts: [{ ...alert, id }, ...s.alerts],
      unreadCount: s.unreadCount + 1,
    }));
  },

  acknowledgeEvent: (id) => set((s) => ({
    events: s.events.map((e) => e.id === id ? { ...e, acknowledged: true } : e),
  })),

  acknowledgeAlert: async (id) => {
    // Optimistic local update
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, status: 'acknowledged' as const, acknowledgedAt: Date.now() } : a
      ),
    }));

    // REST API call
    try {
      await api.acknowledgeAlert(id);
    } catch (e) {
      console.warn('[API] Alert ack offline sync:', e);
    }
  },

  acknowledgeAll: async () => {
    set((s) => ({
      alerts: s.alerts.map((a) => ({ ...a, acknowledged: true, status: 'acknowledged' as const, acknowledgedAt: Date.now() })),
      unreadCount: 0,
    }));

    try {
      await api.acknowledgeAllAlerts();
    } catch (e) {
      console.warn('[API] Ack all offline sync:', e);
    }
  },

  resolveAlert: async (id) => {
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, status: 'resolved' as const, resolvedAt: Date.now() } : a
      ),
    }));

    try {
      await api.resolveAlert(id);
    } catch (e) {
      console.warn('[API] Alert resolve offline sync:', e);
    }
  },

  clearUnread: () => set({ unreadCount: 0 }),
}));
