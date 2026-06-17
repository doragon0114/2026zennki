const mysql = require("mysql2/promise");
const { randomUUID } = require("crypto");

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// ── ヘルパー: question + question_choices を結合してシャッフル済みに変換 ──
async function getQuestionWithChoices(questionId) {
  const [qRows] = await pool.query(
    "SELECT * FROM question WHERE question_id = ?",
    [questionId]
  );
  if (!qRows[0]) return null;

  const [cRows] = await pool.query(
    "SELECT * FROM question_choices WHERE question_id = ? ORDER BY choice_label",
    [questionId]
  );

  // シャッフル
  for (let i = cRows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cRows[i], cRows[j]] = [cRows[j], cRows[i]];
  }

  const correct = cRows.findIndex(c => c.is_correct === 1);

  return {
    ...qRows[0],
    choices: cRows.map(c => c.choice_text),
    correct,
  };
}

// 問題セット一覧取得
async function getAllQuestionLists() {
  const [rows] = await pool.query("SELECT * FROM Questions");
  return rows;
}

// 問題セット1件取得
async function findQuestionListById(materialId) {
  const [rows] = await pool.query(
    "SELECT * FROM Questions WHERE material_id = ?",
    [materialId]
  );
  return rows[0] || null;
}

// 問題セット作成
async function createQuestionList(materialId, userId, categoryId, materialName, imageText) {
  await pool.query(
    `INSERT INTO Questions
      (material_id, user_id, category_id, material_name, image_text)
     VALUES (?, ?, ?, ?, ?)`,
    [
      materialId,
      userId,
      categoryId || null,
      materialName || "生成された問題セット",
      imageText || null,
    ]
  );
  return findQuestionListById(materialId);
}

// 問題セットに紐づく問題を全件取得
async function findQuestionsByListId(materialId) {
  const [rows] = await pool.query(
    "SELECT question_id FROM question WHERE material_id = ?",
    [materialId]
  );
  const questions = await Promise.all(
    rows.map(r => getQuestionWithChoices(r.question_id))
  );
  return questions.filter(Boolean);
}

// 問題1件取得
async function findQuestionById(questionId) {
  return getQuestionWithChoices(questionId);
}

// 問題 + 選択肢を追加（トランザクション）
async function createQuestion(questionId, materialId, body) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO question (question_id, material_id, question_text, explanation)
       VALUES (?, ?, ?, ?)`,
      [questionId, materialId, body.text, body.explanation || null]
    );

    const labels = ["A", "B", "C", "D"];
    for (let i = 0; i < body.choices.length; i++) {
      await conn.query(
        `INSERT INTO question_choices
          (choice_id, question_id, choice_label, choice_text, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          questionId,
          labels[i],
          body.choices[i],
          i === body.correct ? 1 : 0,
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return findQuestionById(questionId);
}

// 問題更新（選択肢は削除して再挿入）
async function updateQuestion(questionId, body) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE question SET question_text = ?, explanation = ? WHERE question_id = ?`,
      [body.text, body.explanation || null, questionId]
    );

    await conn.query(
      "DELETE FROM question_choices WHERE question_id = ?",
      [questionId]
    );

    const labels = ["A", "B", "C", "D"];
    for (let i = 0; i < body.choices.length; i++) {
      await conn.query(
        `INSERT INTO question_choices
          (choice_id, question_id, choice_label, choice_text, is_correct)
         VALUES (?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          questionId,
          labels[i],
          body.choices[i],
          i === body.correct ? 1 : 0,
        ]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return findQuestionById(questionId);
}

// 問題削除（question_choices は CASCADE で自動削除）
async function deleteQuestion(questionId) {
  await pool.query("DELETE FROM question WHERE question_id = ?", [questionId]);
}

module.exports = {
  pool,
  // authMysqlRepository.js / authProfileMysqlRepository.js から使われる
  query: (...args) => pool.query(...args),
  getConnection: () => pool.getConnection(),
  // 問題関連
  getAllQuestionLists,
  findQuestionListById,
  createQuestionList,
  findQuestionsByListId,
  findQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};