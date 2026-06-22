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

function toNullableCategoryId(categoryId) {
  if (categoryId === undefined || categoryId === null || categoryId === "") {
    return null;
  }

  const value = Number(categoryId);

  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
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
// categories
// category_id は INT UNSIGNED AUTO_INCREMENT 前提
// ==================================================

async function getAllCategories() {
  const [rows] = await pool.query(
    `
    SELECT
      category_id,
      category_name,
      created_at
    FROM categories
    ORDER BY category_id ASC
    `
  );

  return rows;
}

async function findCategoryById(categoryId) {
  const id = toNullableCategoryId(categoryId);

  if (!id) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT
      category_id,
      category_name,
      created_at
    FROM categories
    WHERE category_id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function findCategoryByName(categoryName) {
  const name = String(categoryName || "").trim();

  if (!name) {
    return null;
  }

  const [rows] = await pool.query(
    `
    SELECT
      category_id,
      category_name,
      created_at
    FROM categories
    WHERE category_name = ?
    LIMIT 1
    `,
    [name]
  );

  return rows[0] || null;
}

async function createCategory(categoryName) {
  const name = String(categoryName || "").trim();

  if (!name) {
    return null;
  }

  const existing = await findCategoryByName(name);

  if (existing) {
    return existing;
  }

  try {
    const [result] = await pool.query(
      `
      INSERT INTO categories (
        category_name
      )
      VALUES (?)
      `,
      [name]
    );

    return await findCategoryById(result.insertId);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return await findCategoryByName(name);
    }

    throw err;
  }
}

async function findOrCreateCategoryByName(categoryName) {
  const name = String(categoryName || "").trim();

  if (!name) {
    return null;
  }

  const existing = await findCategoryByName(name);

  if (existing) {
    return existing;
  }

  return await createCategory(name);
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
// materials.category_id は INT UNSIGNED NULL 前提
// ==================================================

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

async function getQuestionListsByUserId(userId) {
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
    WHERE m.user_id = ?
    ORDER BY m.created_at DESC
    `,
    [userId]
  );

  return rows;
}

async function findQuestionListByIdAndUserId(materialId, userId) {
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
    WHERE
      m.material_id = ?
      AND m.user_id = ?
    LIMIT 1
    `,
    [materialId, userId]
  );

  return rows[0] || null;
}

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

async function createQuestionList(materialId, userId, categoryId, materialName, imageText) {
  const finalCategoryId = toNullableCategoryId(categoryId);

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
      finalCategoryId,
      materialName || "生成された問題セット",
      imageText || null
    ]
  );

  return await findQuestionListById(materialId);
}

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

  return await findQuestionListById(materialId);
}

// materialsRoutes.js 側で古い名前を呼んでも落ちないように残す
async function updateMaterialShare(materialId, shared) {
  return await updateQuestionListShare(materialId, shared);
}

// ==================================================
// 問題 question
// ==================================================

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

async function findQuestionById(questionId) {
  return await getQuestionWithChoices(questionId);
}

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

    const ownerUserId = await getMaterialOwnerUserId(materialId, conn);

    if (ownerUserId) {
      await addUserQuestionCount(ownerUserId, 1, conn);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return await findQuestionById(questionId);
}

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

  return await findQuestionById(questionId);
}

async function addUserQuestionCount(userId, amount = 1, conn = pool) {
  const id = String(userId || "").trim();
  const value = Number(amount || 0);

  if (!id || !Number.isInteger(value) || value === 0) {
    return null;
  }

  if (value > 0) {
    await conn.query(
      `
      UPDATE users
      SET
        question_count = question_count + ?,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [
        value,
        id
      ]
    );
  } else {
    await conn.query(
      `
      UPDATE users
      SET
        question_count =
          CASE
            WHEN question_count >= ? THEN question_count - ?
            ELSE 0
          END,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [
        Math.abs(value),
        Math.abs(value),
        id
      ]
    );
  }

  return true;
}

async function getMaterialOwnerUserId(materialId, conn = pool) {
  const [rows] = await conn.query(
    `
    SELECT
      user_id
    FROM materials
    WHERE material_id = ?
    LIMIT 1
    `,
    [materialId]
  );

  return rows[0]?.user_id || null;
}

async function addUserBattleWinStats(userId, point = 30) {
  const id = String(userId || "").trim();

  if (!id) {
    return null;
  }

  await pool.query(
    `
    UPDATE users
    SET
      point = point + ?,
      battle_win_count = battle_win_count + 1,
      study_count = study_count + 1,
      updated_at = NOW()
    WHERE user_id = ?
    `,
    [
      Number(point || 0),
      id
    ]
  );

  const [rows] = await pool.query(
    `
    SELECT
      user_id,
      username,
      point,
      battle_win_count,
      study_count,
      question_count
    FROM users
    WHERE user_id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function deleteQuestion(questionId) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `
      SELECT
        q.question_id,
        q.material_id,
        m.user_id
      FROM question q
      INNER JOIN materials m
        ON q.material_id = m.material_id
      WHERE q.question_id = ?
      LIMIT 1
      `,
      [questionId]
    );

    const target = rows[0];

    if (!target) {
      await conn.rollback();
      return null;
    }

    await conn.query(
      `
      DELETE FROM question
      WHERE question_id = ?
      `,
      [questionId]
    );

    if (target.user_id) {
      await addUserQuestionCount(target.user_id, -1, conn);
    }

    await conn.commit();

    return target;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ==================================================
// 問題セット削除
// materials を削除すると、外部キーのCASCADEにより
// question / question_choices なども削除される
// ==================================================
async function deleteQuestionListByUserId(materialId, userId) {
  const safeMaterialId = String(materialId || "").trim();
  const safeUserId = String(userId || "").trim();

  if (!safeMaterialId || !safeUserId) {
    return null;
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 自分が所有している問題セットか確認して、削除中はロックする
    const [materialRows] = await conn.query(
      `
      SELECT
        material_id,
        user_id,
        material_name
      FROM materials
      WHERE
        material_id = ?
        AND user_id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [
        safeMaterialId,
        safeUserId
      ]
    );

    const material = materialRows[0];

    if (!material) {
      await conn.rollback();
      return null;
    }

    const [countRows] = await conn.query(
      `
      SELECT
        COUNT(*) AS question_count
      FROM question
      WHERE material_id = ?
      `,
      [safeMaterialId]
    );

    const deletedQuestionCount =
      Number(countRows[0]?.question_count || 0);

    /*
     * materials を削除する。
     *
     * 現在の外部キー設定では、
     * question は ON DELETE CASCADE なので自動削除される。
     * question_choices も question 経由で自動削除される。
     */
    const [deleteResult] = await conn.query(
      `
      DELETE FROM materials
      WHERE
        material_id = ?
        AND user_id = ?
      `,
      [
        safeMaterialId,
        safeUserId
      ]
    );

    if (deleteResult.affectedRows !== 1) {
      throw new Error("問題セットを削除できませんでした");
    }

    /*
     * users.question_count をDBの実際の問題数に合わせる。
     * 単純減算より、ずれが起きにくい。
     */
    await conn.query(
      `
      UPDATE users
      SET
        question_count = (
          SELECT COUNT(*)
          FROM question q
          INNER JOIN materials m
            ON q.material_id = m.material_id
          WHERE m.user_id = ?
        ),
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [
        safeUserId,
        safeUserId
      ]
    );

    await conn.commit();

    return {
      materialId: material.material_id,
      userId: material.user_id,
      materialName: material.material_name,
      deletedQuestionCount
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,

  query: (...args) => pool.query(...args),
  getConnection: () => pool.getConnection(),

  // カテゴリ
  getAllCategories,
  findCategoryById,
  findCategoryByName,
  createCategory,
  findOrCreateCategoryByName,

  // 問題セット
  getAllQuestionLists,
  findQuestionListById,
  createQuestionList,
  updateQuestionListShare,
  updateMaterialShare,

  // 問題
  findQuestionsByListId,
  findQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  deleteQuestionListByUserId,

  getQuestionListsByUserId,
  findQuestionListByIdAndUserId,

  addUserQuestionCount,
  getMaterialOwnerUserId,
  addUserBattleWinStats,
};