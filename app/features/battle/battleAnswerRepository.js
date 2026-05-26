const {
  answerLists,
  correctIds,
} = require("./battleDatabase");

function createAnswerList({ questionListId, userId }) {
  const answerList = {
    answerListId: `al_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    questionListId,
    userId,
  };

  answerLists.push(answerList);

  return answerList;
}

function findAnswerListById(answerListId) {
  return answerLists.find(answerList => {
    return answerList.answerListId === answerListId;
  }) || null;
}

function recordCorrectId({ answerListId, questionNumber, questionId }) {
  const answerList = findAnswerListById(answerListId);

  if (!answerList) {
    throw new Error("回答リストが見つかりません。");
  }

  const alreadyExists = correctIds.some(correct => {
    return (
      correct.answerListId === answerListId &&
      correct.questionNumber === questionNumber &&
      correct.questionId === questionId
    );
  });

  if (alreadyExists) {
    return null;
  }

  const correctId = {
    answerListId,
    questionNumber,
    questionId,
  };

  correctIds.push(correctId);

  return correctId;
}

function getCorrectIdsByAnswerListId(answerListId) {
  return correctIds.filter(correct => {
    return correct.answerListId === answerListId;
  });
}

function getAnswerLists() {
  return answerLists;
}

function getCorrectIds() {
  return correctIds;
}

module.exports = {
  createAnswerList,
  findAnswerListById,
  recordCorrectId,
  getCorrectIdsByAnswerListId,
  getAnswerLists,
  getCorrectIds,
};