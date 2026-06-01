const crypto = require("crypto");
const materialsRepository = require("./materialsRepository");

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function normalizeMaterial(material, questions) {
  const count = questions.filter(question => question.materialId === material.id).length;

  return {
    ...material,
    questionCount: count
  };
}

function getMaterialsPayload() {
  const data = materialsRepository.getAll();

  const materials = data.materials.map(material => {
    return normalizeMaterial(material, data.questions);
  });

  return {
    materials,
    questions: data.questions
  };
}

function getMaterialDetail(materialId) {
  const material = materialsRepository.findMaterialById(materialId);

  if (!material) {
    return null;
  }

  const questions = materialsRepository.findQuestionsByMaterialId(materialId);

  return {
    material: {
      ...material,
      questionCount: questions.length
    },
    questions
  };
}

function validateQuestionInput(body) {
  const text = String(body.text || "").trim();
  const choices = Array.isArray(body.choices)
    ? body.choices.map(choice => String(choice || "").trim())
    : [];

  const correct = Number(body.correct);
  const explanation = String(body.explanation || "").trim();
  const category = String(body.category || "一般").trim() || "一般";
  const tags = Array.isArray(body.tags)
    ? body.tags.map(tag => String(tag || "").trim()).filter(Boolean)
    : [];

  if (!text) {
    return {
      ok: false,
      message: "問題文を入力してください"
    };
  }

  if (choices.length !== 4 || choices.some(choice => !choice)) {
    return {
      ok: false,
      message: "選択肢は4つすべて入力してください"
    };
  }

  if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
    return {
      ok: false,
      message: "正解番号が正しくありません"
    };
  }

  return {
    ok: true,
    question: {
      text,
      choices,
      correct,
      explanation,
      category,
      tags
    }
  };
}

function createQuestion(materialId, body) {
  const validation = validateQuestionInput(body);

  if (!validation.ok) {
    return validation;
  }

  const material = materialsRepository.findMaterialById(materialId);

  if (!material) {
    return {
      ok: false,
      message: "問題セットが見つかりません"
    };
  }

  const question = {
    id: createId("q"),
    materialId,
    ...validation.question,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  materialsRepository.addQuestion(materialId, question);

  return {
    ok: true,
    question,
    payload: getMaterialsPayload()
  };
}

function updateQuestion(materialId, questionId, body) {
  const validation = validateQuestionInput(body);

  if (!validation.ok) {
    return validation;
  }

  const material = materialsRepository.findMaterialById(materialId);

  if (!material) {
    return {
      ok: false,
      message: "問題セットが見つかりません"
    };
  }

  const target = materialsRepository
    .findQuestionsByMaterialId(materialId)
    .find(question => question.id === questionId);

  if (!target) {
    return {
      ok: false,
      message: "問題が見つかりません"
    };
  }

  const question = materialsRepository.updateQuestion(questionId, validation.question);

  return {
    ok: true,
    question,
    payload: getMaterialsPayload()
  };
}

function removeQuestion(materialId, questionId) {
  const target = materialsRepository
    .findQuestionsByMaterialId(materialId)
    .find(question => question.id === questionId);

  if (!target) {
    return {
      ok: false,
      message: "問題が見つかりません"
    };
  }

  materialsRepository.deleteQuestion(questionId);

  return {
    ok: true,
    payload: getMaterialsPayload()
  };
}

function shareMaterial(materialId, shared) {
  const material = materialsRepository.updateMaterial(materialId, {
    shared: Boolean(shared)
  });

  if (!material) {
    return {
      ok: false,
      message: "問題セットが見つかりません"
    };
  }

  return {
    ok: true,
    material,
    payload: getMaterialsPayload()
  };
}

module.exports = {
  getMaterialsPayload,
  getMaterialDetail,
  createQuestion,
  updateQuestion,
  removeQuestion,
  shareMaterial
};