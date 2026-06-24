const express = require("express");
const studyService = require("./studyService");
const studyRepository = require("./studyRepository");

const router = express.Router();

// GET /api/study/bootstrap
router.get("/bootstrap", async (req, res) => {
  try {
    const data = await studyService.getBootstrapData();
    res.json({ ok: true, ...data });
  } catch (err) {
    console.error("bootstrap error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// POST /api/study/results
router.post("/results", async (req, res) => {
  try {
    const { answers, questions, startedAt, finishedAt } = req.body;
    const result = await studyService.saveResult({
      userId: req.session?.userId || null,
      answers,
      questions,
      startedAt,
      finishedAt,
    });
    res.json({ ok: true, result });
  } catch (err) {
    console.error("results error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

// GET /api/study/correct-rates  ← ホーム画面用
router.get("/correct-rates", async (req, res) => {
  try {
    const userId = req.session?.userId;
    if (!userId) return res.json({ ok: true, rates: {} });
    const rates = await studyRepository.getCorrectRatesByUserId(userId);
    res.json({ ok: true, rates });
  } catch (err) {
    console.error("correct-rates error:", err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

module.exports = router;