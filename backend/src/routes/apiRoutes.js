const express = require('express');
const router = express.Router();

const { isDbConnected } = require('../db/db');
const { getMQTTClient } = require('../services/mqttService');
const { DATABASE_URL, MQTT_BROKER_URL, MQTT_TOPICS } = require('../config/config');
const memoryStore = require('../services/store');

const { getAllDevices, getDeviceById } = require('../controllers/deviceController');
const { getLatestTelemetry, getTelemetryHistory, ingestTelemetryRest } = require('../controllers/telemetryController');
const { getAlerts, acknowledgeAlert, acknowledgeAllAlerts, resolveAlert } = require('../controllers/alertController');
const { getEvents } = require('../controllers/eventController');
const { addSSEClient, removeSSEClient } = require('../services/telemetryService');

// --- Health Check ---
router.get('/health', (req, res) => {
  const mqttClient = getMQTTClient();
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    database: {
      connected: isDbConnected(),
      url: DATABASE_URL.replace(/:[^:@]+@/, ':***@')
    },
    mqtt: {
      connected: mqttClient ? mqttClient.connected : false,
      broker: MQTT_BROKER_URL,
      topics: MQTT_TOPICS
    },
    devicesCount: memoryStore.devices.size,
    activeAlertsCount: memoryStore.alerts.filter(a => a.status === 'active').length
  });
});

// --- Devices Routes ---
router.get('/devices', getAllDevices);
router.get('/devices/:id', getDeviceById);

// --- Telemetry Routes ---
router.get('/devices/:id/telemetry/latest', getLatestTelemetry);
router.get('/devices/:id/telemetry/history', getTelemetryHistory);
router.post('/telemetry', ingestTelemetryRest);

// --- Alerts Routes ---
router.get('/alerts', getAlerts);
router.post('/alerts/:id/acknowledge', acknowledgeAlert);
router.post('/alerts/acknowledge-all', acknowledgeAllAlerts);
router.post('/alerts/:id/resolve', resolveAlert);

// --- Events / Audit Trail ---
router.get('/events', getEvents);

// --- Server-Sent Events (SSE) Live Push ---
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  addSSEClient(res);
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Live Stream Active' })}\n\n`);

  req.on('close', () => {
    removeSSEClient(res);
  });
});

module.exports = router;
