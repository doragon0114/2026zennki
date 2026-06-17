const db = require("../DB/dbRoutes");

async function buildStudyData() {
  const lists = await db.getAllQuestionLists();

  const materials = await Promise.all(
    lists.map(async (list) => {
      const questions = await db.findQuestionsByListId(list.material_id);
      return {
        id:            list.material_id,
        name:          list.material_name,
        category:      list.category_id,
        questionCount: questions.length,
        shared:        list.is_shared === 1,
        type:          "file",
        createdAt:     list.created_at,
      };
    })
  );

  const questionArrays = await Promise.all(
    lists.map(async (list) => {
      const qs = await db.findQuestionsByListId(list.material_id);
      return qs.map((q) => ({
        id:          q.question_id,
        materialId:  q.material_id,
        text:        q.question_text,
        choices:     q.choices,
        correct:     q.correct,
        explanation: q.explanation || "",
        category:    list.category_id,
        tags:        [],
      }));
    })
  );

  return {
    materials,
    questions: questionArrays.flat(),
  };
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
    id:          q.question_id,
    materialId:  q.material_id,
    text:        q.question_text,
    choices:     q.choices,
    correct:     q.correct,
    explanation: q.explanation || "",
    tags:        [],
  };
}

async function getQuestionsByIds(questionIds) {
  const results = await Promise.all(questionIds.map(id => getQuestionById(id)));
  return results.filter(Boolean);
}

async function saveStudyResult(result) {
  // TODO: results テーブルへの保存は後で実装
  console.log("学習結果:", result);
  return result;
}

module.exports = {
  getStudyData,
  getMaterials,
  getQuestions,
  getQuestionById,
  getQuestionsByIds,
  saveStudyResult,
};