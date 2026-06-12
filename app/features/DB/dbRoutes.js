const path = require("path");
const mysql = require("mysql2/promise");

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

// ==================================================
// 既存の問題リスト系DB処理
// ==================================================

async function getAllQuestionLists() {
  const [rows] = await pool.query("SELECT * FROM QUESTION_LIST");
  return rows;
}

async function findQuestionListById(qlistId) {
  const [rows] = await pool.query(
    "SELECT * FROM QUESTION_LIST WHERE QLIST_ID = ?",
    [qlistId]
  );

  return rows[0] || null;
}

async function createQuestionList(qlistId, categoryId) {
  await pool.query(
    "INSERT INTO QUESTION_LIST (QLIST_ID, CATEGORY_ID) VALUES (?, ?)",
    [qlistId, categoryId]
  );

  return await findQuestionListById(qlistId);
}

async function findQuestionsByListId(qlistId) {
  const [rows] = await pool.query(
    "SELECT * FROM QUESTION WHERE QLIST_ID = ?",
    [qlistId]
  );

  return rows;
}

async function findQuestionById(qid) {
  const [rows] = await pool.query(
    "SELECT * FROM QUESTION WHERE QID = ?",
    [qid]
  );

  return rows[0] || null;
}

async function createQuestion(qid, qlistId, body) {
  const wrong = body.choices.filter((_, i) => i !== body.correct);

  await pool.query(
    `
    INSERT INTO QUESTION
      (
        QID,
        QLIST_ID,
        QUESTION,
        ANSWER,
        MISS_ONE,
        MISS_TWO,
        MISS_THREE,
        \`EXPLAIN\`
      )
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      qid,
      qlistId,
      body.text,
      body.choices[body.correct],
      wrong[0] || "",
      wrong[1] || "",
      wrong[2] || "",
      body.explanation || ""
    ]
  );

  return await findQuestionById(qid);
}

async function updateQuestion(qid, body) {
  const wrong = body.choices.filter((_, i) => i !== body.correct);

  await pool.query(
    `
    UPDATE QUESTION
    SET
      QUESTION = ?,
      ANSWER = ?,
      MISS_ONE = ?,
      MISS_TWO = ?,
      MISS_THREE = ?,
      \`EXPLAIN\` = ?
    WHERE QID = ?
    `,
    [
      body.text,
      body.choices[body.correct],
      wrong[0] || "",
      wrong[1] || "",
      wrong[2] || "",
      body.explanation || "",
      qid
    ]
  );

  return await findQuestionById(qid);
}

async function deleteQuestion(qid) {
  await pool.query(
    "DELETE FROM QUESTION WHERE QID = ?",
    [qid]
  );
}

// ==================================================
// export
// ==================================================
// pool自体に関数を追加して export する。
pool.testMysqlConnection = testMysqlConnection;

pool.getAllQuestionLists = getAllQuestionLists;
pool.findQuestionListById = findQuestionListById;
pool.createQuestionList = createQuestionList;
pool.findQuestionsByListId = findQuestionsByListId;
pool.findQuestionById = findQuestionById;
pool.createQuestion = createQuestion;
pool.updateQuestion = updateQuestion;
pool.deleteQuestion = deleteQuestion;

module.exports = pool;