const express = require("express");

const studyService = require("./studyService");

const router = express.Router();

// GET /api/study/bootstrap
// 教材・問題・カテゴリをまとめて返す
router.get("/bootstrap", (req, res) => {
  const data = studyService.getBootstrapData();

  res.json({
    ok: true,
    ...data
  });
});

// POST /api/study/results
// 学習結果を仮JSONに保存する
router.post("/results", (req, res) => {
  const { answers, questions, startedAt, finishedAt } = req.body;

  const result = studyService.saveResult({
    userId: req.session?.userId || null,
    answers,
    questions,
    startedAt,
    finishedAt
  });

  res.json({
    ok: true,
    result
  });
});

module.exports = router;