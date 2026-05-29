const fs = require("fs");
const path = require("path");

const studyDataPath = path.join(__dirname, "../../data/studyData.json");

// ==================================================
// 仮DB Repository
// 今は JSON を読み書きする。
// 後で MySQL にする場合は、このファイル内の処理をDB処理へ差し替える。
// ==================================================

function ensureDataFile() {
  const dir = path.dirname(studyDataPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(studyDataPath)) {
    fs.writeFileSync(
      studyDataPath,
      JSON.stringify({ materials: [], questions: [] }, null, 2),
      "utf-8"
    );
  }
}

function readStudyData() {
  ensureDataFile();

  try {
    const data = JSON.parse(fs.readFileSync(studyDataPath, "utf-8"));

    return {
      materials: Array.isArray(data.materials) ? data.materials : [],
      questions: Array.isArray(data.questions) ? data.questions : []
    };
  } catch {
    return {
      materials: [],
      questions: []
    };
  }
}

function writeStudyData(data) {
  ensureDataFile();

  fs.writeFileSync(
    studyDataPath,
    JSON.stringify(
      {
        materials: Array.isArray(data.materials) ? data.materials : [],
        questions: Array.isArray(data.questions) ? data.questions : []
      },
      null,
      2
    ),
    "utf-8"
  );
}

function getAll() {
  return readStudyData();
}

function findMaterialById(materialId) {
  const data = readStudyData();

  return data.materials.find(material => material.id === materialId) || null;
}

function findQuestionsByMaterialId(materialId) {
  const data = readStudyData();

  return data.questions.filter(question => question.materialId === materialId);
}

function updateMaterial(materialId, patch) {
  const data = readStudyData();
  const material = data.materials.find(item => item.id === materialId);

  if (!material) {
    return null;
  }

  Object.assign(material, patch, {
    updatedAt: new Date().toISOString()
  });

  writeStudyData(data);

  return material;
}

function addQuestion(materialId, question) {
  const data = readStudyData();

  const material = data.materials.find(item => item.id === materialId);

  if (!material) {
    return null;
  }

  data.questions.push(question);

  material.questionCount = data.questions.filter(q => q.materialId === materialId).length;
  material.updatedAt = new Date().toISOString();

  writeStudyData(data);

  return question;
}

function updateQuestion(questionId, patch) {
  const data = readStudyData();
  const question = data.questions.find(item => item.id === questionId);

  if (!question) {
    return null;
  }

  Object.assign(question, patch, {
    updatedAt: new Date().toISOString()
  });

  writeStudyData(data);

  return question;
}

function deleteQuestion(questionId) {
  const data = readStudyData();
  const question = data.questions.find(item => item.id === questionId);

  if (!question) {
    return null;
  }

  data.questions = data.questions.filter(item => item.id !== questionId);

  const material = data.materials.find(item => item.id === question.materialId);

  if (material) {
    material.questionCount = data.questions.filter(q => q.materialId === material.id).length;
    material.updatedAt = new Date().toISOString();
  }

  writeStudyData(data);

  return question;
}

module.exports = {
  getAll,
  findMaterialById,
  findQuestionsByMaterialId,
  updateMaterial,
  addQuestion,
  updateQuestion,
  deleteQuestion
};