/**
 * Smart Cargo Monitor - REST API & SSE Client
 * Connects the React Frontend to the Node.js Cloud Ingestion & Telemetry Service.
 */

import type { TelemetryState, AlertRecord, EventRecord } from '../types';

const API_BASE = (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'http://localhost:5000/api';

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: number;
  database: {
    connected: boolean;
    url: string;
  };
  mqtt: {
    connected: boolean;
    broker: string;
    topics: string[];
  };
  devicesCount: number;
  activeAlertsCount: number;
}

export interface DeviceSummary {
  deviceId: string;
  deviceName: string;
  cargoType: string;
  origin: string;
  destination: string;
  status: string;
  lastSeen: number;
  batteryPct: number;
  speedKmH: number;
  temperature: number;
  healthScore: number;
  healthSeverity: 'safe' | 'warning' | 'critical';
  currentLocationName: string;
}

export interface TelemetryHistoryPoint {
  timestamp: number;
  temperature: number;
  humidity: number;
  pressure: number;
  shock: number;
  battery: number;
  speed: number;
  lat: number;
  lng: number;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  // --- Health Check ---
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  }

  // --- Devices List ---
  async getDevices(): Promise<DeviceSummary[]> {
    const res = await fetch(`${this.baseUrl}/devices`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Fetch devices failed: ${res.statusText}`);
    const data = await res.json();
    return data.devices || [];
  }

  // --- Latest Telemetry for a Device ---
  async getLatestTelemetry(deviceId: string): Promise<TelemetryState> {
    const res = await fetch(`${this.baseUrl}/devices/${encodeURIComponent(deviceId)}/telemetry/latest`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error(`Fetch telemetry failed: ${res.statusText}`);
    const data = await res.json();
    return data.telemetry;
  }

  // --- Historical Telemetry for Charts ---
  async getTelemetryHistory(deviceId: string, range: string = '1h'): Promise<TelemetryHistoryPoint[]> {
    const res = await fetch(
      `${this.baseUrl}/devices/${encodeURIComponent(deviceId)}/telemetry/history?range=${range}&limit=300`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error(`Fetch history failed: ${res.statusText}`);
    const data = await res.json();
    return data.history || [];
  }

  // --- Alerts ---
  async getAlerts(params?: { deviceId?: string; status?: string; severity?: string }): Promise<AlertRecord[]> {
    const query = new URLSearchParams();
    if (params?.deviceId) query.append('deviceId', params.deviceId);
    if (params?.status) query.append('status', params.status);
    if (params?.severity) query.append('severity', params.severity);

    const res = await fetch(`${this.baseUrl}/alerts?${query.toString()}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Fetch alerts failed: ${res.statusText}`);
    const data = await res.json();
    return data.alerts || [];
  }

  // --- Acknowledge Alert ---
  async acknowledgeAlert(alertId: string): Promise<void> {
    await fetch(`${this.baseUrl}/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Acknowledge All Alerts ---
  async acknowledgeAllAlerts(): Promise<void> {
    await fetch(`${this.baseUrl}/alerts/acknowledge-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Resolve Alert ---
  async resolveAlert(alertId: string): Promise<void> {
    await fetch(`${this.baseUrl}/alerts/${encodeURIComponent(alertId)}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Events Audit Trail ---
  async getEvents(): Promise<EventRecord[]> {
    const res = await fetch(`${this.baseUrl}/events`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Fetch events failed: ${res.statusText}`);
    const data = await res.json();
    return data.events || [];
  }

  // --- Push Telemetry (REST Fallback / Simulator) ---
  async postTelemetry(payload: Record<string, unknown>): Promise<void> {
    const res = await fetch(`${this.baseUrl}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Post telemetry failed: ${res.statusText}`);
  }

  // --- Server-Sent Events (SSE) Live Stream Subscription ---
  subscribeStream(
    onMessage: (event: { type: string; deviceId?: string; telemetry?: TelemetryState; alert?: AlertRecord }) => void,
    onError?: (err: Event) => void
  ): () => void {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${this.baseUrl}/stream`);
      eventSource.onmessage = (e) => {
        try {
          const parsed = JSON.parse(e.data);
          onMessage(parsed);
        } catch {
          // ignore heartbeat / unparseable
        }
      };
      if (onError) {
        eventSource.onerror = (err) => {
          onError(err);
        };
      }
    } catch (e) {
      console.warn('SSE subscription failed:', e);
    }

    // Return cleanup unsubscribe function
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }
}

export const api = new ApiService();
