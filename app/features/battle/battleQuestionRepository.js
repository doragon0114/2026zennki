const db = require("../DB/dbRoutes");

const BATTLE_QUESTION_COUNT = 5;

const BATTLE_SUBJECTS = {
  japanese: "国語",
  math: "数学",
  english: "英語",
  science: "理科",
  social: "社会"
};

function getSubjectLabel(subject) {
  return BATTLE_SUBJECTS[subject] || null;
}

function labelToIndex(label) {
  const labels = ["A", "B", "C", "D"];
  const index = labels.indexOf(String(label || "").toUpperCase());

  return index >= 0 ? index : 0;
}

function normalizeUserIds(userIds) {
  return [...new Set(
    (Array.isArray(userIds) ? userIds : [])
      .map(userId => String(userId || "").trim())
      .filter(Boolean)
  )];
}

async function countBattleQuestionsByUser({ subject, userId }) {
  const subjectLabel = getSubjectLabel(subject);

  if (!subjectLabel || !userId) {
    return 0;
  }

  const [rows] = await db.query(
    `
    SELECT
      COUNT(*) AS question_count
    FROM (
      SELECT
        q.question_id
      FROM question q
      INNER JOIN materials m
        ON q.material_id = m.material_id
      INNER JOIN categories c
        ON m.category_id = c.category_id
      INNER JOIN question_choices qc
        ON q.question_id = qc.question_id
      WHERE
        c.category_name = ?
        AND m.user_id = ?
      GROUP BY
        q.question_id
      HAVING
        COUNT(qc.choice_id) >= 4
        AND SUM(CASE WHEN qc.is_correct = 1 THEN 1 ELSE 0 END) >= 1
    ) valid_questions
    `,
    [
      subjectLabel,
      userId
    ]
  );

  return Number(rows[0]?.question_count || 0);
}

async function countBattleQuestionsByUsers({ subject, userIds }) {
  const ids = normalizeUserIds(userIds);
  const subjectLabel = getSubjectLabel(subject);

  if (!subjectLabel || ids.length === 0) {
    return 0;
  }

  const placeholders = ids.map(() => "?").join(",");

  const [rows] = await db.query(
    `
    SELECT
      COUNT(*) AS question_count
    FROM (
      SELECT
        q.question_id
      FROM question q
      INNER JOIN materials m
        ON q.material_id = m.material_id
      INNER JOIN categories c
        ON m.category_id = c.category_id
      INNER JOIN question_choices qc
        ON q.question_id = qc.question_id
      WHERE
        c.category_name = ?
        AND m.user_id IN (${placeholders})
      GROUP BY
        q.question_id
      HAVING
        COUNT(qc.choice_id) >= 4
        AND SUM(CASE WHEN qc.is_correct = 1 THEN 1 ELSE 0 END) >= 1
    ) valid_questions
    `,
    [
      subjectLabel,
      ...ids
    ]
  );

  return Number(rows[0]?.question_count || 0);
}

async function fetchRandomQuestionRows({ subject, userIds }) {
  const ids = normalizeUserIds(userIds);
  const subjectLabel = getSubjectLabel(subject);

  if (!subjectLabel || ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(",");

  const [rows] = await db.query(
    `
    SELECT
      q.question_id AS id,
      q.question_text AS text,
      q.explanation AS explanation,
      q.material_id AS materialId,
      m.user_id AS ownerUserId,
      c.category_id AS categoryId,
      c.category_name AS categoryName
    FROM question q
    INNER JOIN materials m
      ON q.material_id = m.material_id
    INNER JOIN categories c
      ON m.category_id = c.category_id
    INNER JOIN question_choices qc
      ON q.question_id = qc.question_id
    WHERE
      c.category_name = ?
      AND m.user_id IN (${placeholders})
    GROUP BY
      q.question_id,
      q.question_text,
      q.explanation,
      q.material_id,
      m.user_id,
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
      ...ids,
      BATTLE_QUESTION_COUNT
    ]
  );

  return rows;
}

async function fetchChoicesByQuestionIds(questionIds) {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    return [];
  }

  const placeholders = questionIds.map(() => "?").join(",");

  const [rows] = await db.query(
    `
    SELECT
      choice_id AS choiceId,
      question_id AS questionId,
      choice_label AS choiceLabel,
      choice_text AS choiceText,
      is_correct AS isCorrect
    FROM question_choices
    WHERE question_id IN (${placeholders})
    ORDER BY
      question_id ASC,
      FIELD(choice_label, 'A', 'B', 'C', 'D'),
      choice_label ASC,
      choice_id ASC
    `,
    questionIds
  );

  return rows;
}

async function canUserBattleSubject({ subject, userId }) {
  const count = await countBattleQuestionsByUser({
    subject,
    userId
  });

  return {
    ok: count > 0,
    count,
    subjectLabel: getSubjectLabel(subject)
  };
}

async function buildBattleQuestionsForPlayers({ subject, playerAUserId, playerBUserId }) {
  const subjectLabel = getSubjectLabel(subject);

  if (!subjectLabel) {
    return {
      ok: false,
      reason: "invalid_subject",
      message: "教科が正しくありません。",
      questions: []
    };
  }

  const playerACount = await countBattleQuestionsByUser({
    subject,
    userId: playerAUserId
  });

  if (playerACount <= 0) {
    return {
      ok: false,
      reason: "player_a_no_questions",
      message: `プレイヤーAが${subjectLabel}の問題を持っていないため、対戦できません。`,
      questions: []
    };
  }

  const playerBCount = await countBattleQuestionsByUser({
    subject,
    userId: playerBUserId
  });

  if (playerBCount <= 0) {
    return {
      ok: false,
      reason: "player_b_no_questions",
      message: `プレイヤーBが${subjectLabel}の問題を持っていないため、対戦できません。`,
      questions: []
    };
  }

  const totalCount = await countBattleQuestionsByUsers({
    subject,
    userIds: [
      playerAUserId,
      playerBUserId
    ]
  });

  if (totalCount < BATTLE_QUESTION_COUNT) {
    return {
      ok: false,
      reason: "not_enough_total_questions",
      message: `${subjectLabel}の問題が2人合わせて${BATTLE_QUESTION_COUNT}問未満のため、対戦できません。`,
      questions: []
    };
  }

  const questionRows = await fetchRandomQuestionRows({
    subject,
    userIds: [
      playerAUserId,
      playerBUserId
    ]
  });

  if (questionRows.length < BATTLE_QUESTION_COUNT) {
    return {
      ok: false,
      reason: "not_enough_random_questions",
      message: `${subjectLabel}の対戦用問題が不足しています。`,
      questions: []
    };
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
      ownerUserId: question.ownerUserId,
      categoryId: question.categoryId,
      subject,
      subjectLabel,
      categoryName: question.categoryName,
      text: question.text,
      choices: firstFourChoices.map(choice => choice.choiceText),
      correct: labelToIndex(correctChoice.choiceLabel),
      explanation: question.explanation || ""
    });
  }

  if (questions.length < BATTLE_QUESTION_COUNT) {
    return {
      ok: false,
      reason: "not_enough_valid_questions",
      message: `${subjectLabel}の有効な対戦用問題が不足しています。`,
      questions: []
    };
  }

  return {
    ok: true,
    reason: "ok",
    message: "",
    questions: questions.slice(0, BATTLE_QUESTION_COUNT)
  };
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
  canUserBattleSubject,
  buildBattleQuestionsForPlayers,
  toPublicQuestion
};