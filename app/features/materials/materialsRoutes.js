const express = require("express");
const { randomUUID } = require("crypto");
const db = require("../DB/dbRoutes");
const materialShareService =
  require("./materialShareService");

const router = express.Router();

/**
 * リクエストからログインユーザーIDを取得する。
 */
function getRequestUserId(req) {
  return (
    req.session?.userId ||
    req.query.userId ||
    req.body?.userId ||
    req.headers["x-user-id"] ||
    null
  );
}

/**
 * ログインユーザーIDを必須にする。
 */
function requireUserId(req, res) {
  const userId = getRequestUserId(req);

  if (!userId) {
    res.status(401).json({
      ok: false,
      message: "ログインユーザーが確認できません"
    });

    return null;
  }

  return userId;
}

/**
 * MySQLから取得した日付をISO形式へ変換する。
 */
function toIsoStringOrNull(value) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/**
 * 指定ユーザーの問題セットごとの最新正答率を取得する。
 */
async function getCorrectRatesByUserId(userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return {};
  }

  const [rows] = await db.query(
    `
    SELECT
      r.material_id,
      r.correct_rate
    FROM results r
    INNER JOIN (
      SELECT
        material_id,
        MAX(finished_at) AS latest_finished_at
      FROM results
      WHERE
        user_id = ?
        AND material_id IS NOT NULL
      GROUP BY material_id
    ) latest
      ON latest.material_id = r.material_id
      AND latest.latest_finished_at = r.finished_at
    WHERE
      r.user_id = ?
      AND r.material_id IS NOT NULL
    `,
    [
      id,
      id
    ]
  );

  const rates = {};

  for (const row of rows) {
    rates[row.material_id] =
      Number(row.correct_rate || 0);
  }

  return rates;
}

/**
 * DBのmaterialsデータをフロント用へ変換する。
 */
function toFrontMaterial(
  list,
  questionCount = 0,
  correctRate = null
) {
  return {
    id: list.material_id,
    userId: list.user_id,
    name: list.material_name,

    category:
      list.category_name || "未分類",

    categoryId:
      list.category_id === null ||
      list.category_id === undefined
        ? null
        : Number(list.category_id),

    questionCount,

    correctRate:
      correctRate === null ||
      correctRate === undefined
        ? null
        : Number(correctRate),

    shared:
      Number(list.is_shared) === 1,

    type: "file",

    createdAt:
      toIsoStringOrNull(
        list.created_at
      ),

    updatedAt:
      toIsoStringOrNull(
        list.updated_at
      )
  };
}

/**
 * DBのquestionデータをフロント用へ変換する。
 */
function toFrontQuestion(
  question,
  material
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

    // 表示用カテゴリ名
    category:
      material?.category_name ||
      "未分類",

    // DB上のカテゴリID
    categoryId:
      material?.category_id === null ||
      material?.category_id === undefined
        ? null
        : Number(
            material.category_id
          ),

    tags:
      Array.isArray(question.tags)
        ? question.tags
        : [],

    createdAt:
      toIsoStringOrNull(
        question.created_at
      ),

    updatedAt:
      toIsoStringOrNull(
        question.updated_at
      )
  };
}

/**
 * 指定ユーザーが所有する問題セットと問題を
 * フロント用データへ変換して返す。
 */
async function buildPayload(userId) {
  const lists =
    await db.getQuestionListsByUserId(
      userId
    );

  const materialPairs =
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

  const correctRates =
    await getCorrectRatesByUserId(userId);

  const materials =
    materialPairs.map(
      ({ list, questions }) => {
        return toFrontMaterial(
          list,
          questions.length,
          Object.prototype.hasOwnProperty.call(
            correctRates,
            list.material_id
          )
            ? correctRates[list.material_id]
            : null
        );
      }
    );

  const questions =
    materialPairs.flatMap(
      ({ list, questions }) => {
        return questions.map(
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
// GET /api/materials
// 自分の問題セットだけ取得
// ==================================================
router.get("/", async (req, res) => {
  try {
    const userId =
      requireUserId(req, res);

    if (!userId) {
      return;
    }

    const payload =
      await buildPayload(userId);

    res.json({
      ok: true,
      ...payload
    });
  } catch (err) {
    console.error(
      "GET /api/materials error:",
      err
    );

    res.status(500).json({
      ok: false,
      message:
        err.message ||
        "問題セットの取得に失敗しました"
    });
  }
});

// ==================================================
// POST /api/materials/share-codes/redeem
// 公開中の問題セットを共有コードで受け取る
// ==================================================
router.post(
  "/share-codes/redeem",
  async (req, res) => {
    try {
      const userId = requireUserId(req, res);

      if (!userId) {
        return;
      }

      const copiedMaterial =
        await materialShareService.receiveByCode({
          code: req.body.code,
          userId
        });

      const payload = await buildPayload(userId);

      res.json({
        ok: true,
        message:
          "問題セットを受け取りました",
        copiedMaterial,
        ...payload
      });
    } catch (err) {
      console.error(
        "POST /api/materials/share-codes/redeem error:",
        err
      );

      res.status(
        err.statusCode || 500
      ).json({
        ok: false,
        message:
          err.message ||
          "問題セットの受け取りに失敗しました"
      });
    }
  }
);

// ==================================================
// GET /api/materials/:materialId
// 自分の問題セットだけ詳細取得
// ==================================================
router.get(
  "/:materialId",
  async (req, res) => {
    try {
      const userId =
        requireUserId(req, res);

      if (!userId) {
        return;
      }

      const list =
        await db.findQuestionListByIdAndUserId(
          req.params.materialId,
          userId
        );

      if (!list) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、管理権限がありません"
        });
      }

      const questions =
        await db.findQuestionsByListId(
          list.material_id
        );

      res.json({
        ok: true,

        material:
          toFrontMaterial(
            list,
            questions.length
          ),

        questions:
          questions.map(question => {
            return toFrontQuestion(
              question,
              list
            );
          })
      });
    } catch (err) {
      console.error(
        "GET /api/materials/:materialId error:",
        err
      );

      res.status(500).json({
        ok: false,
        message:
          err.message ||
          "問題セット詳細の取得に失敗しました"
      });
    }
  }
);

// ==================================================
// DELETE /api/materials/:materialId
// 自分が所有する問題セットを問題ごと削除
// ==================================================
router.delete(
  "/:materialId",
  async (req, res) => {
    try {
      const userId =
        requireUserId(req, res);

      if (!userId) {
        return;
      }

      const { materialId } =
        req.params;

      /*
       * 所有者本人の問題セットか確認する。
       */
      const list =
        await db.findQuestionListByIdAndUserId(
          materialId,
          userId
        );

      if (!list) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、削除する権限がありません"
        });
      }

      const deleted =
        await db.deleteQuestionListByUserId(
          materialId,
          userId
        );

      if (!deleted) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、すでに削除されています"
        });
      }

      const payload =
        await buildPayload(userId);

      res.json({
        ok: true,
        message:
          "問題セットを削除しました",
        deleted,
        ...payload
      });
    } catch (err) {
      console.error(
        "DELETE /api/materials/:materialId error:",
        err
      );

      res.status(500).json({
        ok: false,
        message:
          err.message ||
          "問題セットの削除に失敗しました"
      });
    }
  }
);

// ==================================================
// PATCH /api/materials/:materialId/share
// 公開・非公開切り替えと共有コードの発行・削除
// ==================================================
router.patch(
  "/:materialId/share",
  async (req, res) => {
    try {
      const userId =
        requireUserId(req, res);

      if (!userId) {
        return;
      }

      const { materialId } =
        req.params;

      /*
       * develop側の処理を残す。
       * 所有者本人だけが公開・非公開を変更できる。
       */
      const list =
        await db.findQuestionListByIdAndUserId(
          materialId,
          userId
        );

      if (!list) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、管理権限がありません"
        });
      }

      const shared =
        Boolean(req.body.shared);

      /*
       * 問題共有機能側の処理を残す。
       *
       * 公開時:
       *   materials.is_shared = 1
       *   共有コードを新規発行または既存コードを取得
       *
       * 非公開時:
       *   materials.is_shared = 0
       *   共有コードを削除
       *
       * updateQuestionListShare()はここでは呼ばない。
       * setShareStatus()の中で公開状態も更新するため。
       */
      const result =
        await materialShareService
          .setShareStatus({
            materialId,
            userId,
            shared
          });

      /*
       * 更新後の問題セット一覧を取得する。
       */
      const payload =
        await buildPayload(userId);

      res.json({
        ok: true,

        message: shared
          ? "問題セットを公開しました"
          : "問題セットを非公開にしました",

        /*
         * 公開時は共有コードが入る。
         * 非公開時はnull。
         */
        shareCode:
          result?.shareCode || null,

        ...payload
      });
    } catch (err) {
      console.error(
        "PATCH /api/materials/:materialId/share error:",
        err
      );

      /*
       * Service側で404や400を設定している場合は
       * そのステータスコードを利用する。
       */
      res.status(
        err.statusCode || 500
      ).json({
        ok: false,
        message:
          err.message ||
          "公開状態の更新に失敗しました"
      });
    }
  }
);


// ==================================================
// POST /api/materials/:materialId/questions
// 自分の問題セットだけ問題追加
// ==================================================
router.post(
  "/:materialId/questions",
  async (req, res) => {
    try {
      const userId =
        requireUserId(req, res);

      if (!userId) {
        return;
      }

      const { materialId } =
        req.params;

      /*
       * 所有者本人の問題セットか確認する。
       */
      const list =
        await db.findQuestionListByIdAndUserId(
          materialId,
          userId
        );

      if (!list) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、管理権限がありません"
        });
      }

      /*
       * UUIDを使いつつ既存形式のq_を付ける。
       */
      const questionId =
        `q_${randomUUID()}`;

      await db.createQuestion(
        questionId,
        materialId,
        req.body
      );

      const payload =
        await buildPayload(userId);

      res.status(201).json({
        ok: true,
        ...payload
      });
    } catch (err) {
      console.error(
        "POST /api/materials/:materialId/questions error:",
        err
      );

      res.status(500).json({
        ok: false,
        message:
          err.message ||
          "問題の追加に失敗しました"
      });
    }
  }
);

// ==================================================
// PUT /api/materials/:materialId/questions/:questionId
// 自分の問題セットだけ問題更新
// ==================================================
router.put(
  "/:materialId/questions/:questionId",
  async (req, res) => {
    try {
      const userId =
        requireUserId(req, res);

      if (!userId) {
        return;
      }

      const {
        materialId,
        questionId
      } = req.params;

      /*
       * 所有者本人の問題セットか確認する。
       */
      const list =
        await db.findQuestionListByIdAndUserId(
          materialId,
          userId
        );

      if (!list) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、管理権限がありません"
        });
      }

      const question =
        await db.findQuestionById(
          questionId
        );

      /*
       * 指定問題が対象の問題セットに属しているか確認する。
       */
      if (
        !question ||
        question.material_id !==
          materialId
      ) {
        return res.status(404).json({
          ok: false,
          message:
            "問題が見つかりません"
        });
      }

      await db.updateQuestion(
        questionId,
        req.body
      );

      const payload =
        await buildPayload(userId);

      res.json({
        ok: true,
        ...payload
      });
    } catch (err) {
      console.error(
        "PUT /api/materials/:materialId/questions/:questionId error:",
        err
      );

      res.status(500).json({
        ok: false,
        message:
          err.message ||
          "問題の更新に失敗しました"
      });
    }
  }
);

// ==================================================
// DELETE /api/materials/:materialId/questions/:questionId
// 自分の問題セットだけ問題削除
// ==================================================
router.delete(
  "/:materialId/questions/:questionId",
  async (req, res) => {
    try {
      const userId =
        requireUserId(req, res);

      if (!userId) {
        return;
      }

      const {
        materialId,
        questionId
      } = req.params;

      /*
       * 所有者本人の問題セットか確認する。
       */
      const list =
        await db.findQuestionListByIdAndUserId(
          materialId,
          userId
        );

      if (!list) {
        return res.status(404).json({
          ok: false,
          message:
            "問題セットが見つからないか、管理権限がありません"
        });
      }

      const question =
        await db.findQuestionById(
          questionId
        );

      /*
       * 指定問題が対象の問題セットに属しているか確認する。
       */
      if (
        !question ||
        question.material_id !==
          materialId
      ) {
        return res.status(404).json({
          ok: false,
          message:
            "問題が見つかりません"
        });
      }

      await db.deleteQuestion(
        questionId
      );

      const payload =
        await buildPayload(userId);

      res.json({
        ok: true,
        ...payload
      });
    } catch (err) {
      console.error(
        "DELETE /api/materials/:materialId/questions/:questionId error:",
        err
      );

      res.status(500).json({
        ok: false,
        message:
          err.message ||
          "問題の削除に失敗しました"
      });
    }
  }
);

module.exports = router;
