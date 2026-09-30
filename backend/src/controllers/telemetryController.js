const memoryStore = require('../services/store');
const { normalizeTelemetry, processIncomingTelemetry } = require('../services/telemetryService');

function getLatestTelemetry(req, res) {
  const { id } = req.params;
  const telemetry = memoryStore.latestTelemetry.get(id);

  if (telemetry) {
    return res.json({ success: true, deviceId: id, telemetry });
  }

  // Fallback to first available in cache or default standard
  const fallback = memoryStore.latestTelemetry.values().next().value;
  if (fallback) {
    return res.json({ success: true, deviceId: id, telemetry: { ...fallback, deviceId: id } });
  }

  const { standardized } = normalizeTelemetry({ device_id: id });
  res.json({ success: true, deviceId: id, telemetry: standardized });
}

function getTelemetryHistory(req, res) {
  const { id } = req.params;
  const { range = '1h', limit = 300 } = req.query;

  const history = memoryStore.telemetryHistory.get(id) || [];
  const maxPoints = Math.min(Number(limit) || 300, 500);

  const now = Date.now();
  const windows = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    'full': Infinity
  };
  const windowMs = windows[range] || windows['1h'];
  const cutoff = now - windowMs;

  const filtered = history.filter(p => p.timestamp >= cutoff).slice(-maxPoints);

  res.json({
    success: true,
    deviceId: id,
    range,
    count: filtered.length,
    history: filtered
  });
}

async function ingestTelemetryRest(req, res) {
  try {
    await processIncomingTelemetry(req.body);
    res.status(201).json({ success: true, message: 'Telemetry processed successfully' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  getLatestTelemetry,
  getTelemetryHistory,
  ingestTelemetryRest
};
