require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_cargo_db',

  // MQTT Broker Connection
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || `smart_cargo_server_${Math.random().toString(16).slice(2, 8)}`,
  MQTT_USERNAME: process.env.MQTT_USERNAME || undefined,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || undefined,

  // MQTT QoS & Reliability
  MQTT_QOS: parseInt(process.env.MQTT_QOS || '1', 10),          // QoS 1 = at-least-once delivery
  MQTT_CLEAN_SESSION: process.env.MQTT_CLEAN_SESSION !== 'false', // Clean session (set false to resume subscriptions)

  // MQTT Last Will and Testament — published by broker if backend disconnects unexpectedly
  MQTT_LWT_TOPIC: process.env.MQTT_LWT_TOPIC || 'cargo/server/status',
  MQTT_LWT_MESSAGE: JSON.stringify({ service: 'smart_cargo_backend', status: 'offline', timestamp: Date.now() }),

  // MQTT Topics to subscribe
  MQTT_TOPICS: [
    'cargo/+/telemetry',
    'cargo/telemetry',
    'cargo/+/status',       // Device online/offline LWT messages
    'cargo/+/alerts',
    'devices/+/telemetry',
    'devices/+/alerts'
  ],

  // HTTP Security
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',                    // Restrict in production (e.g. 'http://localhost:5173')
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),  // 1 minute
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),                // 200 requests per window
};
