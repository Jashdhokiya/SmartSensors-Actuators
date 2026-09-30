const mqtt = require('mqtt');
const { MQTT_BROKER_URL, MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPICS } = require('../config/config');
const { processIncomingTelemetry } = require('./telemetryService');

let client = null;

function initMQTT() {
  console.log(`🔌 [MQTT] Connecting to broker at ${MQTT_BROKER_URL}...`);

  client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: MQTT_CLIENT_ID,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
  });

  client.on('connect', () => {
    console.log(`✅ [MQTT] Connected successfully to ${MQTT_BROKER_URL}`);
    MQTT_TOPICS.forEach((topic) => {
      client.subscribe(topic, (err) => {
        if (err) {
          console.error(`❌ [MQTT] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📥 [MQTT] Subscribed to topic: ${topic}`);
        }
      });
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const rawStr = message.toString().trim();
      let payload;
      if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
        payload = JSON.parse(rawStr);
      } else {
        const parts = topic.split('/');
        const deviceId = parts[1] || 'cargo_esp32_01';
        payload = {
          device_id: deviceId,
          alert_active: true,
          alert_reason: rawStr,
          timestamp_ms: Date.now()
        };
      }
      await processIncomingTelemetry(payload);
    } catch (err) {
      console.warn(`⚠️ [MQTT] Ignored non-standard payload on ${topic}:`, err.message);
    }
  });

  client.on('error', (err) => {
    console.warn(`⚠️ [MQTT] Broker connection error:`, err.message);
  });

  return client;
}

module.exports = {
  initMQTT,
  getMQTTClient: () => client
};
