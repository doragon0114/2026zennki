const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:     process.env.DB_HOST     ,
  port:     process.env.DB_PORT     ,
  user:     process.env.DB_USER     ,
  password: process.env.DB_PASSWORD ,
  database: process.env.DB_NAME    ,
  waitForConnections: true,
  connectionLimit: 10,
});

// 問題リスト一覧取得
async function getAllQuestionLists() {
  const [rows] = await pool.query("SELECT * FROM QUESTION_LIST");
  return rows;
}

// 問題リスト1件取得
async function findQuestionListById(qlistId) {
  const [rows] = await pool.query(
    "SELECT * FROM QUESTION_LIST WHERE QLIST_ID = ?",
    [qlistId]
  );
  return rows[0] || null;
}

// 問題リスト作成
async function createQuestionList(qlistId, categoryId) {
  await pool.query(
    "INSERT INTO QUESTION_LIST (QLIST_ID, CATEGORY_ID) VALUES (?, ?)",
    [qlistId, categoryId]
  );
  return findQuestionListById(qlistId);
}

// 問題リストに紐づく問題を全件取得
async function findQuestionsByListId(qlistId) {
  const [rows] = await pool.query(
    "SELECT * FROM QUESTION WHERE QLIST_ID = ?",
    [qlistId]
  );
  return rows;
}

// 問題1件取得
async function findQuestionById(qid) {
  const [rows] = await pool.query(
    "SELECT * FROM QUESTION WHERE QID = ?",
    [qid]
  );
  return rows[0] || null;
}

// 問題追加
async function createQuestion(qid, qlistId, body) {
  const wrong = body.choices.filter((_, i) => i !== body.correct);
  await pool.query(
    `INSERT INTO QUESTION
      (QID, QLIST_ID, QUESTION, ANSWER, MISS_ONE, MISS_TWO, MISS_THREE, \`EXPLAIN\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
  return findQuestionById(qid);
}

// 問題更新
async function updateQuestion(qid, body) {
  const wrong = body.choices.filter((_, i) => i !== body.correct);
  await pool.query(
    `UPDATE QUESTION SET
      QUESTION   = ?,
      ANSWER     = ?,
      MISS_ONE   = ?,
      MISS_TWO   = ?,
      MISS_THREE = ?,
      \`EXPLAIN\` = ?
     WHERE QID = ?`,
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
  return findQuestionById(qid);
}

// 問題削除
async function deleteQuestion(qid) {
  await pool.query("DELETE FROM QUESTION WHERE QID = ?", [qid]);
}

module.exports = {
  pool,
  getAllQuestionLists,
  findQuestionListById,
  createQuestionList,
  findQuestionsByListId,
  findQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};