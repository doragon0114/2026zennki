const express = require("express");
const battleHistoryRepository = require("./battleHistoryRepository");

const router = express.Router();

// GET /api/battle/history
// 自分の対戦履歴を取得する。
// セッションがある場合は req.session.userId、なければ query の userId を使う。
router.get("/history", (req, res) => {
  const userId = req.session?.userId || req.query.userId;

  if (!userId) {
    return res.json({
      ok: true,
      history: []
    });
  }

  const history = battleHistoryRepository.getBattleHistoryByUserId(userId);

  res.json({
    ok: true,
    history
  });
});

module.exports = router;