const memoryStore = require('../services/store');
const { broadcastToClients } = require('../services/telemetryService');

function getAlerts(req, res) {
  const { deviceId, status, severity } = req.query;
  let list = [...memoryStore.alerts];

  if (deviceId) list = list.filter(a => a.deviceId === deviceId);
  if (status && status !== 'all') list = list.filter(a => a.status === status);
  if (severity && severity !== 'all') list = list.filter(a => a.severity === severity);

  res.json({
    success: true,
    count: list.length,
    alerts: list
  });
}

function acknowledgeAlert(req, res) {
  const { id } = req.params;
  const alert = memoryStore.alerts.find(a => a.id === id);
  if (alert) {
    alert.acknowledged = true;
    alert.status = 'acknowledged';
    alert.acknowledgedAt = Date.now();
    broadcastToClients({ type: 'ALERT_UPDATED', alert });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ success: false, message: 'Alert not found' });
}

function acknowledgeAllAlerts(req, res) {
  const now = Date.now();
  memoryStore.alerts.forEach(a => {
    if (a.status === 'active') {
      a.acknowledged = true;
      a.status = 'acknowledged';
      a.acknowledgedAt = now;
    }
  });
  broadcastToClients({ type: 'ALL_ALERTS_ACKNOWLEDGED' });
  res.json({ success: true, count: memoryStore.alerts.length });
}

function resolveAlert(req, res) {
  const { id } = req.params;
  const alert = memoryStore.alerts.find(a => a.id === id);
  if (alert) {
    alert.status = 'resolved';
    alert.resolvedAt = Date.now();
    broadcastToClients({ type: 'ALERT_RESOLVED', alert });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ success: false, message: 'Alert not found' });
}

module.exports = {
  getAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  resolveAlert
};
