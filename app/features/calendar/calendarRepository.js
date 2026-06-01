const fs = require("fs");
const path = require("path");

const calendarPath = path.join(__dirname, "../../data/calendarActivities.json");

// ==================================================
// 仮DB Repository
// 今は JSON に保存する。
// 後で MySQL に移行する場合は、このファイルの中身をDB処理へ差し替える。
// ==================================================

function ensureCalendarFile() {
  const dir = path.dirname(calendarPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(calendarPath)) {
    fs.writeFileSync(calendarPath, JSON.stringify([], null, 2), "utf-8");
  }
}

function readActivities() {
  ensureCalendarFile();

  try {
    const data = JSON.parse(fs.readFileSync(calendarPath, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeActivities(activities) {
  ensureCalendarFile();
  fs.writeFileSync(calendarPath, JSON.stringify(activities, null, 2), "utf-8");
}

function addActivity(activity) {
  const activities = readActivities();
  activities.push(activity);
  writeActivities(activities);
  return activity;
}

function getActivitiesByUserId(userId) {
  return readActivities().filter(activity => {
    return String(activity.userId) === String(userId);
  });
}

module.exports = {
  addActivity,
  getActivitiesByUserId
};