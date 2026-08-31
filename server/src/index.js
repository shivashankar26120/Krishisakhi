'use strict';

const app = require('./app');
const { port } = require('./config/env');
const db = require('./db/knex');
const logger = require('./config/logger');

async function start() {
  // Verify database connectivity before accepting requests
  try {
    await db.raw('SELECT 1');
    logger.info('Database connection OK');
  } catch (err) {
    logger.error('Database connection failed — check DATABASE_URL', { error: err.message });
    process.exit(1);
  }

  const server = app.listen(port, () => {
    logger.info(`Krishi Sakhi server started`, { port, env: process.env.NODE_ENV });
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await db.destroy();
      logger.info('Server and DB connections closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start();
