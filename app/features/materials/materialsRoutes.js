const express = require("express");
const { randomUUID } = require("crypto");
const db = require("../DB/dbRoutes");
const materialShareService =
  require("./materialShareService");

const router = express.Router();

function getRequestUserId(req) {
  return (
    req.session?.userId ||
    req.query.userId ||
    req.body?.userId ||
    req.headers["x-user-id"] ||
    null
  );
}

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

function toFrontMaterial(list, questionCount = 0) {
  return {
    id: list.material_id,
    userId: list.user_id,
    name: list.material_name,
    category: list.category_name || "未分類",
    categoryId: list.category_id === null || list.category_id === undefined
      ? null
      : Number(list.category_id),
    questionCount,
    shared: Number(list.is_shared) === 1,
    type: "file",
    createdAt: list.created_at,
    updatedAt: list.updated_at
  };
}

function toFrontQuestion(q, material) {
  return {
    id: q.question_id,
    materialId: q.material_id,
    text: q.question_text,
    choices: Array.isArray(q.choices) ? q.choices : [],
    correct: Number.isInteger(q.correct) ? q.correct : 0,
    explanation: q.explanation || "",
    category: material?.category_name || "未分類",
    categoryId: material?.category_id === null || material?.category_id === undefined
      ? null
      : Number(material.category_id),
    tags: [],
    createdAt: q.created_at,
    updatedAt: q.updated_at
  };
}

async function buildPayload(userId) {
  const lists = await db.getQuestionListsByUserId(userId);

  const materialPairs = await Promise.all(
    lists.map(async (list) => {
      const questions = await db.findQuestionsByListId(list.material_id);

      return {
        list,
        questions
      };
    })
  );

  const materials = materialPairs.map(pair => {
    return toFrontMaterial(pair.list, pair.questions.length);
  });

  const questions = materialPairs.flatMap(pair => {
    return pair.questions.map(q => {
      return toFrontQuestion(q, pair.list);
    });
  });

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
    const userId = requireUserId(req, res);
    if (!userId) return;

    const payload = await buildPayload(userId);

    res.json({
      ok: true,
      ...payload
    });
  } catch (err) {
    console.error("GET /api/materials error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "問題セットの取得に失敗しました"
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
router.get("/:materialId", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const list = await db.findQuestionListByIdAndUserId(
      req.params.materialId,
      userId
    );

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つからないか、管理権限がありません"
      });
    }

    const qs = await db.findQuestionsByListId(list.material_id);

    res.json({
      ok: true,
      material: toFrontMaterial(list, qs.length),
      questions: qs.map(q => toFrontQuestion(q, list))
    });
  } catch (err) {
    console.error("GET /api/materials/:materialId error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "問題セット詳細の取得に失敗しました"
    });
  }
});

// ==================================================
// DELETE /api/materials/:materialId
// 自分が所有する問題セットを、問題ごと削除する
// ==================================================
router.delete("/:materialId", async (req, res) => {
  try {
    const userId = requireUserId(req, res);

    if (!userId) {
      return;
    }

    const { materialId } = req.params;

    // 本人が所有している問題セットか先に確認
    const list = await db.findQuestionListByIdAndUserId(
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

    const deleted = await db.deleteQuestionListByUserId(
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

    const payload = await buildPayload(userId);

    res.json({
      ok: true,
      message: "問題セットを削除しました",
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
        err.message || "問題セットの削除に失敗しました"
    });
  }
});

// ==================================================
// PATCH /api/materials/:materialId/share
// 公開・非公開切り替えと共有コードの発行・削除
// ==================================================
router.patch(
  "/:materialId/share",
  async (req, res) => {
    try {
      const userId = requireUserId(req, res);

      if (!userId) {
        return;
      }

      const shared =
        Boolean(req.body.shared);

      const result =
        await materialShareService
          .setShareStatus({
            materialId:
              req.params.materialId,
            userId,
            shared
          });

      const payload =
        await buildPayload(userId);

      res.json({
        ok: true,
        message: shared
          ? "問題セットを公開しました"
          : "問題セットを非公開にしました",
        shareCode: result.shareCode,
        ...payload
      });
    } catch (err) {
      console.error(
        "PATCH /api/materials/:materialId/share error:",
        err
      );

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
router.post("/:materialId/questions", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { materialId } = req.params;

    const list = await db.findQuestionListByIdAndUserId(materialId, userId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つからないか、管理権限がありません"
      });
    }

    const questionId = `q_${randomUUID()}`;

    await db.createQuestion(questionId, materialId, req.body);

    const payload = await buildPayload(userId);

    res.json({
      ok: true,
      ...payload
    });
  } catch (err) {
    console.error("POST /api/materials/:materialId/questions error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "問題の追加に失敗しました"
    });
  }
});

// ==================================================
// PUT /api/materials/:materialId/questions/:questionId
// 自分の問題セットだけ問題更新
// ==================================================
router.put("/:materialId/questions/:questionId", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { materialId, questionId } = req.params;

    const list = await db.findQuestionListByIdAndUserId(materialId, userId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つからないか、管理権限がありません"
      });
    }

    const q = await db.findQuestionById(questionId);

    if (!q || q.material_id !== materialId) {
      return res.status(404).json({
        ok: false,
        message: "問題が見つかりません"
      });
    }

    await db.updateQuestion(questionId, req.body);

    const payload = await buildPayload(userId);

    res.json({
      ok: true,
      ...payload
    });
  } catch (err) {
    console.error("PUT /api/materials/:materialId/questions/:questionId error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "問題の更新に失敗しました"
    });
  }
});

// ==================================================
// DELETE /api/materials/:materialId/questions/:questionId
// 自分の問題セットだけ問題削除
// ==================================================
router.delete("/:materialId/questions/:questionId", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { materialId, questionId } = req.params;

    const list = await db.findQuestionListByIdAndUserId(materialId, userId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つからないか、管理権限がありません"
      });
    }

    const q = await db.findQuestionById(questionId);

    if (!q || q.material_id !== materialId) {
      return res.status(404).json({
        ok: false,
        message: "問題が見つかりません"
      });
    }

    await db.deleteQuestion(questionId);

    const payload = await buildPayload(userId);

    res.json({
      ok: true,
      ...payload
    });
  } catch (err) {
    console.error("DELETE /api/materials/:materialId/questions/:questionId error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "問題の削除に失敗しました"
    });
  }
});

module.exports = router;