const {
  categories,
  questionLists,
  questions,
} = require("./battleDatabase");

const SUBJECT_TO_CATEGORY_ID = {
  japanese: "cat_japanese",
  math: "cat_math",
  english: "cat_english",
  science: "cat_science",
  social: "cat_social",
};

const SUBJECTS = Object.entries(SUBJECT_TO_CATEGORY_ID).reduce((result, [subject, categoryId]) => {
  const category = findCategoryById(categoryId);

  if (category) {
    result[subject] = category.categoryName;
  }

  return result;
}, {});

function findCategoryById(categoryId) {
  return categories.find(category => {
    return category.categoryId === categoryId;
  }) || null;
}

function findQuestionListById(questionListId) {
  return questionLists.find(questionList => {
    return questionList.questionListId === questionListId;
  }) || null;
}

function findQuestionListByCategoryId(categoryId) {
  return questionLists.find(questionList => {
    return questionList.categoryId === categoryId;
  }) || null;
}

function findQuestionListBySubject(subject) {
  const categoryId = SUBJECT_TO_CATEGORY_ID[subject];

  if (!categoryId) {
    return null;
  }

  return findQuestionListByCategoryId(categoryId);
}

function getQuestionsByQuestionListId(questionListId) {
  return questions.filter(question => {
    return question.questionListId === questionListId;
  });
}

function findQuestionById(questionId) {
  return questions.find(question => {
    return question.questionId === questionId;
  }) || null;
}

function getBattleQuestionsBySubject(subject) {
  const questionList = findQuestionListBySubject(subject);

  if (!questionList) {
    return [];
  }

  return getQuestionsByQuestionListId(questionList.questionListId);
}

function getPlayerQuestions(player, subject) {
  const baseQuestions = getBattleQuestionsBySubject(subject);

  return baseQuestions.map((question, index) => {
    return {
      id: `${player.id}-${question.questionId}`,
      questionId: question.questionId,
      questionListId: question.questionListId,
      questionNumber: index + 1,
      type: "text",
      text: question.questionText,
      answer: question.answer,
      ownerId: player.id,
      ownerName: player.name,
    };
  });
}

function buildBattleQuestions(playerA, playerB, subject) {
  const playerAQuestions = getPlayerQuestions(playerA, subject);
  const playerBQuestions = getPlayerQuestions(playerB, subject);

  const result = [];
  const maxLength = Math.max(playerAQuestions.length, playerBQuestions.length);

  for (let i = 0; i < maxLength; i += 1) {
    if (playerAQuestions[i]) {
      result.push(playerAQuestions[i]);
    }

    if (playerBQuestions[i]) {
      result.push(playerBQuestions[i]);
    }
  }

  return result;
}

function judgeAnswer(userAnswer, question) {
  return normalizeAnswer(userAnswer) === normalizeAnswer(question.answer);
}

function getCorrectAnswerText(question) {
  return question.answer || "";
}

function normalizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[！-～]/g, char => {
      return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
    });
}

module.exports = {
  SUBJECTS,
  SUBJECT_TO_CATEGORY_ID,
  findCategoryById,
  findQuestionListById,
  findQuestionListByCategoryId,
  findQuestionListBySubject,
  getQuestionsByQuestionListId,
  findQuestionById,
  buildBattleQuestions,
  judgeAnswer,
  getCorrectAnswerText,
};