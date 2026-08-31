'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { corsOrigins, rateLimit: rlConfig, nodeEnv } = require('./config/env');
const logger = require('./config/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// Routes
const authRouter    = require('./routes/auth');
const farmerRouter  = require('./routes/farmer');
const diseaseRouter = require('./routes/disease');
const chatRouter    = require('./routes/chat');
const schemesRouter = require('./routes/schemes');
const marketRouter  = require('./routes/market');

const app = express();

// ── Security ─────────────────────────────────────────────────
app.use(helmet());

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────
app.use(rateLimit({
  windowMs: rlConfig.windowMs,
  max: rlConfig.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
}));

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// ── Logging ───────────────────────────────────────────────────
app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'krishisakhi-server', timestamp: new Date().toISOString() });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',    authRouter);
app.use('/api/farmer',  farmerRouter);
app.use('/api/disease', diseaseRouter);
app.use('/api/chat',    chatRouter);
app.use('/api/schemes', schemesRouter);
app.use('/api/market',  marketRouter);

// ── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
