-- ============================================================================
-- Smart Cargo Monitor - PostgreSQL Production Database Schema
-- Optimized for High-Throughput IoT Time-Series Telemetry & Predictive Tracking
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE alert_severity_enum AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE shipment_status_enum AS ENUM ('PENDING', 'IN_TRANSIT', 'DELIVERED', 'ALERT_HOLD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLE: devices
-- Stores registered tracking hardware devices and configuration thresholds
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(64) PRIMARY KEY,
    device_name VARCHAR(128) NOT NULL,
    hardware_version VARCHAR(32) DEFAULT 'ESP32-DEV-V1',
    firmware_version VARCHAR(32) DEFAULT 'Phase-2-Predictive',
    shock_threshold_g REAL DEFAULT 2.5,
    tilt_threshold_deg REAL DEFAULT 45.0,
    temp_safe_min_c REAL DEFAULT 2.0,
    temp_safe_max_c REAL DEFAULT 8.0,
    humidity_safe_max_pct REAL DEFAULT 65.0,
    battery_safe_min_v REAL DEFAULT 3.3,
    shock_exposure_budget REAL DEFAULT 500.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- TABLE: shipments (Cargo Metadata Mapping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS shipments (
    shipment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id VARCHAR(64) REFERENCES devices(device_id) ON DELETE SET NULL,
    cargo_type VARCHAR(64) NOT NULL,
    origin_location VARCHAR(255),
    destination_location VARCHAR(255),
    status shipment_status_enum DEFAULT 'IN_TRANSIT',
    dispatched_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMPTZ
);

-- ============================================================================
-- TABLE: cargo_telemetry (Main Time-Series Table - Partitioned by Month)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cargo_telemetry (
    telemetry_id BIGSERIAL,
    device_id VARCHAR(64) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    uptime_ms BIGINT NOT NULL,
    
    -- Motion Telemetry (MPU-6050)
    accel_x_g REAL,
    accel_y_g REAL,
    accel_z_g REAL,
    accel_magnitude_g REAL,
    tilt_deg REAL,
    shock_detected BOOLEAN DEFAULT FALSE,
    tilt_exceeded BOOLEAN DEFAULT FALSE,
    
    -- GPS Telemetry (NEO-6M)
    gps_fix_valid BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    speed_kmph REAL,
    altitude_m REAL,
    satellites SMALLINT DEFAULT 0,
    
    -- Alert Summary Flags
    alert_active BOOLEAN DEFAULT FALSE,
    alert_reason TEXT,
    
    -- Predictive Layer Channels
    pred_shock_valid BOOLEAN DEFAULT FALSE,
    pred_shock_current_total REAL,
    pred_shock_budget REAL,
    pred_shock_rate_per_sec REAL,
    pred_shock_seconds_to_breach BIGINT,
    
    pred_temp_valid BOOLEAN DEFAULT FALSE,
    pred_temp_rate_c_per_min REAL,
    pred_temp_seconds_to_breach BIGINT,
    
    pred_humidity_valid BOOLEAN DEFAULT FALSE,
    pred_humidity_rate_pct_per_min REAL,
    pred_humidity_seconds_to_breach BIGINT,
    
    pred_battery_valid BOOLEAN DEFAULT FALSE,
    pred_battery_rate_v_per_hr REAL,
    pred_battery_seconds_to_empty BIGINT,
    
    -- Full Raw JSON Payload
    raw_payload JSONB,

    PRIMARY KEY (recorded_at, telemetry_id, device_id)
) PARTITION BY RANGE (recorded_at);

-- Sample Partitions
CREATE TABLE IF NOT EXISTS cargo_telemetry_default PARTITION OF cargo_telemetry DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at_brin 
    ON cargo_telemetry USING BRIN (recorded_at);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time 
    ON cargo_telemetry (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_active_alerts 
    ON cargo_telemetry (device_id, recorded_at DESC) 
    WHERE alert_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_telemetry_gps_coords 
    ON cargo_telemetry (latitude, longitude) 
    WHERE gps_fix_valid = TRUE;

-- ============================================================================
-- TABLE: cargo_alerts (Dedicated Alert & Incident Log)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cargo_alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    alert_type VARCHAR(64) NOT NULL,
    severity alert_severity_enum DEFAULT 'WARNING',
    message TEXT NOT NULL,
    accel_magnitude_g REAL,
    tilt_deg REAL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    time_to_breach_secs BIGINT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(128),
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerts_device_time ON cargo_alerts (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unacknowledged ON cargo_alerts (acknowledged, recorded_at DESC);

-- ============================================================================
-- HELPER VIEW: Latest Device Status
-- ============================================================================
CREATE OR REPLACE VIEW view_latest_device_status AS
SELECT DISTINCT ON (t.device_id)
    t.device_id,
    d.device_name,
    t.recorded_at AS last_seen_at,
    t.gps_fix_valid,
    t.latitude,
    t.longitude,
    t.speed_kmph,
    t.accel_magnitude_g,
    t.tilt_deg,
    t.alert_active,
    t.alert_reason,
    t.pred_shock_seconds_to_breach,
    t.pred_temp_seconds_to_breach,
    t.pred_humidity_seconds_to_breach,
    t.pred_battery_seconds_to_empty
FROM cargo_telemetry t
LEFT JOIN devices d ON t.device_id = d.device_id
ORDER BY t.device_id, t.recorded_at DESC;
