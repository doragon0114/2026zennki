const express = require("express");
const crypto = require("crypto");
const db = require("../DB/dbRoutes");

const router = express.Router();

// ── ヘルパー: DB行 → フロント形式に変換 ──
async function buildPayload() {
  const lists = await db.getAllQuestionLists();

  const listData = await Promise.all(
    lists.map(async (list) => {
      const qs = await db.findQuestionsByListId(list.material_id);
      return { list, qs };
    })
  );

  const materials = listData.map(({ list, qs }) => ({
    id: list.material_id,
    name: list.material_name,
    category: list.category_id,
    questionCount: qs.length,
    shared: list.is_shared === 1,
    type: "file",
    createdAt: list.created_at ? new Date(list.created_at).toISOString() : new Date().toISOString(),
  }));

  const questions = listData.flatMap(({ list, qs }) =>
    qs.map((q) => ({
      id: q.question_id,
      materialId: q.material_id,
      text: q.question_text,
      choices: q.choices,
      correct: q.correct,
      explanation: q.explanation || "",
      category: list.category_id,
      tags: [],
    }))
  );

  return { materials, questions };
}

// GET /api/materials
router.get("/", async (req, res) => {
  try {
    const payload = await buildPayload();
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /api/materials/:materialId
router.get("/:materialId", async (req, res) => {
  try {
    const list = await db.findQuestionListById(req.params.materialId);
    if (!list) {
      return res.status(404).json({ ok: false, message: "問題セットが見つかりません" });
    }

    const qs = await db.findQuestionsByListId(list.material_id);
    const material = {
      id: list.material_id,
      name: list.material_name,
      category: list.category_id,
      questionCount: qs.length,
      shared: list.is_shared === 1,
      type: "file",
      createdAt: list.created_at ? new Date(list.created_at).toISOString() : new Date().toISOString(),
    };
    const questions = qs.map((q) => ({
      id: q.question_id,
      materialId: q.material_id,
      text: q.question_text,
      choices: q.choices,
      correct: q.correct,
      explanation: q.explanation || "",
      category: list.category_id,
      tags: [],
    }));

    res.json({ ok: true, material, questions });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// PATCH /api/materials/:materialId/share
router.patch("/:materialId/share", async (req, res) => {
  try {
    const list = await db.findQuestionListById(req.params.materialId);
    if (!list) {
      return res.status(404).json({ ok: false, message: "問題セットが見つかりません" });
    }
    const shared = req.body.shared ? 1 : 0;
    await db.pool.query(
      "UPDATE Questions SET is_shared = ? WHERE material_id = ?",
      [shared, req.params.materialId]
    );
    const payload = await buildPayload();
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/materials/:materialId/questions
router.post("/:materialId/questions", async (req, res) => {
  try {
    const { materialId } = req.params;
    const list = await db.findQuestionListById(materialId);
    if (!list) {
      return res.status(404).json({ ok: false, message: "問題セットが見つかりません" });
    }

    const questionId = crypto.randomUUID();
    await db.createQuestion(questionId, materialId, req.body);

    const payload = await buildPayload();
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// PUT /api/materials/:materialId/questions/:questionId
router.put("/:materialId/questions/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const q = await db.findQuestionById(questionId);
    if (!q) {
      return res.status(404).json({ ok: false, message: "問題が見つかりません" });
    }

    await db.updateQuestion(questionId, req.body);

    const payload = await buildPayload();
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// DELETE /api/materials/:materialId/questions/:questionId
router.delete("/:materialId/questions/:questionId", async (req, res) => {
  try {
    const { questionId } = req.params;
    const q = await db.findQuestionById(questionId);
    if (!q) {
      return res.status(404).json({ ok: false, message: "問題が見つかりません" });
    }

    await db.deleteQuestion(questionId);

    const payload = await buildPayload();
    res.json({ ok: true, ...payload });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;