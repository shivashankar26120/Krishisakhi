'use strict';

const knex = require('knex');
const { databaseUrl, nodeEnv } = require('../config/env');

/**
 * Knex instance — shared across the application.
 * Uses pg (node-postgres) driver.
 * SSL is required for cloud-managed PostgreSQL (DATABASE_URL usually has sslmode=require).
 */
const db = knex({
  client: 'pg',
  connection: {
    connectionString: databaseUrl,
    ssl: nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations',
  },
  seeds: {
    directory: './seeds',
  },
});

module.exports = db;
