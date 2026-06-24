const crypto = require("crypto");
const db = require("../DB/dbRoutes");

async function buildStudyData() {
  const lists = await db.getAllQuestionLists();

  const listData = await Promise.all(
    lists.map(async (list) => {
      const qs = await db.findQuestionsByListId(list.material_id);
      return { list, qs };
    })
  );

  const materials = listData.map(({ list, qs }) => ({
    id: list.material_id,
    name: list.material_name,
    category: list.category_id,
    questionCount: qs.length,
    shared: list.is_shared === 1,
    type: "file",
    createdAt: list.created_at ? new Date(list.created_at).toISOString() : new Date().toISOString(),
  }));

  const questions = listData.flatMap(({ list, qs }) =>
    qs.map((q) => ({
      id: q.question_id,
      materialId: q.material_id,
      text: q.question_text,
      choices: q.choices,
      correct: q.correct,
      explanation: q.explanation || "",
      category: list.category_id,
      tags: [],
    }))
  );

  return { materials, questions };
}

async function getStudyData() {
  return buildStudyData();
}

async function getMaterials() {
  const data = await buildStudyData();
  return data.materials;
}

async function getQuestions() {
  const data = await buildStudyData();
  return data.questions;
}

async function getQuestionById(questionId) {
  const q = await db.findQuestionById(questionId);
  if (!q) return null;
  return {
    id: q.question_id,
    materialId: q.material_id,
    text: q.question_text,
    choices: q.choices,
    correct: q.correct,
    explanation: q.explanation || "",
    tags: [],
  };
}

async function getQuestionsByIds(questionIds) {
  const results = await Promise.all(questionIds.map(id => getQuestionById(id)));
  return results.filter(Boolean);
}

async function saveStudyResult(result) {
  if (!result.userId) {
    // 未ログイン時はスキップ（user_idがNOT NULLのため）
    return result;
  }

  // questionIdsの最初の問題からmaterial_idを逆引き
  let materialId = null;
  if (Array.isArray(result.questionIds) && result.questionIds.length > 0) {
    const q = await db.findQuestionById(result.questionIds[0]);
    if (q) materialId = q.material_id;
  }

  await db.pool.query(
    `INSERT INTO results
      (result_id, user_id, material_id, correct_count, total_count, correct_rate, gained_points, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.id,
      result.userId,
      materialId,
      result.correct,
      result.total,
      result.pct,
      result.pointsGained,
      result.startedAt ? new Date(result.startedAt) : null,
      result.finishedAt ? new Date(result.finishedAt) : null,
    ]
  );

  return result;
}

// material_idごとの最新正答率を取得（ユーザー別）
async function getCorrectRatesByUserId(userId) {
  const [rows] = await db.pool.query(
    `SELECT material_id, correct_rate
     FROM results
     WHERE user_id = ?
       AND material_id IS NOT NULL
       AND finished_at = (
         SELECT MAX(r2.finished_at)
         FROM results r2
         WHERE r2.user_id = results.user_id
           AND r2.material_id = results.material_id
       )`,
    [userId]
  );
  const map = {};
  for (const row of rows) {
    map[row.material_id] = row.correct_rate;
  }
  return map;
}

module.exports = {
  getStudyData,
  getMaterials,
  getQuestions,
  getQuestionById,
  getQuestionsByIds,
  saveStudyResult,
  getCorrectRatesByUserId,
};