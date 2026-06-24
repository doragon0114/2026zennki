const crypto = require("crypto");
const db = require("../DB/dbRoutes");

// ==================================================
// 共通ヘルパー
// ==================================================
function createId(prefix, byteLength = 6) {
  return `${prefix}_${crypto.randomBytes(byteLength).toString("hex")}`;
}

function correctIndexToLabel(index) {
  const labels = ["A", "B", "C", "D"];
  return labels[Number(index)] || "A";
}

function labelToIndex(label) {
  const labels = ["A", "B", "C", "D"];
  const index = labels.indexOf(
    String(label || "").toUpperCase()
  );

  return index >= 0 ? index : 0;
}

function toMysqlDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toFrontMaterial(
  list,
  questionCount = 0
) {
  return {
    id: list.material_id,
    userId: list.user_id,
    name: list.material_name,

    category:
      list.category_name ||
      list.category_id ||
      "未分類",

    categoryId:
      list.category_id === null ||
      list.category_id === undefined
        ? null
        : Number(list.category_id),

    questionCount,

    shared:
      Number(list.is_shared) === 1,

    type: "file",

    createdAt:
      list.created_at || null,

    updatedAt:
      list.updated_at || null
  };
}

function toFrontQuestion(
  question,
  material = null
) {
  return {
    id: question.question_id,

    materialId:
      question.material_id,

    text:
      question.question_text,

    choices:
      Array.isArray(question.choices)
        ? question.choices
        : [],

    correct:
      Number.isInteger(question.correct)
        ? question.correct
        : Number(question.correct) || 0,

    explanation:
      question.explanation || "",

    category:
      material?.category_name ||
      material?.category_id ||
      question.category_name ||
      "未分類",

    categoryId:
      material?.category_id === null ||
      material?.category_id === undefined
        ? (
            question.category_id === null ||
            question.category_id === undefined
              ? null
              : Number(question.category_id)
          )
        : Number(material.category_id),

    tags:
      Array.isArray(question.tags)
        ? question.tags
        : [],

    createdAt:
      question.created_at || null,

    updatedAt:
      question.updated_at || null
  };
}

// ==================================================
// feature/DB側
// 全ユーザー分の問題セット + 問題一覧
// ==================================================
async function buildStudyData() {
  const lists =
    await db.getAllQuestionLists();

  const listData =
    await Promise.all(
      lists.map(async list => {
        const questions =
          await db.findQuestionsByListId(
            list.material_id
          );

        return {
          list,
          questions
        };
      })
    );

  const materials =
    listData.map(
      ({ list, questions }) => {
        return toFrontMaterial(
          list,
          questions.length
        );
      }
    );

  const questions =
    listData.flatMap(
      ({
        list,
        questions: listQuestions
      }) => {
        return listQuestions.map(
          question => {
            return toFrontQuestion(
              question,
              list
            );
          }
        );
      }
    );

  return {
    materials,
    questions
  };
}

// ==================================================
// 旧studyService.jsとの互換用
// ==================================================
async function getStudyData() {
  return await buildStudyData();
}

async function getMaterials() {
  const data =
    await buildStudyData();

  return data.materials;
}

async function getQuestions() {
  const data =
    await buildStudyData();

  return data.questions;
}

// ==================================================
// develop側
// ログイン中ユーザーの問題セット + 問題一覧
// ==================================================
async function getStudyDataByUserId(
  userId
) {
  const id = String(
    userId || ""
  ).trim();

  if (!id) {
    return {
      materials: [],
      questions: [],
      categories: ["すべて"]
    };
  }

  const [materialRows] =
    await db.query(
      `
      SELECT
        m.material_id,
        m.user_id,
        m.category_id,
        m.material_name,
        m.image_text,
        m.is_shared,
        m.created_at,
        m.updated_at,
        c.category_name
      FROM materials m
      LEFT JOIN categories c
        ON m.category_id = c.category_id
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC
      `,
      [id]
    );

  if (materialRows.length === 0) {
    return {
      materials: [],
      questions: [],
      categories: ["すべて"]
    };
  }

  const materialIds =
    materialRows.map(row => {
      return row.material_id;
    });

  const placeholders =
    materialIds
      .map(() => "?")
      .join(",");

  const [questionRows] =
    await db.query(
      `
      SELECT
        q.question_id,
        q.material_id,
        q.question_text,
        q.explanation,
        q.created_at,
        q.updated_at,
        m.category_id,
        c.category_name
      FROM question q
      INNER JOIN materials m
        ON q.material_id = m.material_id
      LEFT JOIN categories c
        ON m.category_id = c.category_id
      WHERE q.material_id IN (${placeholders})
      ORDER BY
        q.created_at ASC,
        q.question_id ASC
      `,
      materialIds
    );

  const questionIds =
    questionRows.map(row => {
      return row.question_id;
    });

  let choiceRows = [];

  if (questionIds.length > 0) {
    const choicePlaceholders =
      questionIds
        .map(() => "?")
        .join(",");

    const [rows] =
      await db.query(
        `
        SELECT
          choice_id,
          question_id,
          choice_label,
          choice_text,
          is_correct
        FROM question_choices
        WHERE question_id IN (${choicePlaceholders})
        ORDER BY
          question_id ASC,
          FIELD(
            choice_label,
            'A',
            'B',
            'C',
            'D'
          ),
          choice_label ASC
        `,
        questionIds
      );

    choiceRows = rows;
  }

  const choiceMap = new Map();

  for (const choice of choiceRows) {
    if (
      !choiceMap.has(
        choice.question_id
      )
    ) {
      choiceMap.set(
        choice.question_id,
        []
      );
    }

    choiceMap
      .get(choice.question_id)
      .push(choice);
  }

  const questions =
    questionRows
      .map(row => {
        const choices =
          choiceMap.get(
            row.question_id
          ) || [];

        const correctChoice =
          choices.find(choice => {
            return (
              Number(
                choice.is_correct
              ) === 1
            );
          });

        return {
          id: row.question_id,

          materialId:
            row.material_id,

          text:
            row.question_text,

          choices:
            choices.map(choice => {
              return choice.choice_text;
            }),

          correct:
            correctChoice
              ? labelToIndex(
                  correctChoice.choice_label
                )
              : 0,

          explanation:
            row.explanation || "",

          category:
            row.category_name ||
            "未分類",

          categoryId:
            row.category_id === null ||
            row.category_id === undefined
              ? null
              : Number(row.category_id),

          tags: [],

          createdAt:
            row.created_at,

          updatedAt:
            row.updated_at
        };
      })
      .filter(question => {
        return (
          question.choices.length >= 4
        );
      });

  const questionCountMap =
    new Map();

  for (const question of questions) {
    questionCountMap.set(
      question.materialId,
      Number(
        questionCountMap.get(
          question.materialId
        ) || 0
      ) + 1
    );
  }

  const materials =
    materialRows.map(row => {
      return {
        id: row.material_id,

        userId:
          row.user_id,

        name:
          row.material_name,

        category:
          row.category_name ||
          "未分類",

        categoryId:
          row.category_id === null ||
          row.category_id === undefined
            ? null
            : Number(row.category_id),

        questionCount:
          Number(
            questionCountMap.get(
              row.material_id
            ) || 0
          ),

        shared:
          Number(row.is_shared) === 1,

        type: "file",

        createdAt:
          row.created_at,

        updatedAt:
          row.updated_at
      };
    });

  const categories = [
    "すべて",
    ...new Set(
      questions
        .map(question => {
          return question.category;
        })
        .filter(Boolean)
    )
  ];

  return {
    materials,
    questions,
    categories
  };
}

// ==================================================
// feature/DB側
// 問題単体取得
// ==================================================
async function getQuestionById(
  questionId
) {
  const question =
    await db.findQuestionById(
      questionId
    );

  if (!question) {
    return null;
  }

  return toFrontQuestion(question);
}

async function getQuestionsByIds(
  questionIds
) {
  const ids =
    Array.isArray(questionIds)
      ? questionIds
      : [];

  const results =
    await Promise.all(
      ids.map(id => {
        return getQuestionById(id);
      })
    );

  return results.filter(Boolean);
}

// ==================================================
// 選択肢ID取得
// answers.selected_choice_id に入れるため
// ==================================================
async function findChoiceIdByQuestionIdAndIndex(
  questionId,
  chosenIndex,
  conn = db
) {
  const label =
    correctIndexToLabel(
      chosenIndex
    );

  const [rows] =
    await conn.query(
      `
      SELECT
        choice_id
      FROM question_choices
      WHERE
        question_id = ?
        AND choice_label = ?
      LIMIT 1
      `,
      [
        questionId,
        label
      ]
    );

  return rows[0]?.choice_id || null;
}

// ==================================================
// develop側
// 詳細形式の演習結果保存
//
// results
// answers
// users
// をトランザクションで更新
// ==================================================
async function saveDetailedStudyResult({
  userId,
  answers,
  questions,
  startedAt,
  finishedAt
}) {
  const id = String(
    userId || ""
  ).trim();

  if (!id) {
    throw new Error(
      "ログインユーザーが確認できません"
    );
  }

  const safeAnswers =
    Array.isArray(answers)
      ? answers
      : [];

  const safeQuestions =
    Array.isArray(questions)
      ? questions
      : [];

  if (
    safeAnswers.length === 0 ||
    safeQuestions.length === 0
  ) {
    throw new Error(
      "演習結果が空です"
    );
  }

  const correct =
    safeAnswers.filter(answer => {
      return Boolean(answer.correct);
    }).length;

  const total =
    safeAnswers.length;

  const correctRate =
    total > 0
      ? Math.round(
          (correct / total) * 100
        )
      : 0;

  const gainedPoints =
    correct * 10;

  const firstMaterialId =
    safeQuestions[0]?.materialId ||
    null;

  const resultId =
    createId(
      "study_result",
      8
    );

  const conn =
    await db.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
      INSERT INTO results (
        result_id,
        user_id,
        material_id,
        correct_count,
        total_count,
        correct_rate,
        gained_points,
        started_at,
        finished_at,
        created_at
      )
      VALUES (
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        NOW()
      )
      `,
      [
        resultId,
        id,
        firstMaterialId,
        correct,
        total,
        correctRate,
        gainedPoints,
        toMysqlDate(startedAt),
        toMysqlDate(finishedAt) ||
          new Date()
      ]
    );

    for (
      const answer of safeAnswers
    ) {
      const questionId =
        answer.questionId;

      if (!questionId) {
        continue;
      }

      const selectedChoiceId =
        Number(answer.chosen) >= 0
          ? await findChoiceIdByQuestionIdAndIndex(
              questionId,
              answer.chosen,
              conn
            )
          : null;

      await conn.query(
        `
        INSERT INTO answers (
          answer_id,
          result_id,
          question_id,
          selected_choice_id,
          created_at
        )
        VALUES (?, ?, ?, ?, NOW())
        `,
        [
          createId(
            "answer",
            8
          ),
          resultId,
          questionId,
          selectedChoiceId
        ]
      );
    }

    await conn.query(
      `
      UPDATE users
      SET
        point = point + ?,
        study_count =
          study_count + 1,
        updated_at = NOW()
      WHERE user_id = ?
      `,
      [
        gainedPoints,
        id
      ]
    );

    const [userRows] =
      await conn.query(
        `
        SELECT
          user_id AS userId,
          username,
          point,
          battle_win_count
            AS battleWinCount,
          study_count
            AS studyCount,
          question_count
            AS questionCount
        FROM users
        WHERE user_id = ?
        LIMIT 1
        `,
        [id]
      );

    await conn.commit();

    return {
      id: resultId,
      userId: id,
      materialId:
        firstMaterialId,
      correct,
      total,
      pct: correctRate,
      pointsGained:
        gainedPoints,
      answerCount:
        safeAnswers.length,

      questionIds:
        safeQuestions.map(
          question => {
            return question.id;
          }
        ),

      startedAt:
        startedAt || null,

      finishedAt:
        finishedAt ||
        new Date().toISOString(),

      user:
        userRows[0] || null
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ==================================================
// feature/DB側
// 旧形式の演習結果保存
//
// resultsだけを保存して、
// 旧studyService.jsとの互換性を残す
// ==================================================
async function saveLegacyStudyResult(
  result
) {
  const safeResult =
    result &&
    typeof result === "object"
      ? result
      : {};

  if (!safeResult.userId) {
    /*
     * 旧実装では未ログイン時は
     * DB保存せず、そのまま返していた。
     */
    return safeResult;
  }

  const questionIds =
    Array.isArray(
      safeResult.questionIds
    )
      ? safeResult.questionIds
      : [];

  let materialId =
    safeResult.materialId ||
    null;

  if (
    !materialId &&
    questionIds.length > 0
  ) {
    const question =
      await db.findQuestionById(
        questionIds[0]
      );

    materialId =
      question?.material_id ||
      null;
  }

  const resultId =
    safeResult.id ||
    createId(
      "study_result",
      8
    );

  await db.query(
    `
    INSERT INTO results (
      result_id,
      user_id,
      material_id,
      correct_count,
      total_count,
      correct_rate,
      gained_points,
      started_at,
      finished_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      resultId,
      safeResult.userId,
      materialId,
      Number(
        safeResult.correct || 0
      ),
      Number(
        safeResult.total || 0
      ),
      Number(
        safeResult.pct || 0
      ),
      Number(
        safeResult.pointsGained || 0
      ),
      toMysqlDate(
        safeResult.startedAt
      ),
      toMysqlDate(
        safeResult.finishedAt
      )
    ]
  );

  return {
    ...safeResult,
    id: resultId,
    materialId
  };
}

/**
 * 2つのブランチでは
 * saveStudyResultの引数形式が異なる。
 *
 * answersとquestionsが存在する場合:
 * develop側の詳細保存
 *
 * それ以外:
 * feature/DB側の旧形式保存
 */
async function saveStudyResult(
  payload
) {
  const value =
    payload &&
    typeof payload === "object"
      ? payload
      : {};

  const isDetailedFormat =
    Array.isArray(
      value.answers
    ) &&
    Array.isArray(
      value.questions
    );

  if (isDetailedFormat) {
    return await saveDetailedStudyResult(
      value
    );
  }

  return await saveLegacyStudyResult(
    value
  );
}

// ==================================================
// develop側
// 指定結果で間違えた問題を取得
// ==================================================
async function getWrongQuestionsByResultId({
  userId,
  resultId
}) {
  const id = String(
    userId || ""
  ).trim();

  const rid = String(
    resultId || ""
  ).trim();

  if (!id || !rid) {
    throw new Error(
      "ユーザーIDまたは結果IDがありません"
    );
  }

  const [resultRows] =
    await db.query(
      `
      SELECT
        result_id
      FROM results
      WHERE
        result_id = ?
        AND user_id = ?
      LIMIT 1
      `,
      [
        rid,
        id
      ]
    );

  if (resultRows.length === 0) {
    throw new Error(
      "演習結果が見つかりません"
    );
  }

  const [wrongRows] =
    await db.query(
      `
      SELECT
        a.answer_id,
        a.question_id,
        a.selected_choice_id,
        q.material_id,
        q.question_text,
        q.explanation,
        m.category_id,
        c.category_name,

        correct_choice.choice_id
          AS correct_choice_id,

        correct_choice.choice_label
          AS correct_choice_label

      FROM answers a

      INNER JOIN results r
        ON a.result_id =
          r.result_id

      INNER JOIN question q
        ON a.question_id =
          q.question_id

      INNER JOIN materials m
        ON q.material_id =
          m.material_id

      LEFT JOIN categories c
        ON m.category_id =
          c.category_id

      INNER JOIN question_choices
        correct_choice
        ON
          correct_choice.question_id =
            q.question_id
          AND
          correct_choice.is_correct = 1

      WHERE
        a.result_id = ?
        AND r.user_id = ?
        AND (
          a.selected_choice_id IS NULL
          OR
          a.selected_choice_id
            <> correct_choice.choice_id
        )

      ORDER BY
        a.created_at ASC,
        a.answer_id ASC
      `,
      [
        rid,
        id
      ]
    );

  if (wrongRows.length === 0) {
    return [];
  }

  const questionIds =
    wrongRows.map(row => {
      return row.question_id;
    });

  const placeholders =
    questionIds
      .map(() => "?")
      .join(",");

  const [choiceRows] =
    await db.query(
      `
      SELECT
        choice_id,
        question_id,
        choice_label,
        choice_text,
        is_correct
      FROM question_choices
      WHERE question_id IN (${placeholders})
      ORDER BY
        question_id ASC,
        FIELD(
          choice_label,
          'A',
          'B',
          'C',
          'D'
        ),
        choice_label ASC,
        choice_id ASC
      `,
      questionIds
    );

  const choiceMap = new Map();

  for (const choice of choiceRows) {
    if (
      !choiceMap.has(
        choice.question_id
      )
    ) {
      choiceMap.set(
        choice.question_id,
        []
      );
    }

    choiceMap
      .get(choice.question_id)
      .push(choice);
  }

  return wrongRows
    .map(row => {
      const choices =
        choiceMap.get(
          row.question_id
        ) || [];

      return {
        id:
          row.question_id,

        materialId:
          row.material_id,

        text:
          row.question_text,

        choices:
          choices.map(choice => {
            return choice.choice_text;
          }),

        correct:
          labelToIndex(
            row.correct_choice_label
          ),

        explanation:
          row.explanation || "",

        category:
          row.category_name ||
          "未分類",

        categoryId:
          row.category_id === null ||
          row.category_id === undefined
            ? null
            : Number(
                row.category_id
              ),

        tags: [],

        retryFromResultId:
          rid
      };
    })
    .filter(question => {
      return (
        question.choices.length >= 4
      );
    });
}

// ==================================================
// feature/DB側
// material_idごとの最新正答率を取得
// ==================================================
async function getCorrectRatesByUserId(
  userId
) {
  const id = String(
    userId || ""
  ).trim();

  if (!id) {
    return {};
  }

  const [rows] =
    await db.query(
      `
      SELECT
        material_id,
        correct_rate
      FROM results
      WHERE
        user_id = ?
        AND material_id IS NOT NULL
        AND finished_at = (
          SELECT
            MAX(r2.finished_at)
          FROM results r2
          WHERE
            r2.user_id =
              results.user_id
            AND
            r2.material_id =
              results.material_id
        )
      `,
      [id]
    );

  const map = {};

  for (const row of rows) {
    map[row.material_id] =
      Number(
        row.correct_rate || 0
      );
  }

  return map;
}

module.exports = {
  // feature/DB側
  buildStudyData,
  getStudyData,
  getMaterials,
  getQuestions,
  getQuestionById,
  getQuestionsByIds,
  getCorrectRatesByUserId,

  // develop側
  getStudyDataByUserId,
  getWrongQuestionsByResultId,

  // 両方の形式へ対応
  saveStudyResult
};
