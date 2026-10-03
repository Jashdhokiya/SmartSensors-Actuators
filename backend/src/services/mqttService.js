const mqtt = require('mqtt');
const {
  MQTT_BROKER_URL, MQTT_CLIENT_ID, MQTT_USERNAME, MQTT_PASSWORD,
  MQTT_TOPICS, MQTT_QOS, MQTT_CLEAN_SESSION,
  MQTT_LWT_TOPIC, MQTT_LWT_MESSAGE
} = require('../config/config');
const { processIncomingTelemetry, processDeviceStatus } = require('./telemetryService');

let client = null;

// Tracks last seen sequence number per device for gap detection
const deviceSequences = new Map();

function initMQTT() {
  console.log(`🔌 [MQTT] Connecting to broker at ${MQTT_BROKER_URL}...`);

  client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: MQTT_CLIENT_ID,
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    reconnectPeriod: 5000,
    connectTimeout: 30 * 1000,
    clean: MQTT_CLEAN_SESSION,

    // Last Will and Testament — broker publishes this if backend disconnects
    will: {
      topic: MQTT_LWT_TOPIC,
      payload: MQTT_LWT_MESSAGE,
      qos: 1,
      retain: true
    }
  });

  client.on('connect', () => {
    console.log(`✅ [MQTT] Connected successfully to ${MQTT_BROKER_URL}`);

    // Publish online status (retained) so dashboards can see backend is alive
    client.publish(MQTT_LWT_TOPIC, JSON.stringify({
      service: 'smart_cargo_backend',
      status: 'online',
      timestamp: Date.now()
    }), { qos: 1, retain: true });

    MQTT_TOPICS.forEach((topic) => {
      client.subscribe(topic, { qos: MQTT_QOS }, (err) => {
        if (err) {
          console.error(`❌ [MQTT] Failed to subscribe to ${topic}:`, err);
        } else {
          console.log(`📥 [MQTT] Subscribed to topic: ${topic} (QoS ${MQTT_QOS})`);
        }
      });
    });
  });

  client.on('message', async (topic, message) => {
    try {
      const rawStr = message.toString().trim();

      // Route device status messages (LWT / online heartbeats)
      if (topic.match(/^cargo\/[^/]+\/status$/)) {
        if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
          const statusPayload = JSON.parse(rawStr);
          processDeviceStatus(statusPayload);
        }
        return;
      }

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

      // Sequence number gap detection
      if (payload.seq !== undefined && payload.device_id) {
        const devId = payload.device_id;
        const expectedSeq = deviceSequences.get(devId);
        if (expectedSeq !== undefined && payload.seq !== expectedSeq) {
          const gap = payload.seq - expectedSeq;
          if (gap > 0) {
            console.warn(`⚠️ [MQTT] Sequence gap detected for ${devId}: expected ${expectedSeq}, got ${payload.seq} (${gap} message(s) lost)`);
          }
        }
        deviceSequences.set(devId, payload.seq + 1);
      }

      await processIncomingTelemetry(payload);
    } catch (err) {
      console.warn(`⚠️ [MQTT] Ignored non-standard payload on ${topic}:`, err.message);
    }
  });

  client.on('error', (err) => {
    console.warn(`⚠️ [MQTT] Broker connection error:`, err.message);
  });

  client.on('reconnect', () => {
    console.log(`🔄 [MQTT] Reconnecting to broker...`);
  });

  client.on('offline', () => {
    console.warn(`📴 [MQTT] Client went offline`);
  });

  return client;
}

module.exports = {
  initMQTT,
  getMQTTClient: () => client,
  getDeviceSequences: () => deviceSequences
};
