#include "gps_tracker.h"

static TinyGPSPlus gps;
static HardwareSerial gpsSerial(2); // ESP32 Hardware UART2

void initGPS() {
  gpsSerial.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Serial.println("[OK] NEO-6M GPS UART2 started on GPIO 16 (RX) & GPIO 17 (TX).");
  Serial.println("[INFO] Note: GPS fix requires sky visibility for 1-3 minutes.");
}

void feedGPS() {
  unsigned long start = millis();
  while (gpsSerial.available() > 0 && (millis() - start) < GPS_FEED_BUDGET_MS) {
    gps.encode(gpsSerial.read());
  }
}

void readGPSData(CargoReading &reading) {
  reading.gpsFixValid = gps.location.isValid() && (gps.location.age() < 2000);

  if (gps.location.isValid()) {
    reading.latitude  = gps.location.lat();
    reading.longitude = gps.location.lng();
  }
  if (gps.speed.isValid()) {
    reading.speedKmph = gps.speed.kmph();
  } else {
    reading.speedKmph = 0.0;
  }
  if (gps.altitude.isValid()) {
    reading.altitudeMeters = gps.altitude.meters();
  } else {
    reading.altitudeMeters = 0.0;
  }

  reading.satellites = gps.satellites.isValid() ? gps.satellites.value() : 0;
  reading.hdop = gps.hdop.isValid() ? (float)gps.hdop.value() / 100.0f : 99.9f;

  if (gps.time.isValid() && gps.date.isValid()) {
    char timeBuf[32];
    snprintf(timeBuf, sizeof(timeBuf), "%04d-%02d-%02d %02d:%02d:%02d UTC",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
    reading.timestamp = String(timeBuf);
  } else {
    reading.timestamp = "Waiting for satellite time...";
  }
}

uint32_t getGPSCharsProcessed() {
  return gps.charsProcessed();
}

uint32_t getGPSSentencesWithFix() {
  return gps.sentencesWithFix();
}
