const studyRepository = require("./studyRepository");

async function getBootstrapData(userId) {
  return await studyRepository.getStudyDataByUserId(userId);
}

async function saveResult({
  userId,
  answers,
  questions,
  startedAt,
  finishedAt
}) {
  return await studyRepository.saveStudyResult({
    userId,
    answers,
    questions,
    startedAt,
    finishedAt
  });
}

async function getWrongQuestions({
  userId,
  resultId
}) {
  return await studyRepository.getWrongQuestionsByResultId({
    userId,
    resultId
  });
}

module.exports = {
  getBootstrapData,
  saveResult,
  getWrongQuestions
};