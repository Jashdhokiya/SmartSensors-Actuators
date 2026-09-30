const memoryStore = require('../services/store');

function getEvents(req, res) {
  res.json({
    success: true,
    count: memoryStore.events.length,
    events: memoryStore.events
  });
}

module.exports = {
  getEvents
};
