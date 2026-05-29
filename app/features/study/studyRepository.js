const fs = require("fs");
const path = require("path");

const studyDataPath = path.join(__dirname, "../../data/studyData.json");
const studyResultsPath = path.join(__dirname, "../../data/studyResults.json");

// 後でDB化する場合は、このRepositoryの中身をMySQL処理に差し替える
function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getStudyData() {
  return readJson(studyDataPath, {
    materials: [],
    questions: []
  });
}

function getMaterials() {
  return getStudyData().materials;
}

function getQuestions() {
  return getStudyData().questions;
}

function getQuestionById(questionId) {
  return getQuestions().find(question => question.id === questionId) || null;
}

function getQuestionsByIds(questionIds) {
  const questions = getQuestions();

  return questionIds
    .map(id => questions.find(question => question.id === id))
    .filter(Boolean);
}

function getStudyResults() {
  return readJson(studyResultsPath, []);
}

function saveStudyResult(result) {
  const results = getStudyResults();
  results.push(result);
  writeJson(studyResultsPath, results);
  return result;
}

module.exports = {
  getStudyData,
  getMaterials,
  getQuestions,
  getQuestionById,
  getQuestionsByIds,
  getStudyResults,
  saveStudyResult
};