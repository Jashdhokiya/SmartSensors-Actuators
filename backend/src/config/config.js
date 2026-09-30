require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_cargo_db',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || `smart_cargo_server_${Math.random().toString(16).slice(2, 8)}`,
  MQTT_USERNAME: process.env.MQTT_USERNAME || undefined,
  MQTT_PASSWORD: process.env.MQTT_PASSWORD || undefined,
  MQTT_TOPICS: [
    'cargo/+/telemetry',
    'cargo/telemetry',
    'devices/+/telemetry',
    'cargo/+/alerts',
    'devices/+/alerts'
  ]
};
