const db = require("../DB/dbRoutes");

function toHistoryItem(row) {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    playerName: row.playerName,
    opponentUserId: row.opponentUserId,
    opponent: row.opponent,
    avatar: row.avatar || "🤖",
    result: row.result,
    myScore: Number(row.myScore || 0),
    oppScore: Number(row.oppScore || 0),
    pts: Number(row.pts || 0),
    subject: row.subject,
    age: Number(row.age || 0),
    date: row.date || "",
    createdAt: row.createdAt
  };
}

async function saveBattleHistory(records) {
  const safeRecords = Array.isArray(records) ? records : [records];

  if (safeRecords.length === 0) {
    return [];
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    for (const record of safeRecords) {
      await connection.query(
        `
        INSERT INTO battle_history (
          battle_history_id,
          room_id,
          user_id,
          player_name,
          opponent_user_id,
          opponent_name,
          opponent_avatar,
          result,
          my_score,
          opp_score,
          pts,
          subject,
          age,
          battle_date,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          room_id = VALUES(room_id),
          user_id = VALUES(user_id),
          player_name = VALUES(player_name),
          opponent_user_id = VALUES(opponent_user_id),
          opponent_name = VALUES(opponent_name),
          opponent_avatar = VALUES(opponent_avatar),
          result = VALUES(result),
          my_score = VALUES(my_score),
          opp_score = VALUES(opp_score),
          pts = VALUES(pts),
          subject = VALUES(subject),
          age = VALUES(age),
          battle_date = VALUES(battle_date)
        `,
        [
          record.id,
          record.roomId,
          record.userId,
          record.playerName,
          record.opponentUserId || null,
          record.opponent,
          record.avatar || "🤖",
          record.result,
          Number(record.myScore || 0),
          Number(record.oppScore || 0),
          Number(record.pts || 0),
          record.subject,
          Number(record.age || 0),
          record.date || null,
          record.createdAt ? new Date(record.createdAt) : new Date()
        ]
      );
    }

    await connection.commit();

    return safeRecords;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getBattleHistoryByUserId(userId) {
  const [rows] = await db.query(
    `
    SELECT
      bh.battle_history_id AS id,
      bh.room_id AS roomId,
      bh.user_id AS userId,
      bh.player_name AS playerName,
      bh.opponent_user_id AS opponentUserId,
      bh.opponent_name AS opponent,
      COALESCE(NULLIF(u.avater, ''), NULLIF(bh.opponent_avatar, ''), '🤖') AS avatar,
      bh.result,
      bh.my_score AS myScore,
      bh.opp_score AS oppScore,
      bh.pts,
      bh.subject,
      bh.age,
      bh.battle_date AS date,
      bh.created_at AS createdAt
    FROM battle_history bh
    LEFT JOIN users u
      ON bh.opponent_user_id = u.user_id
    WHERE bh.user_id = ?
    ORDER BY bh.created_at DESC
    `,
    [userId]
  );

  return rows.map(toHistoryItem);
}

module.exports = {
  saveBattleHistory,
  getBattleHistoryByUserId
};