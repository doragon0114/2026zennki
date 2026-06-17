const mysql = require("mysql2/promise");
const { randomUUID } = require("crypto");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4"
});

// ==================================================
// ヘルパー
// ==================================================

function labelToCorrectIndex(label) {
  const labels = ["A", "B", "C", "D"];
  const index = labels.indexOf(String(label || "").toUpperCase());

  return index >= 0 ? index : 0;
}

function correctIndexToLabel(index) {
  const labels = ["A", "B", "C", "D"];
  return labels[Number(index)] || "A";
}

function normalizeQuestionBody(body) {
  const text = String(body.text || "").trim();

  const choices = Array.isArray(body.choices)
    ? body.choices.map(choice => String(choice || "").trim())
    : [];

  const correct = Number(body.correct);
  const explanation = String(body.explanation || "").trim();

  if (!text) {
    throw new Error("問題文を入力してください");
  }

  if (choices.length !== 4 || choices.some(choice => !choice)) {
    throw new Error("選択肢は4つすべて入力してください");
  }

  if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
    throw new Error("正解番号が正しくありません");
  }

  return {
    text,
    choices,
    correct,
    explanation
  };
}

// ==================================================
// question + question_choices を結合して取得
// ==================================================

async function getQuestionWithChoices(questionId) {
  const [qRows] = await pool.query(
    `
    SELECT
      question_id,
      material_id,
      question_text,
      explanation,
      created_at,
      updated_at
    FROM question
    WHERE question_id = ?
    LIMIT 1
    `,
    [questionId]
  );

  if (!qRows[0]) {
    return null;
  }

  const [cRows] = await pool.query(
    `
    SELECT
      choice_id,
      question_id,
      choice_label,
      choice_text,
      is_correct,
      created_at
    FROM question_choices
    WHERE question_id = ?
    ORDER BY
      FIELD(choice_label, 'A', 'B', 'C', 'D'),
      choice_label ASC
    `,
    [questionId]
  );

  const correctChoice = cRows.find(choice => Number(choice.is_correct) === 1);

  return {
    ...qRows[0],
    choices: cRows.map(choice => choice.choice_text),
    correct: correctChoice
      ? labelToCorrectIndex(correctChoice.choice_label)
      : 0
  };
}

// ==================================================
// 問題セット materials
// ==================================================

// 問題セット一覧取得
async function getAllQuestionLists() {
  const [rows] = await pool.query(
    `
    SELECT
      m.material_id,
      m.user_id,
      m.category_id,
      m.material_name,
      m.image_text,
      m.is_shared,
      m.created_at,
      m.updated_at,
      c.category_name
    FROM materials m
    LEFT JOIN categories c
      ON m.category_id = c.category_id
    ORDER BY m.created_at DESC
    `
  );

  return rows;
}

// 問題セット1件取得
async function findQuestionListById(materialId) {
  const [rows] = await pool.query(
    `
    SELECT
      m.material_id,
      m.user_id,
      m.category_id,
      m.material_name,
      m.image_text,
      m.is_shared,
      m.created_at,
      m.updated_at,
      c.category_name
    FROM materials m
    LEFT JOIN categories c
      ON m.category_id = c.category_id
    WHERE m.material_id = ?
    LIMIT 1
    `,
    [materialId]
  );

  return rows[0] || null;
}

// 問題セット作成
async function createQuestionList(materialId, userId, categoryId, materialName, imageText) {
  await pool.query(
    `
    INSERT INTO materials (
      material_id,
      user_id,
      category_id,
      material_name,
      image_text,
      is_shared
    )
    VALUES (?, ?, ?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      category_id = VALUES(category_id),
      material_name = VALUES(material_name),
      image_text = VALUES(image_text),
      updated_at = NOW()
    `,
    [
      materialId,
      userId,
      categoryId || null,
      materialName || "生成された問題セット",
      imageText || null
    ]
  );

  return findQuestionListById(materialId);
}

// 問題セットの公開状態更新
async function updateQuestionListShare(materialId, shared) {
  await pool.query(
    `
    UPDATE materials
    SET
      is_shared = ?,
      updated_at = NOW()
    WHERE material_id = ?
    `,
    [
      shared ? 1 : 0,
      materialId
    ]
  );

  return findQuestionListById(materialId);
}

// ==================================================
// 問題 question
// ==================================================

// 問題セットに紐づく問題を全件取得
async function findQuestionsByListId(materialId) {
  const [rows] = await pool.query(
    `
    SELECT
      question_id
    FROM question
    WHERE material_id = ?
    ORDER BY created_at ASC, question_id ASC
    `,
    [materialId]
  );

  const questions = await Promise.all(
    rows.map(row => getQuestionWithChoices(row.question_id))
  );

  return questions.filter(Boolean);
}

// 問題1件取得
async function findQuestionById(questionId) {
  return getQuestionWithChoices(questionId);
}

// 問題 + 選択肢を追加
async function createQuestion(questionId, materialId, body) {
  const input = normalizeQuestionBody(body);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      INSERT INTO question (
        question_id,
        material_id,
        question_text,
        explanation
      )
      VALUES (?, ?, ?, ?)
      `,
      [
        questionId,
        materialId,
        input.text,
        input.explanation || null
      ]
    );

    for (let i = 0; i < input.choices.length; i++) {
      await conn.query(
        `
        INSERT INTO question_choices (
          choice_id,
          question_id,
          choice_label,
          choice_text,
          is_correct
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          randomUUID(),
          questionId,
          correctIndexToLabel(i),
          input.choices[i],
          i === input.correct ? 1 : 0
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

// 問題更新
async function updateQuestion(questionId, body) {
  const input = normalizeQuestionBody(body);

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      UPDATE question
      SET
        question_text = ?,
        explanation = ?,
        updated_at = NOW()
      WHERE question_id = ?
      `,
      [
        input.text,
        input.explanation || null,
        questionId
      ]
    );

    await conn.query(
      `
      DELETE FROM question_choices
      WHERE question_id = ?
      `,
      [questionId]
    );

    for (let i = 0; i < input.choices.length; i++) {
      await conn.query(
        `
        INSERT INTO question_choices (
          choice_id,
          question_id,
          choice_label,
          choice_text,
          is_correct
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          randomUUID(),
          questionId,
          correctIndexToLabel(i),
          input.choices[i],
          i === input.correct ? 1 : 0
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

// 問題削除
async function deleteQuestion(questionId) {
  await pool.query(
    `
    DELETE FROM question
    WHERE question_id = ?
    `,
    [questionId]
  );
}

module.exports = {
  pool,

  // 他Repositoryから使う用
  query: (...args) => pool.query(...args),
  getConnection: () => pool.getConnection(),

  // 問題セット
  getAllQuestionLists,
  findQuestionListById,
  createQuestionList,
  updateQuestionListShare,

  // 問題
  findQuestionsByListId,
  findQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion
};