import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { TelemetryState, GPSCoordinate, Orientation, BatteryState, ShockData, ShipmentOrder } from '../types';
import { CURRENT_GPS, FLEET_ORDERS } from '../demo/routes';

export const defaultTelemetry: TelemetryState = {
  temperature: { value: 4.2, unit: '°C', timestamp: Date.now(), status: 'safe', min: 2.0, max: 8.0, avg: 4.5 },
  humidity:    { value: 62,  unit: '%',  timestamp: Date.now(), status: 'safe', min: 55,  max: 70,  avg: 62 },
  pressure:    { value: 1013.2, unit: 'hPa', timestamp: Date.now(), status: 'safe', min: 980, max: 1040, avg: 1010 },
  shock: {
    value: 0.08, unit: 'g', timestamp: Date.now(), status: 'safe',
    vector: { x: 0.02, y: 0.04, z: 0.08, peak: 0.08, timestamp: Date.now() },
  },
  orientation: { roll: 0.0, pitch: 0.0, yaw: 237.0 },
  vibration:   { value: 0.03, unit: 'g-rms', timestamp: Date.now(), status: 'safe' },
  doorOpen:    false,
  lightLevel:  { value: 2,   unit: 'lux', timestamp: Date.now(), status: 'safe' },
  tamperDetected: false,
  gps:     CURRENT_GPS,
  speed:   { value: 72, unit: 'km/h', timestamp: Date.now(), status: 'safe' },
  stoppage: {
    isStationary: false,
    stationaryDurationMinutes: 0,
    thresholdMinutes: 60,
    locationName: 'Neemrana NH48 Express Corridor',
    hasAlert: false,
  },
  battery: {
    voltage: 3.92, percentage: 88, current: -45,
    estimatedRuntime: 96, isCharging: false, temperature: 28,
  },
  connectivity: {
    type: '4G', signalStrength: 82, lastSeen: Date.now(), isOnline: true,
  },
  deviceId: 'SCM-DL-7821',
  firmwareVersion: '2.4.1',
  lastUpdate: Date.now(),
};

export interface BackendInfo {
  connected: boolean;
  mqttConnected: boolean;
  broker: string;
  dbConnected: boolean;
  activeAlertsCount: number;
  devicesCount: number;
}

interface TelemetryStore {
  activeOrder: ShipmentOrder;
  current: TelemetryState;
  history: Array<{ timestamp: number; temperature: number; humidity: number; pressure: number; shock: number; battery: number; speed: number; lat: number; lng: number }>;
  isBackendLive: boolean;
  backendInfo: BackendInfo | null;
  setBackendInfo: (info: BackendInfo | null) => void;
  setActiveOrder: (order: ShipmentOrder) => void;
  applyLiveTelemetry: (incoming: Partial<TelemetryState>) => void;
  applyLiveHistory: (history: Array<{ timestamp: number; temperature: number; humidity: number; pressure: number; shock: number; battery: number; speed: number; lat: number; lng: number }>) => void;
  updateTelemetry: (partial: Partial<TelemetryState>) => void;
  updateTemperature: (value: number) => void;
  updateHumidity: (value: number) => void;
  updateShock: (data: ShockData) => void;
  updateGPS: (coord: GPSCoordinate) => void;
  updateBattery: (battery: Partial<BatteryState>) => void;
  updateOrientation: (orientation: Orientation) => void;
  setDoorOpen: (open: boolean) => void;
  setTamper: (detected: boolean) => void;
  setStoppage: (stoppage: Partial<TelemetryState['stoppage']>) => void;
  resetToDefault: () => void;
  pushHistory: () => void;
}

export const useTelemetryStore = create<TelemetryStore>()(
  subscribeWithSelector((set, get) => ({
    activeOrder: FLEET_ORDERS[0],
    current: { ...defaultTelemetry },
    history: [],
    isBackendLive: false,
    backendInfo: null,

    setBackendInfo: (info) => set({
      backendInfo: info,
      isBackendLive: Boolean(info?.connected),
    }),

    applyLiveTelemetry: (incoming) => set((s) => ({
      current: {
        ...s.current,
        ...incoming,
        temperature: incoming.temperature ? { ...s.current.temperature, ...incoming.temperature } : s.current.temperature,
        humidity: incoming.humidity ? { ...s.current.humidity, ...incoming.humidity } : s.current.humidity,
        shock: incoming.shock ? { ...s.current.shock, ...incoming.shock } : s.current.shock,
        battery: incoming.battery ? { ...s.current.battery, ...incoming.battery } : s.current.battery,
        gps: incoming.gps ? { ...s.current.gps, ...incoming.gps } : s.current.gps,
        speed: incoming.speed ? { ...s.current.speed, ...incoming.speed } : s.current.speed,
        orientation: incoming.orientation ? { ...s.current.orientation, ...incoming.orientation } : s.current.orientation,
        lastUpdate: Date.now(),
      },
    })),

    applyLiveHistory: (history) => set({
      history,
    }),

    setActiveOrder: (order) => {
      const isDL = order.id.includes('DL-JP');
      const isMB = order.id.includes('MB-PN');
      const isBL = order.id.includes('BL-CH');

      const tempVal = isBL ? -18.2 : isMB ? 21.4 : 4.2;
      const tempMin = isBL ? -22 : isMB ? 18 : 2;
      const tempMax = isBL ? -15 : isMB ? 25 : 8;

      set((s) => ({
        activeOrder: order,
        current: {
          ...s.current,
          deviceId: order.id,
          gps: order.routePolyline[Math.floor(order.routePolyline.length * (order.progressPercent / 100))] || s.current.gps,
          speed: { ...s.current.speed, value: order.speedKmH, status: order.speedKmH === 0 ? 'warning' : 'safe' },
          temperature: {
            ...s.current.temperature,
            value: tempVal,
            min: tempMin,
            max: tempMax,
            avg: tempVal,
            status: order.healthSeverity === 'critical' ? 'critical' : order.healthSeverity === 'warning' ? 'warning' : 'safe',
          },
          battery: { ...s.current.battery, percentage: order.batteryPct },
          stoppage: {
            isStationary: order.speedKmH === 0,
            stationaryDurationMinutes: order.speedKmH === 0 ? 74 : 0,
            thresholdMinutes: 60,
            locationName: order.currentLocationName,
            hasAlert: order.speedKmH === 0,
          },
          lastUpdate: Date.now(),
        },
      }));
    },

    updateTelemetry: (partial) => set((s) => ({
      current: { ...s.current, ...partial, lastUpdate: Date.now() },
    })),

    updateTemperature: (value) => set((s) => {
      const status = value < 2 || value > 8 ? (value < -2 || value > 12 ? 'critical' : 'warning') : 'safe';
      return {
        current: {
          ...s.current,
          temperature: { ...s.current.temperature, value, status, timestamp: Date.now() },
          lastUpdate: Date.now(),
        },
      };
    }),

    updateHumidity: (value) => set((s) => {
      const status = value < 45 || value > 80 ? (value < 30 || value > 90 ? 'critical' : 'warning') : 'safe';
      return {
        current: {
          ...s.current,
          humidity: { ...s.current.humidity, value, status, timestamp: Date.now() },
          lastUpdate: Date.now(),
        },
      };
    }),

    updateShock: (data) => set((s) => {
      const status = data.peak > 3.0 ? 'critical' : data.peak > 1.5 ? 'warning' : 'safe';
      return {
        current: {
          ...s.current,
          shock: { ...s.current.shock, value: data.peak, vector: data, status, timestamp: Date.now() },
          lastUpdate: Date.now(),
        },
      };
    }),

    updateGPS: (coord) => set((s) => ({
      current: { ...s.current, gps: coord, lastUpdate: Date.now() },
    })),

    updateBattery: (battery) => set((s) => ({
      current: {
        ...s.current,
        battery: { ...s.current.battery, ...battery },
        lastUpdate: Date.now(),
      },
    })),

    updateOrientation: (orientation) => set((s) => ({
      current: { ...s.current, orientation, lastUpdate: Date.now() },
    })),

    setDoorOpen: (open) => set((s) => ({
      current: {
        ...s.current,
        doorOpen: open,
        doorOpenSince: open ? Date.now() : undefined,
        lastUpdate: Date.now(),
      },
    })),

    setTamper: (detected) => set((s) => ({
      current: { ...s.current, tamperDetected: detected, lastUpdate: Date.now() },
    })),

    setStoppage: (stoppage) => set((s) => ({
      current: {
        ...s.current,
        stoppage: { ...s.current.stoppage, ...stoppage },
        lastUpdate: Date.now(),
      },
    })),

    resetToDefault: () => set((s) => ({
      current: {
        ...defaultTelemetry,
        timestamp: Date.now(),
        lastUpdate: Date.now(),
        temperature: { ...defaultTelemetry.temperature, timestamp: Date.now() },
        humidity: { ...defaultTelemetry.humidity, timestamp: Date.now() },
        shock: { ...defaultTelemetry.shock, timestamp: Date.now() },
        doorOpen: false,
        tamperDetected: false,
        stoppage: {
          isStationary: false,
          stationaryDurationMinutes: 0,
          thresholdMinutes: 60,
          locationName: 'Neemrana NH48 Express Corridor',
          hasAlert: false,
        },
        speed: { value: 72, unit: 'km/h', timestamp: Date.now(), status: 'safe' },
        orientation: { roll: 0.0, pitch: 0.0, yaw: 237.0 },
      },
      history: s.history,
    })),

    pushHistory: () => {
      const { current } = get();
      const point = {
        timestamp: Date.now(),
        temperature: current.temperature.value,
        humidity: current.humidity.value,
        pressure: current.pressure.value,
        shock: current.shock.value,
        battery: current.battery.percentage,
        speed: current.speed.value,
        lat: current.gps.lat,
        lng: current.gps.lng,
      };
      set((s) => ({
        history: [...s.history.slice(-300), point],
      }));
    },
  }))
);
