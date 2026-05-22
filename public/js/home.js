const homeUserName = document.getElementById("homeUserName");
const calendarMonth = document.getElementById("calendarMonth");
const calendarWeek = document.getElementById("calendarWeek");
const notifButton = document.getElementById("notifButton");

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderCalendar() {
  const today = new Date();
  const labels = ["日", "月", "火", "水", "木", "金", "土"];

  calendarMonth.textContent = `${today.getFullYear()}年${today.getMonth() + 1}月`;

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - 6 + index);
    return date;
  });

  calendarWeek.innerHTML = days
    .map((date) => {
      const isToday = date.toDateString() === today.toDateString();
      const day = date.getDay();

      const dayClass = day === 0 ? "sun" : day === 6 ? "sat" : "";
      const statusClass = isToday ? "today" : "done";

      const mark = isToday
        ? `<span class="cal-today-dot"></span>`
        : `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        `;

      return `
        <div class="cal-cell ${statusClass} ${dayClass}">
          <div class="cal-cell-dow">${labels[day]}</div>
          <div class="cal-cell-num">${date.getDate()}</div>
          <div class="cal-cell-mark">${mark}</div>
        </div>
      `;
    })
    .join("");
}

window.addEventListener("DOMContentLoaded", async () => {
  renderCalendar();

  try {
    const response = await fetch("/api/auth/me");

    if (!response.ok) {
      location.href = "/login.html";
      return;
    }

    const data = await response.json();
    const user = data.user;

    homeUserName.textContent = escapeHtml(user.username || "ユーザー");
  } catch {
    location.href = "/login.html";
  }
});

notifButton.addEventListener("click", () => {
  alert("🔔 お知らせ\n\n現在、新しいお知らせはありません。");
});