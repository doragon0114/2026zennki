const express = require("express");
const battleHistoryRepository = require("./battleHistoryRepository");

const router = express.Router();

// GET /api/battle/history
// セッションがある場合は req.session.userId、なければ query の userId を使う。
router.get("/history", async (req, res) => {
  try {
    const userId = req.session?.userId || req.query.userId;

    if (!userId) {
      return res.json({
        ok: true,
        history: []
      });
    }

    const history = await battleHistoryRepository.getBattleHistoryByUserId(userId);

    res.json({
      ok: true,
      history
    });
  } catch (err) {
    console.error("GET /api/battle/history error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "対戦履歴の取得に失敗しました"
    });
  }
});

module.exports = router;