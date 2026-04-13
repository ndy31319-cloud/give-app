const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, "ca.pem")),
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
