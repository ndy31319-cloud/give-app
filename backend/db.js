const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const { normalizeMultilineSecret, normalizeScalar } = require("./lib/env");

const localEnvPath = path.join(__dirname, ".env");
const rootEnvPath = path.join(__dirname, "..", ".env");
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : rootEnvPath;

require("dotenv").config({ path: envPath });

const dbCaCert =
  normalizeMultilineSecret(process.env.DB_CA_CERT) ||
  fs.readFileSync(path.join(__dirname, "ca.pem"), "utf8");

const pool = mysql.createPool({
  host: normalizeScalar(process.env.DB_HOST),
  user: normalizeScalar(process.env.DB_USER),
  password: normalizeScalar(process.env.DB_PASSWORD),
  database: normalizeScalar(process.env.DB_DATABASE),
  port: Number(normalizeScalar(process.env.DB_PORT)) || 3306,
  ssl: {
    ca: dbCaCert,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool
  .getConnection()
  .then((connection) => {
    console.log("Aiven MySQL DB connected.");
    connection.release();
  })
  .catch((err) => {
    console.error("DB connection failed:", err);
  });

module.exports = pool;
