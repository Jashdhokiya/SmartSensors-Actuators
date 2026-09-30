const memoryStore = require('../services/store');

function getAllDevices(req, res) {
  const devicesList = Array.from(memoryStore.devices.values());
  res.json({
    success: true,
    count: devicesList.length,
    devices: devicesList
  });
}

function getDeviceById(req, res) {
  const { id } = req.params;
  const device = memoryStore.devices.get(id);
  if (device) {
    return res.json({ success: true, device });
  }
  res.status(404).json({ success: false, message: 'Device not found' });
}

module.exports = {
  getAllDevices,
  getDeviceById
};
