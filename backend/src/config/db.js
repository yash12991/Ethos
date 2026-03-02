const postgres = require('postgres');
const logger = require('../utils/logger');

const useSsl = String(process.env.PG_SSL || 'true') === 'true';
const rawConnectionString = process.env.DATABASE_URL || '';
const connectionString = rawConnectionString.startsWith('DATABASE_URL=')
  ? rawConnectionString.replace(/^DATABASE_URL=/, '')
  : rawConnectionString;
const poolMax = Number(process.env.PG_POOL_MAX || 10);

const sql = postgres(connectionString, {
  ssl: useSsl ? 'require' : false,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
  connect_timeout: 10,
  idle_timeout: 30,
  prepare: false,
  onnotice: () => {},
});

async function query(text, params = []) {
  const start = Date.now();
  const rows = await sql.unsafe(text, params);
  const duration = Date.now() - start;
  const result = { rows, rowCount: rows.length };

  logger.debug('DB query executed', {
    duration,
    rowCount: result.rowCount,
  });

  return result;
}

module.exports = {
  sql,
  query,
};
