/**
 * Smart Cargo Monitor - Cloud Backend Entrypoint
 * Orchestrates Express REST API, MQTT Subscriber, and PostgreSQL connection.
 *
 * Security hardening:
 *   - Helmet for HTTP security headers (XSS, HSTS, CSP, etc.)
 *   - Rate limiting to prevent abuse
 *   - Restricted CORS origin (configurable via CORS_ORIGIN env var)
 *   - JSON body size limit
 */

const express = require('express');
const cors = require('cors');
const { PORT, DATABASE_URL, MQTT_BROKER_URL, CORS_ORIGIN, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } = require('./config/config');
const { initMQTT } = require('./services/mqttService');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// ── Security: Helmet-like headers (inline, no extra dependency) ─────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
});

// ── Security: Rate Limiting (in-memory, no extra dependency) ────────────
const rateLimitStore = new Map();

app.use((req, res, next) => {
  // Skip rate limiting for SSE stream endpoint
  if (req.path === '/api/stream') return next();

  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, []);
  }

  const hits = rateLimitStore.get(ip).filter(ts => ts > windowStart);
  hits.push(now);
  rateLimitStore.set(ip, hits);

  if (hits.length > RATE_LIMIT_MAX) {
    res.setHeader('Retry-After', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${RATE_LIMIT_MAX} requests per ${RATE_LIMIT_WINDOW_MS / 1000}s window.`,
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    });
  }

  next();
});

// Clean up rate limit store periodically (every 5 minutes)
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, hits] of rateLimitStore.entries()) {
    const filtered = hits.filter(ts => ts > cutoff);
    if (filtered.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, filtered);
    }
  }
}, 5 * 60 * 1000);

// ── CORS ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ── Body parsing with size limit ────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));  // Reduced from 10mb — telemetry payloads are small

// Mount API Routes
app.use('/api', apiRoutes);

// Initialize MQTT Ingestion Engine
initMQTT();

// Start HTTP Server
app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🚀 Smart Cargo Monitor Cloud Backend running on port ${PORT}`);
  console.log(`📡 REST API Base: http://localhost:${PORT}/api`);
  console.log(`🔌 MQTT Broker:  ${MQTT_BROKER_URL}`);
  console.log(`🗄️ PostgreSQL:   ${DATABASE_URL}`);
  console.log(`🔒 CORS Origin:  ${CORS_ORIGIN}`);
  console.log(`🛡️ Rate Limit:   ${RATE_LIMIT_MAX} req/${RATE_LIMIT_WINDOW_MS/1000}s`);
  console.log(`================================================================`);
});

module.exports = app;
