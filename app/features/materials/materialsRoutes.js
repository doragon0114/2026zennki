const express = require("express");
const { randomUUID } = require("crypto");
const db = require("../DB/dbRoutes");

const router = express.Router();

function toFrontMaterial(list, questionCount = 0) {
  return {
    id: list.material_id,
    name: list.material_name,
    category: list.category_name || list.category_id || "未分類",
    categoryId: list.category_id,
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
    category: material?.category_name || material?.category_id || "未分類",
    tags: [],
    createdAt: q.created_at,
    updatedAt: q.updated_at
  };
}

// ── ヘルパー: DB行 → フロント形式に変換 ──
async function buildPayload() {
  const lists = await db.getAllQuestionLists();

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
// 問題セット一覧
// ==================================================
router.get("/", async (req, res) => {
  try {
    const payload = await buildPayload();

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
// GET /api/materials/:materialId
// 問題セット詳細
// ==================================================
router.get("/:materialId", async (req, res) => {
  try {
    const list = await db.findQuestionListById(req.params.materialId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つかりません"
      });
    }

    const qs = await db.findQuestionsByListId(list.material_id);

    const material = toFrontMaterial(list, qs.length);
    const questions = qs.map(q => {
      return toFrontQuestion(q, list);
    });

    res.json({
      ok: true,
      material,
      questions
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
// PATCH /api/materials/:materialId/share
// 公開・非公開切り替え
// ==================================================
router.patch("/:materialId/share", async (req, res) => {
  try {
    const { materialId } = req.params;

    const list = await db.findQuestionListById(materialId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つかりません"
      });
    }

    await db.updateMaterialShare(materialId, Boolean(req.body.shared));

    const payload = await buildPayload();

    res.json({
      ok: true,
      ...payload
    });
  } catch (err) {
    console.error("PATCH /api/materials/:materialId/share error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "公開状態の更新に失敗しました"
    });
  }
});

// ==================================================
// POST /api/materials/:materialId/questions
// 問題追加
// ==================================================
router.post("/:materialId/questions", async (req, res) => {
  try {
    const { materialId } = req.params;

    const list = await db.findQuestionListById(materialId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つかりません"
      });
    }

    const questionId = `q_${randomUUID()}`;

    await db.createQuestion(questionId, materialId, req.body);

    const payload = await buildPayload();

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
// 問題更新
// ==================================================
router.put("/:materialId/questions/:questionId", async (req, res) => {
  try {
    const { materialId, questionId } = req.params;

    const list = await db.findQuestionListById(materialId);

    if (!list) {
      return res.status(404).json({
        ok: false,
        message: "問題セットが見つかりません"
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

    const payload = await buildPayload();

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
// 問題削除
// ==================================================
router.delete("/:materialId/questions/:questionId", async (req, res) => {
  try {
    const { materialId, questionId } = req.params;

    const q = await db.findQuestionById(questionId);

    if (!q || q.material_id !== materialId) {
      return res.status(404).json({
        ok: false,
        message: "問題が見つかりません"
      });
    }

    await db.deleteQuestion(questionId);

    const payload = await buildPayload();

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