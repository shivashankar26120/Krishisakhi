/**
 * Knex CLI configuration (used by `knex migrate:latest`, `knex seed:run`, etc.)
 * The application code imports src/db/knex.js directly.
 */
'use strict';

require('dotenv').config();

/** @type { import("knex").Knex.Config } */
module.exports = {
  client: 'pg',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: { min: 2, max: 10 },
  migrations: {
    tableName: 'knex_migrations',
    directory: './src/db/migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
};
