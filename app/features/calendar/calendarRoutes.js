const express = require("express");
const calendarService = require("./calendarService");

const router = express.Router();

function getRequestUserId(req) {
  return (
    req.session?.userId ||
    req.query.userId ||
    req.body?.userId ||
    null
  );
}

// GET /api/calendar/summary
router.get("/summary", async (req, res) => {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.json({
        ok: true,
        streak: 0,
        studied: 0,
        total: 7,
        days: []
      });
    }

    const summary = await calendarService.getCalendarSummary(userId);

    res.json({
      ok: true,
      ...summary
    });
  } catch (err) {
    console.error("GET /api/calendar/summary error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "カレンダー情報の取得に失敗しました"
    });
  }
});

// POST /api/calendar/activity
router.post("/activity", async (req, res) => {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "ログインユーザーが確認できません"
      });
    }

    const activity = await calendarService.recordActivity({
      userId,
      type: req.body.type || "study",
      sourceId: req.body.sourceId || null,
      points: Number(req.body.points || 0)
    });

    res.json({
      ok: true,
      activity
    });
  } catch (err) {
    console.error("POST /api/calendar/activity error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "カレンダー記録に失敗しました"
    });
  }
});

// GET /api/calendar/ranking
// users.point を使ったランキング
router.get("/ranking", async (req, res) => {
  try {
    const userId = getRequestUserId(req);
    const limit = Number(req.query.limit || 50);

    const rankings = await calendarService.getRanking({
      userId,
      limit
    });

    res.json({
      ok: true,
      rankings
    });
  } catch (err) {
    console.error("GET /api/calendar/ranking error:", err);

    res.status(500).json({
      ok: false,
      message: err.message || "ランキング取得に失敗しました"
    });
  }
});

module.exports = router;