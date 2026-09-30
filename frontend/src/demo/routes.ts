import type { GPSCoordinate, RouteWaypoint, ShipmentOrder } from '../types';

// ============================================================
// Primary Route: Delhi → Jaipur (Short, Clean Highway Corridor ~268 km)
// ============================================================
export const ROUTE_WAYPOINTS: RouteWaypoint[] = [
  {
    name: 'New Delhi Cold Hub (Origin)',
    coordinate: { lat: 28.6139, lng: 77.2090, timestamp: 0 },
    type: 'origin',
    actualArrival: Date.now() - 3.5 * 3600_000,
  },
  {
    name: 'Gurgaon CyberHub Checkpoint',
    coordinate: { lat: 28.4595, lng: 77.0266, timestamp: 0 },
    type: 'checkpoint',
    actualArrival: Date.now() - 2.8 * 3600_000,
  },
  {
    name: 'Manesar Toll Plaza',
    coordinate: { lat: 28.3512, lng: 76.9388, timestamp: 0 },
    type: 'checkpoint',
    actualArrival: Date.now() - 2.1 * 3600_000,
  },
  {
    name: 'Dharuhera Transit Station',
    coordinate: { lat: 28.2054, lng: 76.7942, timestamp: 0 },
    type: 'waypoint',
    actualArrival: Date.now() - 1.4 * 3600_000,
  },
  {
    name: 'Neemrana Japanese Zone (Current)',
    coordinate: { lat: 27.9942, lng: 76.3885, timestamp: 0 },
    type: 'waypoint',
    actualArrival: Date.now() - 0.2 * 3600_000,
  },
  {
    name: 'Kotputli Expressway Toll',
    coordinate: { lat: 27.7032, lng: 76.1984, timestamp: 0 },
    type: 'checkpoint',
    estimatedArrival: Date.now() + 0.8 * 3600_000,
  },
  {
    name: 'Shahpura Rest Depot',
    coordinate: { lat: 27.3912, lng: 75.9610, timestamp: 0 },
    type: 'waypoint',
    estimatedArrival: Date.now() + 1.6 * 3600_000,
  },
  {
    name: 'Jaipur Bio-Pharma Depot (Destination)',
    coordinate: { lat: 26.9124, lng: 75.7873, timestamp: 0 },
    type: 'destination',
    estimatedArrival: Date.now() + 2.8 * 3600_000,
  },
];

// High-resolution polyline for Delhi -> Jaipur route
export const ROUTE_POLYLINE: GPSCoordinate[] = [
  { lat: 28.6139, lng: 77.2090, timestamp: 0 },
  { lat: 28.5355, lng: 77.1350, timestamp: 1 },
  { lat: 28.4595, lng: 77.0266, timestamp: 2 },
  { lat: 28.3810, lng: 76.9720, timestamp: 3 },
  { lat: 28.3512, lng: 76.9388, timestamp: 4 },
  { lat: 28.2840, lng: 76.8620, timestamp: 5 },
  { lat: 28.2054, lng: 76.7942, timestamp: 6 },
  { lat: 28.0950, lng: 76.5420, timestamp: 7 },
  { lat: 27.9942, lng: 76.3885, timestamp: 8 }, // Current Location (Neemrana)
  { lat: 27.8500, lng: 76.2800, timestamp: 9 },
  { lat: 27.7032, lng: 76.1984, timestamp: 10 },
  { lat: 27.5400, lng: 76.0800, timestamp: 11 },
  { lat: 27.3912, lng: 75.9610, timestamp: 12 },
  { lat: 27.1500, lng: 75.8700, timestamp: 13 },
  { lat: 26.9124, lng: 75.7873, timestamp: 14 },
];

// Current live position (Neemrana corridor ~54% through journey)
export const CURRENT_GPS: GPSCoordinate = {
  lat: 27.9942,
  lng: 76.3885,
  altitude: 278,
  accuracy: 4,
  timestamp: Date.now(),
};

export const JOURNEY_PROGRESS = 54;
export const TOTAL_DISTANCE_KM = 268;
export const DISTANCE_TRAVELED_KM = 145;

// ============================================================
// Admin Fleet Inspection Orders
// ============================================================
export const FLEET_ORDERS: ShipmentOrder[] = [
  {
    id: 'SCM-2024-DL-JP-7821',
    trackingNumber: 'TRK-99201-IND',
    cargoName: 'mRNA Cold-Chain Vaccines (Batch #849)',
    cargoType: 'Cold Chain Pharmaceutical',
    cargoDescription: '2-8°C Temperature-sensitive vaccine vials with dry ice backup reefer pack.',
    transportMode: 'truck',
    origin: 'New Delhi',
    destination: 'Jaipur',
    totalDistanceKm: 268,
    distanceTraveledKm: 145,
    progressPercent: 54,
    eta: 'Today, 04:30 PM',
    departureTime: Date.now() - 3.5 * 3600_000,
    status: 'in_transit',
    healthScore: 94,
    healthSeverity: 'safe',
    temperature: 4.2,
    batteryPct: 88,
    speedKmH: 72,
    currentLocationName: 'Neemrana NH48, Rajasthan',
    carrier: 'DHL ColdChain Logistics',
    waypoints: ROUTE_WAYPOINTS,
    routePolyline: ROUTE_POLYLINE,
  },
  {
    id: 'SCM-2024-MB-PN-4412',
    trackingNumber: 'TRK-88310-IND',
    cargoName: 'Precision Semiconductor Lithography Wafers',
    cargoType: 'High-Tech Sensitive Electronics',
    cargoDescription: 'Ultra-low vibration semiconductor canisters requiring &lt;1.0g peak shock.',
    transportMode: 'truck',
    origin: 'Mumbai JNPT Port',
    destination: 'Pune Tech Park',
    totalDistanceKm: 152,
    distanceTraveledKm: 88,
    progressPercent: 58,
    eta: 'Today, 02:45 PM',
    departureTime: Date.now() - 2.2 * 3600_000,
    status: 'under_inspection',
    healthScore: 76,
    healthSeverity: 'warning',
    temperature: 21.4,
    batteryPct: 92,
    speedKmH: 58,
    currentLocationName: 'Lonavala Expressway Ghats',
    carrier: 'BlueDart High-Value Air/Road',
    waypoints: [
      { name: 'JNPT Mumbai (Origin)', coordinate: { lat: 18.9496, lng: 72.9515, timestamp: 0 }, type: 'origin', actualArrival: Date.now() - 2.2 * 3600_000 },
      { name: 'Navi Mumbai Hub', coordinate: { lat: 19.0330, lng: 73.0297, timestamp: 0 }, type: 'checkpoint', actualArrival: Date.now() - 1.6 * 3600_000 },
      { name: 'Khopoli Foothills', coordinate: { lat: 18.7857, lng: 73.3458, timestamp: 0 }, type: 'checkpoint', actualArrival: Date.now() - 0.8 * 3600_000 },
      { name: 'Lonavala Ghat (Current)', coordinate: { lat: 18.7557, lng: 73.4091, timestamp: 0 }, type: 'waypoint', actualArrival: Date.now() - 0.1 * 3600_000 },
      { name: 'Talegaon Toll', coordinate: { lat: 18.7300, lng: 73.6700, timestamp: 0 }, type: 'checkpoint', estimatedArrival: Date.now() + 0.6 * 3600_000 },
      { name: 'Pune Tech Park (Dest)', coordinate: { lat: 18.5204, lng: 73.8567, timestamp: 0 }, type: 'destination', estimatedArrival: Date.now() + 1.2 * 3600_000 },
    ],
    routePolyline: [
      { lat: 18.9496, lng: 72.9515, timestamp: 0 },
      { lat: 19.0330, lng: 73.0297, timestamp: 1 },
      { lat: 18.7857, lng: 73.3458, timestamp: 2 },
      { lat: 18.7557, lng: 73.4091, timestamp: 3 },
      { lat: 18.7300, lng: 73.6700, timestamp: 4 },
      { lat: 18.5204, lng: 73.8567, timestamp: 5 },
    ],
  },
  {
    id: 'SCM-2024-BL-CH-9105',
    trackingNumber: 'TRK-77405-IND',
    cargoName: 'Cryogenic Blood Plasma & Organ Transplants',
    cargoType: 'Critical Clinical Biologics',
    cargoDescription: 'Sterile cryogenic nitrogen vacuum container with real-time door seal monitoring.',
    transportMode: 'truck',
    origin: 'Bengaluru AIIMS',
    destination: 'Chennai Apollo',
    totalDistanceKm: 345,
    distanceTraveledKm: 190,
    progressPercent: 55,
    eta: 'Delayed (+1h 15m)',
    departureTime: Date.now() - 5.0 * 3600_000,
    status: 'exception',
    healthScore: 68,
    healthSeverity: 'critical',
    temperature: -18.2,
    batteryPct: 64,
    speedKmH: 0, // Stoppage alert!
    currentLocationName: 'Vellore Bypass (Stationary 1h 14m)',
    carrier: 'Apollo MediTransport Express',
    waypoints: [
      { name: 'Bengaluru AIIMS (Origin)', coordinate: { lat: 12.9716, lng: 77.5946, timestamp: 0 }, type: 'origin', actualArrival: Date.now() - 5.0 * 3600_000 },
      { name: 'Hosur Border Toll', coordinate: { lat: 12.7409, lng: 77.8253, timestamp: 0 }, type: 'checkpoint', actualArrival: Date.now() - 4.1 * 3600_000 },
      { name: 'Krishnagiri Junction', coordinate: { lat: 12.5186, lng: 78.2138, timestamp: 0 }, type: 'waypoint', actualArrival: Date.now() - 2.8 * 3600_000 },
      { name: 'Vellore Stoppage Site (Current)', coordinate: { lat: 12.9165, lng: 79.1325, timestamp: 0 }, type: 'checkpoint', actualArrival: Date.now() - 1.2 * 3600_000 },
      { name: 'Sriperumbudur Depot', coordinate: { lat: 12.9698, lng: 79.9405, timestamp: 0 }, type: 'waypoint', estimatedArrival: Date.now() + 1.5 * 3600_000 },
      { name: 'Chennai Apollo (Dest)', coordinate: { lat: 13.0827, lng: 80.2707, timestamp: 0 }, type: 'destination', estimatedArrival: Date.now() + 2.5 * 3600_000 },
    ],
    routePolyline: [
      { lat: 12.9716, lng: 77.5946, timestamp: 0 },
      { lat: 12.7409, lng: 77.8253, timestamp: 1 },
      { lat: 12.5186, lng: 78.2138, timestamp: 2 },
      { lat: 12.9165, lng: 79.1325, timestamp: 3 },
      { lat: 12.9698, lng: 79.9405, timestamp: 4 },
      { lat: 13.0827, lng: 80.2707, timestamp: 5 },
    ],
  },
];
