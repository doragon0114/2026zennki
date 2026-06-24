const db = require("../DB/dbRoutes");

/**
 * 共通DBモジュールが管理している接続プールから
 * トランザクション用コネクションを取得する。
 */
function getConnection() {
  return db.getConnection();
}

/**
 * 所有者本人の問題セットを取得してロックする。
 */
async function findOwnedMaterialForUpdate(
  conn,
  materialId,
  userId
) {
  const [rows] = await conn.query(
    `
    SELECT
      material_id,
      user_id,
      category_id,
      material_name,
      image_text,
      is_shared
    FROM materials
    WHERE
      material_id = ?
      AND user_id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [
      materialId,
      userId
    ]
  );

  return rows[0] || null;
}

/**
 * 問題セットをIDで取得してロックする。
 */
async function findMaterialByIdForUpdate(
  conn,
  materialId
) {
  const [rows] = await conn.query(
    `
    SELECT
      material_id,
      user_id,
      category_id,
      material_name,
      image_text,
      is_shared
    FROM materials
    WHERE material_id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [materialId]
  );

  return rows[0] || null;
}

/**
 * 問題セットの公開状態を更新する。
 */
async function updateMaterialShareStatus(
  conn,
  materialId,
  userId,
  shared
) {
  const [result] = await conn.query(
    `
    UPDATE materials
    SET
      is_shared = ?,
      updated_at = NOW()
    WHERE
      material_id = ?
      AND user_id = ?
    `,
    [
      shared ? 1 : 0,
      materialId,
      userId
    ]
  );

  return result.affectedRows === 1;
}

/**
 * 問題セットに紐づく共有コードを取得する。
 */
async function findShareCodeByMaterialId(
  conn,
  materialId
) {
  const [rows] = await conn.query(
    `
    SELECT
      material_id,
      share_code,
      created_at
    FROM material_share_codes
    WHERE material_id = ?
    LIMIT 1
    `,
    [materialId]
  );

  return rows[0] || null;
}

/**
 * コードから共有情報を取得する。
 */
async function findShareCodeByCode(
  conn,
  shareCode
) {
  const [rows] = await conn.query(
    `
    SELECT
      material_id,
      share_code,
      created_at
    FROM material_share_codes
    WHERE share_code = ?
    LIMIT 1
    `,
    [shareCode]
  );

  return rows[0] || null;
}

/**
 * コードと問題セットIDが一致する共有行をロックする。
 */
async function findShareCodeByCodeForUpdate(
  conn,
  shareCode,
  materialId
) {
  const [rows] = await conn.query(
    `
    SELECT
      material_id,
      share_code,
      created_at
    FROM material_share_codes
    WHERE
      share_code = ?
      AND material_id = ?
    LIMIT 1
    FOR UPDATE
    `,
    [
      shareCode,
      materialId
    ]
  );

  return rows[0] || null;
}

/**
 * 共有コードを登録する。
 */
async function insertShareCode(
  conn,
  materialId,
  shareCode
) {
  await conn.query(
    `
    INSERT INTO material_share_codes (
      material_id,
      share_code
    )
    VALUES (?, ?)
    `,
    [
      materialId,
      shareCode
    ]
  );
}

/**
 * 問題セットに紐づく共有コードを削除する。
 */
async function deleteShareCodeByMaterialId(
  conn,
  materialId
) {
  await conn.query(
    `
    DELETE FROM material_share_codes
    WHERE material_id = ?
    `,
    [materialId]
  );
}

/**
 * 受取ユーザーが存在するか確認する。
 */
async function findUserById(
  conn,
  userId
) {
  const [rows] = await conn.query(
    `
    SELECT
      user_id
    FROM users
    WHERE user_id = ?
    LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
}

/**
 * 問題セット内の問題を取得する。
 */
async function findQuestionsByMaterialId(
  conn,
  materialId
) {
  const [rows] = await conn.query(
    `
    SELECT
      question_id,
      question_text,
      explanation
    FROM question
    WHERE material_id = ?
    ORDER BY
      created_at ASC,
      question_id ASC
    `,
    [materialId]
  );

  return rows;
}

/**
 * 複数問題の選択肢をまとめて取得する。
 */
async function findChoicesByQuestionIds(
  conn,
  questionIds
) {
  if (
    !Array.isArray(questionIds) ||
    questionIds.length === 0
  ) {
    return [];
  }

  const placeholders = questionIds
    .map(() => "?")
    .join(",");

  const [rows] = await conn.query(
    `
    SELECT
      question_id,
      choice_label,
      choice_text,
      is_correct
    FROM question_choices
    WHERE question_id IN (${placeholders})
    ORDER BY
      question_id ASC,
      FIELD(
        choice_label,
        'A',
        'B',
        'C',
        'D'
      ),
      choice_label ASC
    `,
    questionIds
  );

  return rows;
}

/**
 * 受取人用の問題セットを登録する。
 * 受け取った直後は非公開にする。
 */
async function insertCopiedMaterial(
  conn,
  {
    materialId,
    userId,
    categoryId,
    materialName,
    imageText
  }
) {
  await conn.query(
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
    `,
    [
      materialId,
      userId,
      categoryId,
      materialName,
      imageText || null
    ]
  );
}

/**
 * コピーした問題を登録する。
 */
async function insertCopiedQuestion(
  conn,
  {
    questionId,
    materialId,
    questionText,
    explanation
  }
) {
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
      questionText,
      explanation || null
    ]
  );
}

/**
 * コピーした選択肢を登録する。
 */
async function insertCopiedChoice(
  conn,
  {
    choiceId,
    questionId,
    choiceLabel,
    choiceText,
    isCorrect
  }
) {
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
      choiceId,
      questionId,
      choiceLabel,
      choiceText,
      isCorrect ? 1 : 0
    ]
  );
}

/**
 * 元問題に付いているタグをコピーする。
 */
async function copyQuestionTags(
  conn,
  sourceQuestionId,
  newQuestionId
) {
  await conn.query(
    `
    INSERT IGNORE INTO question_question_tags (
      question_id,
      question_tag_id
    )
    SELECT
      ?,
      question_tag_id
    FROM question_question_tags
    WHERE question_id = ?
    `,
    [
      newQuestionId,
      sourceQuestionId
    ]
  );
}

/**
 * users.question_countを実際の所有問題数に合わせる。
 */
async function recalculateUserQuestionCount(
  conn,
  userId
) {
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
      userId,
      userId
    ]
  );
}

module.exports = {
  getConnection,

  findOwnedMaterialForUpdate,
  findMaterialByIdForUpdate,
  updateMaterialShareStatus,

  findShareCodeByMaterialId,
  findShareCodeByCode,
  findShareCodeByCodeForUpdate,
  insertShareCode,
  deleteShareCodeByMaterialId,

  findUserById,

  findQuestionsByMaterialId,
  findChoicesByQuestionIds,

  insertCopiedMaterial,
  insertCopiedQuestion,
  insertCopiedChoice,
  copyQuestionTags,

  recalculateUserQuestionCount
};