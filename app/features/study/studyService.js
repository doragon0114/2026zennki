const crypto = require("crypto");

const studyRepository = require("./studyRepository");

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function getBootstrapData() {
  const data = studyRepository.getStudyData();

  const materials = data.materials.map(material => {
    const questionCount = data.questions.filter(question => {
      return question.materialId === material.id;
    }).length;

    return {
      ...material,
      questionCount
    };
  });

  const questions = data.questions.map(question => ({
    id: question.id,
    materialId: question.materialId,
    category: question.category,
    tags: Array.isArray(question.tags) ? question.tags : [],
    text: question.text,
    choices: question.choices,
    correct: question.correct,
    explanation: question.explanation || ""
  }));

  const categories = [
    "すべて",
    ...new Set(questions.map(question => question.category).filter(Boolean))
  ];

  return {
    materials,
    questions,
    categories
  };
}

function saveResult({ userId, answers, questions, startedAt, finishedAt }) {
  const safeAnswers = Array.isArray(answers) ? answers : [];
  const safeQuestions = Array.isArray(questions) ? questions : [];

  const correct = safeAnswers.filter(answer => answer.correct).length;
  const total = safeAnswers.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const pointsGained = correct * 10;

  const result = {
    id: createId("study_result"),
    userId: userId || null,
    correct,
    total,
    pct,
    pointsGained,
    answers: safeAnswers,
    questionIds: safeQuestions.map(question => question.id),
    startedAt: startedAt || null,
    finishedAt: finishedAt || new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  return studyRepository.saveStudyResult(result);
}

module.exports = {
  getBootstrapData,
  saveResult
};