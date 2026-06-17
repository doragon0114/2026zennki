const db = require("../DB/dbRoutes");

const BATTLE_QUESTION_COUNT = 5;

const BATTLE_SUBJECTS = {
  japanese: "国語",
  math: "数学",
  english: "英語",
  science: "理科",
  social: "社会",
  basic_info: "基本情報",
  classical_japanese: "古典",
  general: "一般"
};

function getSubjectLabel(subject) {
  return BATTLE_SUBJECTS[subject] || subject || "未分類";
}

function labelToIndex(label) {
  const labels = ["A", "B", "C", "D"];
  const index = labels.indexOf(String(label || "").toUpperCase());

  return index >= 0 ? index : 0;
}

async function fetchRandomQuestionRows(subject) {
  const subjectLabel = getSubjectLabel(subject);

  const [rows] = await db.query(
    `
    SELECT
      q.question_id AS id,
      q.question_text AS text,
      q.explanation AS explanation,
      q.material_id AS materialId,
      c.category_id AS categoryId,
      c.category_name AS categoryName
    FROM question q
    INNER JOIN materials m
      ON q.material_id = m.material_id
    INNER JOIN categories c
      ON m.category_id = c.category_id
    INNER JOIN question_choices qc
      ON q.question_id = qc.question_id
    WHERE c.category_name = ?
    GROUP BY
      q.question_id,
      q.question_text,
      q.explanation,
      q.material_id,
      c.category_id,
      c.category_name
    HAVING
      COUNT(qc.choice_id) >= 4
      AND SUM(CASE WHEN qc.is_correct = 1 THEN 1 ELSE 0 END) >= 1
    ORDER BY RAND()
    LIMIT ?
    `,
    [
      subjectLabel,
      BATTLE_QUESTION_COUNT
    ]
  );

  return rows;
}

async function fetchChoicesByQuestionIds(questionIds) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return [];
  }

  const [rows] = await db.query(
    `
    SELECT
      choice_id AS choiceId,
      question_id AS questionId,
      choice_label AS choiceLabel,
      choice_text AS choiceText,
      is_correct AS isCorrect
    FROM question_choices
    WHERE question_id IN (?)
    ORDER BY
      question_id ASC,
      FIELD(choice_label, 'A', 'B', 'C', 'D'),
      choice_label ASC,
      choice_id ASC
    `,
    [questionIds]
  );

  return rows;
}

async function buildBattleQuestions(subject) {
  const questionRows = await fetchRandomQuestionRows(subject);

  if (questionRows.length < BATTLE_QUESTION_COUNT) {
    return [];
  }

  const questionIds = questionRows.map(question => question.id);
  const choiceRows = await fetchChoicesByQuestionIds(questionIds);

  const choiceMap = new Map();

  for (const choice of choiceRows) {
    if (!choiceMap.has(choice.questionId)) {
      choiceMap.set(choice.questionId, []);
    }

    choiceMap.get(choice.questionId).push(choice);
  }

  const questions = [];

  for (const question of questionRows) {
    const choices = choiceMap.get(question.id) || [];

    if (choices.length < 4) {
      continue;
    }

    const firstFourChoices = choices.slice(0, 4);

    const correctChoice = firstFourChoices.find(choice => {
      return Number(choice.isCorrect) === 1;
    });

    if (!correctChoice) {
      continue;
    }

    questions.push({
      id: question.id,
      number: questions.length + 1,
      materialId: question.materialId,
      categoryId: question.categoryId,
      subject,
      subjectLabel: getSubjectLabel(subject),
      categoryName: question.categoryName,
      text: question.text,
      choices: firstFourChoices.map(choice => choice.choiceText),
      correct: labelToIndex(correctChoice.choiceLabel),
      explanation: question.explanation || ""
    });
  }

  if (questions.length < BATTLE_QUESTION_COUNT) {
    return [];
  }

  return questions.slice(0, BATTLE_QUESTION_COUNT);
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
  BATTLE_QUESTION_COUNT,
  BATTLE_SUBJECTS,
  getSubjectLabel,
  buildBattleQuestions,
  toPublicQuestion
};