const path = require("path");
const mysql = require("mysql2/promise");

// server.js 経由以外で mysqlPool.js が呼ばれても .env を読めるようにする
require("dotenv").config({
  path: path.resolve(process.cwd(), ".env")
});

function getRequiredEnv(name, fallback = "") {
  const value = process.env[name];

  if (value !== undefined && value !== "") {
    return value;
  }

  return fallback;
}

function getNumberEnv(name, fallback) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    return fallback;
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return fallback;
  }

  return number;
}

const mysqlConfig = {
  host: getRequiredEnv("DB_HOST", "mysql"),
  port: getNumberEnv("DB_PORT", 3306),
  user: getRequiredEnv("DB_USER", "root"),
  password: getRequiredEnv("DB_PASSWORD", ""),
  database: getRequiredEnv("DB_NAME", "revino"),

  waitForConnections: true,
  connectionLimit: getNumberEnv("DB_CONNECTION_LIMIT", 10),
  queueLimit: 0,
  charset: "utf8mb4"
};

const pool = mysql.createPool(mysqlConfig);

async function testMysqlConnection() {
  const connection = await pool.getConnection();

  try {
    await connection.ping();

    console.log(
      `[mysql] connected: ${mysqlConfig.user}@${mysqlConfig.host}:${mysqlConfig.port}/${mysqlConfig.database}`
    );

    return true;
  } finally {
    connection.release();
  }
}

// 既存Repositoryで db.query(...) と書けるように pool をそのまま export する
pool.testMysqlConnection = testMysqlConnection;

module.exports = pool;