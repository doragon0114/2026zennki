const fs = require("fs");
const path = require("path");

const historyPath = path.join(__dirname, "../../data/battleHistory.json");

// ==================================================
// 仮DB Repository
// 今は JSON に保存する。
// 後で MySQL に移行する場合は、このファイルの中身をDB処理へ差し替える。
// ==================================================

function ensureHistoryFile() {
  const dir = path.dirname(historyPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(historyPath)) {
    fs.writeFileSync(historyPath, JSON.stringify([], null, 2), "utf-8");
  }
}

function readHistory() {
  ensureHistoryFile();

  try {
    const data = JSON.parse(fs.readFileSync(historyPath, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeHistory(history) {
  ensureHistoryFile();
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
}

function saveBattleHistory(records) {
  const history = readHistory();
  const safeRecords = Array.isArray(records) ? records : [records];

  safeRecords.forEach(record => {
    history.push({
      ...record,
      createdAt: record.createdAt || new Date().toISOString()
    });
  });

  writeHistory(history);

  return safeRecords;
}

function getBattleHistoryByUserId(userId) {
  const history = readHistory();

  return history
    .filter(item => String(item.userId) === String(userId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

module.exports = {
  saveBattleHistory,
  getBattleHistoryByUserId
};