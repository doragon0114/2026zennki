const express = require("express");
const db = require("../DB/dbRoutes");

const router = express.Router();

// ── ヘルパー: DB行 → フロント形式に変換 ──────────────
async function buildPayload() {
  const lists = await db.getAllQuestionLists();

  const materials = await Promise.all(
    lists.map(async (list) => {
      const questions = await db.findQuestionsByListId(list.QLIST_ID);
      return {
        id: list.QLIST_ID,
        name: `問題セット ${list.QLIST_ID}`,
        category: list.CATEGORY_ID,
        questionCount: questions.length,
        shared: false,
        type: "file",
        createdAt: new Date().toISOString(),
      };
    })
  );

  const questionArrays = await Promise.all(
    lists.map(async (list) => {
      const qs = await db.findQuestionsByListId(list.QLIST_ID);
      return qs.map((q) => ({
        id: q.QID,
        materialId: q.QLIST_ID,
        text: q.QUESTION,
        choices: [q.ANSWER, q.MISS_ONE, q.MISS_TWO, q.MISS_THREE],
        correct: 0,
        explanation: q.EXPLAIN || "",
        category: list.CATEGORY_ID,
        tags: [],
      }));
    })
  );

  return {
    materials,
    questions: questionArrays.flat(),
  };
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

    const qs = await db.findQuestionsByListId(list.QLIST_ID);
    const material = {
      id: list.QLIST_ID,
      name: `問題セット ${list.QLIST_ID}`,
      category: list.CATEGORY_ID,
      questionCount: qs.length,
      shared: false,
      type: "file",
      createdAt: new Date().toISOString(),
    };
    const questions = qs.map((q) => ({
      id: q.QID,
      materialId: q.QLIST_ID,
      text: q.QUESTION,
      choices: [q.ANSWER, q.MISS_ONE, q.MISS_TWO, q.MISS_THREE],
      correct: 0,
      explanation: q.EXPLAIN || "",
      category: list.CATEGORY_ID,
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
    // TODO: sharedフラグをDBに保存する場合はQUESTION_LISTにカラム追加
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

    const qid = require("crypto").randomBytes(2).toString("hex");
    await db.createQuestion(qid, materialId, req.body);

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