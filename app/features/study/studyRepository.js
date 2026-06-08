const db = require("../DB/dbRoutes");

async function buildStudyData() {
  const lists = await db.getAllQuestionLists();

  const materials = await Promise.all(
    lists.map(async (list) => {
      const questions = await db.findQuestionsByListId(list.QLIST_ID);
      return {
        id: list.QLIST_ID,
        name: `問題セット ${list.QLIST_ID}`,
        category: list.CATEGORY_ID,
        questionCount: questions.length,
        shared: false,
        type: "file",
        createdAt: new Date().toISOString(),
      };
    })
  );

  const questionArrays = await Promise.all(
    lists.map(async (list) => {
      const qs = await db.findQuestionsByListId(list.QLIST_ID);
      return qs.map((q) => ({
        id: q.QID,
        materialId: q.QLIST_ID,
        text: q.QUESTION,
        choices: [q.ANSWER, q.MISS_ONE, q.MISS_TWO, q.MISS_THREE],
        correct: 0,
        explanation: q.EXPLAIN || "",
        category: list.CATEGORY_ID,
        tags: [],
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
    id: q.QID,
    materialId: q.QLIST_ID,
    text: q.QUESTION,
    choices: [q.ANSWER, q.MISS_ONE, q.MISS_TWO, q.MISS_THREE],
    correct: 0,
    explanation: q.EXPLAIN || "",
    tags: [],
  };
}

async function getQuestionsByIds(questionIds) {
  const results = await Promise.all(questionIds.map(id => getQuestionById(id)));
  return results.filter(Boolean);
}

async function saveStudyResult(result) {
  // TODO: ANSWERLISTテーブルへの保存は後で実装
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