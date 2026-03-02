const { query } = require('../config/db');

async function createUser({ username, password_hash }) {
  const result = await query(
    `INSERT INTO anonymous_users (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, credibility_score, trust_flag, created_at`,
    [username, password_hash]
  );

  return {
    ...result.rows[0],
    role: 'reporter',
    userType: 'anon',
  };
}

async function findAnonByAlias(alias) {
  const result = await query(
    `SELECT id, username, password_hash, credibility_score, trust_flag, created_at
     FROM anonymous_users
     WHERE username = $1
     LIMIT 1`,
    [alias]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    role: 'reporter',
    userType: 'anon',
  };
}

async function findHrByEmail(email) {
  const result = await query(
    `SELECT id, name, email, password_hash, role, two_factor_enabled, created_at
     FROM hr_users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    userType: 'hr',
  };
}

async function createHrUser({ name, email, password_hash, role, two_factor_enabled = false }) {
  const result = await query(
    `INSERT INTO hr_users (name, email, password_hash, role, two_factor_enabled)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, two_factor_enabled, created_at`,
    [name, email, password_hash, role, two_factor_enabled]
  );

  return {
    ...result.rows[0],
    userType: 'hr',
  };
}

async function updateAnonLastLogin(id) {
  await query('UPDATE anonymous_users SET last_login = NOW() WHERE id = $1', [id]);
}

async function findAnonById(id) {
  const result = await query(
    `SELECT id, username, credibility_score, trust_flag, created_at, last_login
     FROM anonymous_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    role: 'reporter',
    userType: 'anon',
  };
}

async function findAnonAuthById(id) {
  const result = await query(
    `SELECT id, username, password_hash, credibility_score, trust_flag, created_at, last_login
     FROM anonymous_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    role: 'reporter',
    userType: 'anon',
  };
}

async function updateAnonPassword(id, password_hash) {
  await query('UPDATE anonymous_users SET password_hash = $2 WHERE id = $1', [id, password_hash]);
}

async function adjustAnonCredibility(id, delta) {
  const result = await query(
    `UPDATE anonymous_users
     SET credibility_score = LEAST(100, GREATEST(0, COALESCE(credibility_score, 100) + $2)),
         trust_flag = LEAST(100, GREATEST(0, COALESCE(credibility_score, 100) + $2)) >= 70
     WHERE id = $1
     RETURNING id, credibility_score, trust_flag`,
    [id, delta]
  );

  return result.rows[0] || null;
}

async function findHrById(id) {
  const result = await query(
    `SELECT id, name, email, role, two_factor_enabled, created_at
     FROM hr_users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!result.rows[0]) return null;

  return {
    ...result.rows[0],
    userType: 'hr',
  };
}

module.exports = {
  createUser,
  findAnonByAlias,
  findHrByEmail,
  createHrUser,
  findAnonById,
  findAnonAuthById,
  findHrById,
  updateAnonLastLogin,
  updateAnonPassword,
  adjustAnonCredibility,
};
