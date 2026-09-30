/**
 * In-Memory Real-Time State Store & Cache
 * Ensures instantaneous frontend responses and zero-downtime during DB reconnects.
 */

const memoryStore = {
  devices: new Map([
    ['SCM-DL-7821', {
      deviceId: 'SCM-DL-7821',
      deviceName: 'Pharma ColdChain Unit A-1',
      cargoType: 'Biologics & Vaccines',
      origin: 'Delhi National Cold Storage Hub',
      destination: 'Jaipur Super-Specialty Medical Depot',
      status: 'in_transit',
      lastSeen: Date.now(),
      batteryPct: 88,
      speedKmH: 72,
      temperature: 4.2,
      healthScore: 98,
      healthSeverity: 'safe',
      currentLocationName: 'Neemrana NH48 Express Corridor'
    }],
    ['SCM-MB-9410', {
      deviceId: 'SCM-MB-9410',
      deviceName: 'Semiconductor Express Container 04',
      cargoType: 'Precision Wafer Consignment',
      origin: 'Mumbai Nhava Sheva Port Hub',
      destination: 'Pune Tech Park Electronics Assembly',
      status: 'in_transit',
      lastSeen: Date.now(),
      batteryPct: 74,
      speedKmH: 84,
      temperature: 21.4,
      healthScore: 94,
      healthSeverity: 'safe',
      currentLocationName: 'Khopoli Mumbai-Pune Expressway'
    }],
    ['SCM-BL-3302', {
      deviceId: 'SCM-BL-3302',
      deviceName: 'Cryo Organics Freezer Box',
      cargoType: 'Cryogenic Enzymes & Culture',
      origin: 'Bengaluru Biocon Logistics Terminal',
      destination: 'Chennai Port Cold Terminal',
      status: 'exception',
      lastSeen: Date.now(),
      batteryPct: 42,
      speedKmH: 0,
      temperature: -14.1,
      healthScore: 68,
      healthSeverity: 'critical',
      currentLocationName: 'Vellore NH48 Transit Staging Area'
    }],
    ['cargo_esp32_01', {
      deviceId: 'cargo_esp32_01',
      deviceName: 'ESP32 Live IoT Node',
      cargoType: 'Live Hardware Telemetry',
      origin: 'IoT Station Alpha',
      destination: 'Central Processing Cloud',
      status: 'in_transit',
      lastSeen: Date.now(),
      batteryPct: 92,
      speedKmH: 45,
      temperature: 5.1,
      healthScore: 96,
      healthSeverity: 'safe',
      currentLocationName: 'Live Hardware GPS Fix'
    }]
  ]),

  latestTelemetry: new Map(),
  telemetryHistory: new Map(), // deviceId -> Array of points
  alerts: [
    {
      id: 'alert-seed-1',
      deviceId: 'SCM-BL-3302',
      type: 'temperature_excursion',
      severity: 'critical',
      title: 'Cryo Temperature Breach (-14.1°C)',
      message: 'Temperature rose above -15.0°C cryo threshold during prolonged highway stop.',
      timestamp: Date.now() - 45 * 60 * 1000,
      status: 'active',
      acknowledged: false,
    },
    {
      id: 'alert-seed-2',
      deviceId: 'SCM-DL-7821',
      type: 'shock_event',
      severity: 'warning',
      title: 'Moderate Pothole Shock (2.1g)',
      message: 'Pothole impact detected near Neemrana corridor. Within packaging tolerance.',
      timestamp: Date.now() - 90 * 60 * 1000,
      status: 'active',
      acknowledged: false,
    }
  ],
  events: [
    {
      id: 'evt-init-1',
      deviceId: 'SCM-DL-7821',
      type: 'checkpoint',
      severity: 'info',
      timestamp: Date.now() - 3 * 3600_000,
      title: 'Dispatched from Delhi Hub',
      description: 'Carrier departed cold storage logistics depot with sealed container.',
      measured: true,
      confidence: 100,
      acknowledged: true
    },
    {
      id: 'evt-init-2',
      deviceId: 'SCM-DL-7821',
      type: 'checkpoint',
      severity: 'info',
      timestamp: Date.now() - 1 * 3600_000,
      title: 'Milestone: Neemrana Toll',
      description: 'Passed RFID electronic toll plaza at 72 km/h. SLA normal.',
      measured: true,
      confidence: 100,
      acknowledged: true
    }
  ]
};

module.exports = memoryStore;
