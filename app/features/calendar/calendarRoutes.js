const express = require("express");
const calendarService = require("./calendarService");

const router = express.Router();

// GET /api/calendar/summary
router.get("/summary", (req, res) => {
  const userId = req.session?.userId || req.query.userId;

  if (!userId) {
    return res.json({
      ok: true,
      streak: 0,
      studied: 0,
      total: 7,
      days: []
    });
  }

  const summary = calendarService.getCalendarSummary(userId);

  res.json({
    ok: true,
    ...summary
  });
});

// POST /api/calendar/activity
router.post("/activity", (req, res) => {
  const userId = req.session?.userId || req.body.userId;

  const activity = calendarService.recordActivity({
    userId,
    type: req.body.type || "study",
    sourceId: req.body.sourceId || null,
    points: Number(req.body.points || 0)
  });

  res.json({
    ok: true,
    activity
  });
});

module.exports = router;