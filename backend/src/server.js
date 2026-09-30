/**
 * Smart Cargo Monitor - Cloud Backend Entrypoint
 * Orchestrates Express REST API, MQTT Subscriber, and PostgreSQL connection.
 */

const express = require('express');
const cors = require('cors');
const { PORT, DATABASE_URL, MQTT_BROKER_URL } = require('./config/config');
const { initMQTT } = require('./services/mqttService');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Mount API Routes
app.use('/api', apiRoutes);

// Initialize MQTT Ingestion Engine
initMQTT();

// Start HTTP Server
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 Smart Cargo Monitor Cloud Backend running on port ${PORT}`);
  console.log(`📡 REST API Base: http://localhost:${PORT}/api`);
  console.log(`🔌 MQTT Broker:  ${MQTT_BROKER_URL}`);
  console.log(`🗄️ PostgreSQL:   ${DATABASE_URL}`);
  console.log(`================================================================`);
});

module.exports = app;
