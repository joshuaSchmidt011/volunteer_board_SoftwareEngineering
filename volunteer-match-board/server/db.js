const { Pool } = require("pg");

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const usePostgres = hasDatabaseUrl && process.env.USE_POSTGRES !== "false";

let pool = null;

if (usePostgres) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });
}

async function query(text, params) {
  if (!pool) {
    throw new Error("PostgreSQL is not configured. Add DATABASE_URL to server/.env to enable it.");
  }

  return pool.query(text, params);
}

async function checkDatabaseConnection() {
  if (!pool) {
    return {
      connected: false,
      mode: "in-memory fallback",
      message: "DATABASE_URL is not configured, so the server is using in-memory seed data."
    };
  }

  try {
    await pool.query("SELECT 1");
    return {
      connected: true,
      mode: "postgresql",
      message: "PostgreSQL connection is active."
    };
  } catch (error) {
    return {
      connected: false,
      mode: "postgresql error",
      message: error.message
    };
  }
}

module.exports = {
  usePostgres,
  query,
  checkDatabaseConnection
};
