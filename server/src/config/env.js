/**
 * Environment configuration.
 * Validates required variables at startup so the server fails fast
 * with a clear message rather than a cryptic runtime error later.
 */
'use strict';

require('dotenv').config();

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    console.error(`[config] Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  nodeEnv:    process.env.NODE_ENV || 'development',
  port:       parseInt(process.env.PORT || '3001', 10),

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    secret:    process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',

  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(o => o.trim()),

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max:      parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};
