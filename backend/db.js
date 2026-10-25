const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
const { normalizeMultilineSecret, normalizeScalar } = require("./lib/env");

const localEnvPath = path.join(__dirname, ".env");
const rootEnvPath = path.join(__dirname, "..", ".env");
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : rootEnvPath;

require("dotenv").config({ path: envPath });

const localCaPath = path.join(__dirname, "ca.pem");
const dbCaCert =
  normalizeMultilineSecret(process.env.DB_CA_CERT) ||
  (fs.existsSync(localCaPath) ? fs.readFileSync(localCaPath, "utf8") : "");

if (!dbCaCert) {
  console.warn("DB_CA_CERT is not configured and backend/ca.pem is missing. MySQL TLS connection may fail.");
}

const poolOptions = {
  host: normalizeScalar(process.env.DB_HOST),
  user: normalizeScalar(process.env.DB_USER),
  password: normalizeScalar(process.env.DB_PASSWORD),
  database: normalizeScalar(process.env.DB_DATABASE),
  port: Number(normalizeScalar(process.env.DB_PORT)) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

if (dbCaCert) {
  poolOptions.ssl = { ca: dbCaCert };
}

const pool = mysql.createPool(poolOptions);

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
