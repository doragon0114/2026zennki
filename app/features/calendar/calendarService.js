const calendarRepository = require("./calendarRepository");

function toDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function getDateLabel(dateKey) {
  const d = new Date(`${dateKey}T00:00:00`);

  return {
    dateKey,
    day: d.getDate(),
    dow: d.getDay()
  };
}

function getLastNDays(n) {
  const today = new Date();

  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (n - 1 - i));
    return toDateKey(d);
  });
}

function calculateStreak(studiedDateSet) {
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = toDateKey(cursor);

    if (!studiedDateSet.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function getCalendarSummary(userId) {
  const dateKeys = await calendarRepository.getActivityDateKeysByUserId(userId);
  const studiedDateSet = new Set(dateKeys);

  const weekKeys = getLastNDays(7);

  const days = weekKeys.map(dateKey => ({
    ...getDateLabel(dateKey),
    studied: studiedDateSet.has(dateKey),
    isToday: dateKey === toDateKey(new Date())
  }));

  const studied = days.filter(day => day.studied).length;
  const total = days.length;
  const streak = calculateStreak(studiedDateSet);

  return {
    streak,
    studied,
    total,
    days
  };
}

async function recordActivity({
  userId,
  type = "study",
  sourceId = null,
  points = 0
}) {
  if (!userId) {
    return null;
  }

  return await calendarRepository.addActivity({
    userId,
    type,
    sourceId,
    points
  });
}

async function getRanking({
  userId = null,
  limit = 50
} = {}) {
  return await calendarRepository.getRankingByPoint({
    userId,
    limit
  });
}

module.exports = {
  getCalendarSummary,
  recordActivity,
  getRanking
};