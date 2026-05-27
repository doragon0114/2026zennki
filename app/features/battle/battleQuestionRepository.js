const {
  BATTLE_SUBJECTS,
  battleQuestions
} = require("./battleDatabase");

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

function getSubjectLabel(subject) {
  return BATTLE_SUBJECTS[subject] || "未分類";
}

function buildBattleQuestions(subject) {
  const questions = battleQuestions.filter(q => q.subject === subject);

  return shuffle(questions)
    .slice(0, 5)
    .map((q, index) => ({
      ...q,
      number: index + 1
    }));
}

function toPublicQuestion(question) {
  return {
    id: question.id,
    number: question.number,
    text: question.text,
    choices: question.choices
  };
}

module.exports = {
  getSubjectLabel,
  buildBattleQuestions,
  toPublicQuestion
};