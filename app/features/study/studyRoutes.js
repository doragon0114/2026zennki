const express = require("express");
const studyService = require("./studyService");

const router = express.Router();

function getRequestUserId(req) {
  return (
    req.session?.userId ||
    req.query.userId ||
    req.body?.userId ||
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

// GET /api/study/bootstrap
// ログイン中ユーザーの問題セットだけ取得
router.get("/bootstrap", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const data = await studyService.getBootstrapData(userId);

    res.json({
      ok: true,
      ...data
    });
  } catch (err) {
    console.error("GET /api/study/bootstrap error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "演習データの取得に失敗しました"
    });
  }
});

// POST /api/study/results
// 演習結果を results / answers に保存し、users を更新
router.post("/results", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const {
      answers,
      questions,
      startedAt,
      finishedAt
    } = req.body;

    const result = await studyService.saveResult({
      userId,
      answers,
      questions,
      startedAt,
      finishedAt
    });

    res.json({
      ok: true,
      result,
      user: result.user || null
    });
  } catch (err) {
    console.error("POST /api/study/results error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "演習結果の保存に失敗しました"
    });
  }
});

// GET /api/study/results/:resultId/wrong
// 指定した演習結果から、間違えた問題だけ取得する
router.get("/results/:resultId/wrong", async (req, res) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const wrongQuestions = await studyService.getWrongQuestions({
      userId,
      resultId: req.params.resultId
    });

    res.json({
      ok: true,
      questions: wrongQuestions
    });
  } catch (err) {
    console.error("GET /api/study/results/:resultId/wrong error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "間違えた問題の取得に失敗しました"
    });
  }
});

module.exports = router;