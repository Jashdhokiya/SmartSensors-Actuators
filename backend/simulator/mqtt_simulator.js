/**
 * Smart Cargo Monitor - ESP32 MQTT Test Simulator
 * Publishes realistic telemetry matching smart_cargo_monitor firmware to the MQTT broker.
 * 
 * Run with: npm run simulate
 */

require('dotenv').config();
const mqtt = require('mqtt');

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const TOPIC = 'cargo/cargo_esp32_01/telemetry';

console.log(`Connecting simulator to MQTT broker: ${MQTT_BROKER_URL}...`);
const client = mqtt.connect(MQTT_BROKER_URL);

let step = 0;
let lat = 28.4595;
let lng = 77.0266;

client.on('connect', () => {
  console.log(`✅ Simulator connected to ${MQTT_BROKER_URL}`);
  console.log(`🚀 Publishing simulated ESP32 payload every 2 seconds to: ${TOPIC}`);

  setInterval(() => {
    step++;
    lat += (Math.random() - 0.48) * 0.002;
    lng += (Math.random() - 0.48) * 0.002;

    const accelX = (Math.sin(step * 0.1) * 0.1 + (Math.random() - 0.5) * 0.05).toFixed(3);
    const accelY = (Math.cos(step * 0.1) * 0.1 + (Math.random() - 0.5) * 0.05).toFixed(3);
    const accelZ = (0.98 + (Math.random() - 0.5) * 0.04).toFixed(3);
    const accelMag = Math.sqrt(accelX * accelX + accelY * accelY + accelZ * accelZ).toFixed(3);
    const tilt = (Math.sin(step * 0.05) * 5.0).toFixed(1);

    const temp = (4.2 + Math.sin(step * 0.05) * 0.8).toFixed(1);
    const humidity = (62 + Math.cos(step * 0.05) * 3).toFixed(1);
    const speed = Math.max(0, 70 + Math.sin(step * 0.1) * 15).toFixed(1);

    // Occasional simulated shock event
    const shockTrigger = step % 25 === 0;
    const finalMag = shockTrigger ? 2.65 : parseFloat(accelMag);

    const payload = {
      device_id: "cargo_esp32_01",
      timestamp_ms: Date.now(),
      motion: {
        accel_x_g: parseFloat(accelX),
        accel_y_g: parseFloat(accelY),
        accel_z_g: parseFloat(accelZ),
        accel_magnitude_g: finalMag,
        tilt_deg: parseFloat(tilt),
        shock_detected: shockTrigger,
        tilt_exceeded: false
      },
      gps: {
        fix_valid: true,
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lng.toFixed(6)),
        speed_kmph: parseFloat(speed),
        altitude_m: 242.5,
        satellites: 9,
        timestamp_utc: new Date().toISOString().replace('T', ' ').substring(0, 19) + " UTC"
      },
      alert_active: shockTrigger,
      alert_reason: shockTrigger ? "SHOCK_DETECTED: 2.65g peak road impact" : "",
      predictions: {
        shock_exposure: {
          valid: true,
          current_total: (step * 0.4).toFixed(1),
          budget: 500.0,
          rate_per_sec: 0.015,
          seconds_to_breach: 14200
        },
        temperature: {
          valid: true,
          rate_c_per_min: 0.02,
          seconds_to_breach: -1
        },
        humidity: {
          valid: true,
          rate_pct_per_min: 0.05,
          seconds_to_breach: -1
        },
        battery: {
          valid: true,
          rate_v_per_hr: 0.005,
          seconds_to_empty: 324000
        }
      }
    };

    client.publish(TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
      if (err) {
        console.error('Publish error:', err);
      } else {
        console.log(`[PUB #${step}] Temp: ${temp}°C | Mag: ${finalMag}g | Speed: ${speed}km/h | Alert: ${shockTrigger}`);
      }
    });
  }, 2000);
});

client.on('error', (err) => {
  console.error('MQTT connection error:', err);
});
