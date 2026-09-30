// ============================================================
// Smart Cargo Monitor — Core Type Definitions
// ============================================================

export type SeverityLevel = 'safe' | 'warning' | 'critical' | 'info' | 'offline';
export type TransportMode = 'truck' | 'rail' | 'air' | 'sea';
export type EventType =
  | 'temperature_excursion'
  | 'humidity_excursion'
  | 'shock_event'
  | 'door_open'
  | 'door_close'
  | 'tilt_event'
  | 'tamper_alert'
  | 'battery_low'
  | 'gps_loss'
  | 'route_deviation'
  | 'checkpoint'
  | 'handover'
  | 'stoppage_alert'
  | 'custom';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

// ---- Sensor Reading ----
export interface SensorReading<T = number> {
  value: T;
  unit: string;
  timestamp: number; // Unix ms
  status: SeverityLevel;
  min?: T;
  max?: T;
  avg?: T;
}

// ---- GPS ----
export interface GPSCoordinate {
  lat: number;
  lng: number;
  altitude?: number;   // meters
  accuracy?: number;   // meters
  timestamp: number;
}

// ---- Orientation ----
export interface Orientation {
  roll: number;   // degrees
  pitch: number;  // degrees
  yaw: number;    // degrees
}

// ---- Connectivity ----
export type ConnectivityType = '4G' | '3G' | '2G' | 'WiFi' | 'Satellite' | 'None';
export interface ConnectivityState {
  type: ConnectivityType;
  signalStrength: number; // 0–100
  lastSeen: number;
  isOnline: boolean;
}

// ---- Battery ----
export interface BatteryState {
  voltage: number;        // Volts
  percentage: number;     // 0–100
  current: number;        // mA (+ charging, - discharging)
  estimatedRuntime: number; // hours
  isCharging: boolean;
  temperature: number;    // °C
}

// ---- Shock / Vibration ----
export interface ShockData {
  x: number; // g-force
  y: number;
  z: number;
  peak: number;
  timestamp: number;
}

// ---- Stoppage Detection ----
export interface StoppageState {
  isStationary: boolean;
  stationaryDurationMinutes: number;
  thresholdMinutes: number; // default 60 min (1 hr)
  locationName: string;
  hasAlert: boolean;
}

// ---- Telemetry State (live snapshot) ----
export interface TelemetryState {
  // Environmental
  temperature: SensorReading;
  humidity: SensorReading;
  pressure: SensorReading;

  // Gas
  gasCO2?: SensorReading;
  gasVOC?: SensorReading;

  // Motion
  shock: SensorReading & { vector: ShockData };
  orientation: Orientation;
  vibration: SensorReading;

  // Security
  doorOpen: boolean;
  doorOpenSince?: number; // timestamp
  lightLevel: SensorReading;
  tamperDetected: boolean;

  // Positioning & Movement
  gps: GPSCoordinate;
  speed: SensorReading; // km/h
  stoppage: StoppageState;

  // Power
  battery: BatteryState;

  // Connectivity
  connectivity: ConnectivityState;

  // Meta
  deviceId: string;
  firmwareVersion: string;
  lastUpdate: number;
}

// ---- Risk Engine ----
export interface RiskFactor {
  id: string;
  label: string;
  contribution: number; // 0–100 percentage points of damage probability
  severity: SeverityLevel;
  description: string;
  value?: string;
}

export interface DamageProbabilityModel {
  totalProbability: number; // 0–100
  severity: SeverityLevel;
  factors: RiskFactor[];
  confidence: number; // 0–100
  updatedAt: number;
}

export interface RiskState {
  healthScore: number;           // 0–100 (inverse of damage)
  healthSeverity: SeverityLevel;
  damageProbability: DamageProbabilityModel;
  integrityChainValid: boolean;
  integrityHash: string;
}

// ---- Events ----
export interface EventRecord {
  id: string;
  type: EventType;
  severity: SeverityLevel;
  timestamp: number;
  location?: GPSCoordinate;
  title: string;
  description: string;
  measured: boolean;    // true = sensor, false = inferred
  confidence?: number;  // 0–100 if inferred
  data?: Record<string, unknown>;
  acknowledged: boolean;
}

// ---- Alerts ----
export interface AlertRecord {
  id: string;
  eventId?: string;
  type: EventType;
  severity: SeverityLevel;
  title: string;
  message: string;
  timestamp: number;
  status: AlertStatus;
  location?: GPSCoordinate;
  acknowledged: boolean;
  acknowledgedAt?: number;
  resolvedAt?: number;
}

// ---- Shipment ----
export interface RouteWaypoint {
  name: string;
  coordinate: GPSCoordinate;
  estimatedArrival?: number;
  actualArrival?: number;
  type: 'origin' | 'waypoint' | 'checkpoint' | 'destination';
}

export interface ShipmentOrder {
  id: string;
  trackingNumber: string;
  cargoName: string;
  cargoType: string;
  cargoDescription: string;
  transportMode: TransportMode;
  origin: string;
  destination: string;
  totalDistanceKm: number;
  distanceTraveledKm: number;
  progressPercent: number;
  eta: string;
  departureTime: number;
  status: 'in_transit' | 'delayed' | 'delivered' | 'exception' | 'under_inspection';
  healthScore: number;
  healthSeverity: SeverityLevel;
  temperature: number;
  batteryPct: number;
  speedKmH: number;
  currentLocationName: string;
  carrier: string;
  waypoints: RouteWaypoint[];
  routePolyline: GPSCoordinate[];
}

export interface ShipmentState {
  id: string;
  trackingNumber: string;
  cargoType: string;
  cargoDescription: string;
  transportMode: TransportMode;

  origin: RouteWaypoint;
  destination: RouteWaypoint;
  waypoints: RouteWaypoint[];
  routePolyline: GPSCoordinate[];

  departureTime: number;
  estimatedArrival: number;
  journeyProgress: number; // 0–100 %
  distanceTraveled: number; // km
  totalDistance: number;    // km

  status: 'pending' | 'in_transit' | 'delayed' | 'delivered' | 'exception';
  carrier: string;
  custodian: string;
}

// ---- Historical data point (for charts) ----
export interface HistoricalDataPoint {
  timestamp: number;
  temperature?: number;
  humidity?: number;
  pressure?: number;
  shockPeak?: number;
  batteryPct?: number;
  speed?: number;
  lat?: number;
  lng?: number;
}

// ---- Simulation ----
export type ScenarioId =
  | 'normal'
  | 'temperatureExcursion'
  | 'doorOpen'
  | 'shockEvent'
  | 'tiltEvent'
  | 'batteryDepletion'
  | 'roughHandling'
  | 'tamperAlert'
  | 'stoppageAlert';

export interface SimulationScenario {
  id: ScenarioId;
  label: string;
  description: string;
  icon: string;
  severity: SeverityLevel;
  duration: number; // ms
}
