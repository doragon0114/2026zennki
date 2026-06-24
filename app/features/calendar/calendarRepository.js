const crypto = require("crypto");
const db = require("../DB/dbRoutes");

function createId(prefix, byteLength = 6) {
  return `${prefix}_${crypto.randomBytes(byteLength).toString("hex")}`;
}

function toDateKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function normalizeType(type) {
  const value = String(type || "study").trim();

  if (value === "battle") {
    return "battle";
  }

  return "study";
}

async function addActivity({
  userId,
  type = "study",
  sourceId = null,
  points = 0,
  activityDate = new Date()
}) {
  const id = String(userId || "").trim();

  if (!id) {
    return null;
  }

  const activityType = normalizeType(type);
  const dateKey = toDateKey(activityDate);
  const pointValue = Math.max(0, Number(points || 0));

  const studyCount = activityType === "study" ? 1 : 0;
  const battleCount = activityType === "battle" ? 1 : 0;
  const calendarId = createId("cal", 8);

  await db.query(
    `
    INSERT INTO \`calendar\` (
      calendar_id,
      user_id,
      activity_date,
      study_count,
      battle_count,
      total_points,
      last_type,
      last_source_id,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      study_count =
        CASE
          WHEN VALUES(study_count) = 1 THEN 1
          ELSE study_count
        END,
      battle_count =
        CASE
          WHEN VALUES(battle_count) = 1 THEN 1
          ELSE battle_count
        END,
      total_points = GREATEST(total_points, VALUES(total_points)),
      last_type = VALUES(last_type),
      last_source_id = VALUES(last_source_id),
      updated_at = NOW()
    `,
    [
      calendarId,
      id,
      dateKey,
      studyCount,
      battleCount,
      pointValue,
      activityType,
      sourceId
    ]
  );

  return {
    id: calendarId,
    userId: id,
    type: activityType,
    sourceId,
    points: pointValue,
    dateKey,
    createdAt: new Date().toISOString()
  };
}

async function getActivityDateKeysByUserId(userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return [];
  }

  const [rows] = await db.query(
    `
    SELECT
      DATE_FORMAT(activity_date, '%Y-%m-%d') AS dateKey
    FROM \`calendar\`
    WHERE user_id = ?
      AND (study_count > 0 OR battle_count > 0)
    ORDER BY activity_date ASC
    `,
    [id]
  );

  return rows.map(row => row.dateKey);
}

async function getCalendarRowsByUserId(userId) {
  const id = String(userId || "").trim();

  if (!id) {
    return [];
  }

  const [rows] = await db.query(
    `
    SELECT
      calendar_id AS calendarId,
      user_id AS userId,
      DATE_FORMAT(activity_date, '%Y-%m-%d') AS dateKey,
      study_count AS studyCount,
      battle_count AS battleCount,
      total_points AS totalPoints,
      last_type AS lastType,
      last_source_id AS lastSourceId,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM \`calendar\`
    WHERE user_id = ?
    ORDER BY activity_date DESC
    `,
    [id]
  );

  return rows;
}

async function getRankingByPoint({
  userId = null,
  limit = 50
} = {}) {
  const maxLimit = Math.min(Math.max(Number(limit || 50), 1), 100);

  const [topRows] = await db.query(
    `
    SELECT
      user_id AS userId,
      username,
      avater AS avatar,
      point,
      battle_win_count AS battleWinCount,
      study_count AS studyCount,
      question_count AS questionCount
    FROM users
    ORDER BY
      point DESC,
      battle_win_count DESC,
      study_count DESC,
      created_at ASC
    LIMIT ?
    `,
    [maxLimit]
  );

  const rankings = topRows.map((row, index) => ({
    rank: index + 1,
    userId: row.userId,
    name: row.username,
    username: row.username,
    avatar: row.avatar || "🐧",
    point: Number(row.point || 0),
    points: Number(row.point || 0),
    battleWinCount: Number(row.battleWinCount || 0),
    wins: Number(row.battleWinCount || 0),
    studyCount: Number(row.studyCount || 0),
    questionCount: Number(row.questionCount || 0),
    isMe: userId ? String(row.userId) === String(userId) : false
  }));

  const id = String(userId || "").trim();

  if (!id || rankings.some(user => user.isMe)) {
    return rankings;
  }

  const [meRows] = await db.query(
    `
    SELECT
      user_id AS userId,
      username,
      avater AS avatar,
      point,
      battle_win_count AS battleWinCount,
      study_count AS studyCount,
      question_count AS questionCount
    FROM users
    WHERE user_id = ?
    LIMIT 1
    `,
    [id]
  );

  if (meRows.length === 0) {
    return rankings;
  }

  const me = meRows[0];

  const [rankRows] = await db.query(
    `
    SELECT
      COUNT(*) + 1 AS myRank
    FROM users
    WHERE
      point > ?
      OR (
        point = ?
        AND battle_win_count > ?
      )
      OR (
        point = ?
        AND battle_win_count = ?
        AND study_count > ?
      )
    `,
    [
      me.point,
      me.point,
      me.battleWinCount,
      me.point,
      me.battleWinCount,
      me.studyCount
    ]
  );

  rankings.push({
    rank: Number(rankRows[0]?.myRank || rankings.length + 1),
    userId: me.userId,
    name: me.username,
    username: me.username,
    avatar: me.avatar || "🐧",
    point: Number(me.point || 0),
    points: Number(me.point || 0),
    battleWinCount: Number(me.battleWinCount || 0),
    wins: Number(me.battleWinCount || 0),
    studyCount: Number(me.studyCount || 0),
    questionCount: Number(me.questionCount || 0),
    isMe: true
  });

  return rankings;
}

module.exports = {
  addActivity,
  getActivityDateKeysByUserId,
  getCalendarRowsByUserId,
  getRankingByPoint
};