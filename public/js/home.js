/* ============================================================
   home.js — ホーム画面
   ─────────────────────────────────────────────────────────────
   担当: フロントエンド担当

   画面構成:
     ・挨拶ブロック
     ・学習カレンダーカード（renderHomeCalendar）
     ・セット一覧（最大4件）
     ・クイックモード（個人学習 / 対戦モード）
============================================================ */

let homeCalendarLoaded = false;
let homeCalendarLoading = false;
let homeCalendarSummary = null;
let homeCorrectRates = {};      // ← 追加: { materialId -> pct }
let homeCorrectRatesLoaded = false;

async function loadCorrectRatesFromServer() {
  try {
    const userId = encodeURIComponent(
      S.user?.userId ||
      S.user?.id ||
      ""
    );

    const res = await fetch(
      `/api/study/correct-rates?userId=${userId}`
    );

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(
        data.message ||
        "正答率の取得に失敗しました"
      );
    }

    homeCorrectRates =
      data.rates || {};

    /*
     * 他画面でも使えるようにS.materialsへ反映する。
     */
    if (Array.isArray(S.materials)) {
      S.materials = S.materials.map(material => {
        const hasRate =
          Object.prototype.hasOwnProperty.call(
            homeCorrectRates,
            material.id
          );

        return {
          ...material,
          correctRate:
            hasRate
              ? Number(
                  homeCorrectRates[material.id]
                )
              : null
        };
      });

      save();
    }

    const deckEl =
      document.getElementById("home-decks");

    if (
      deckEl &&
      isHomeScreenVisible()
    ) {
      deckEl.innerHTML =
        renderHomeDecksHTML();
    }
  } catch (err) {
    console.error(
      "loadCorrectRatesFromServer error:",
      err
    );
  } finally {
    homeCorrectRatesLoaded = true;
  }
}

let homeMaterialsRefreshing = false;

function isHomeScreenVisible() {
  return Boolean(document.getElementById("home-root"));
}

function renderHomeDecksHTML() {
  const deckIcons = [
    svg(IC.leaf,20),
    svg(IC.bookOpen,20),
    svg(IC.flask,20),
    svg(IC.globe,20),
    svg(IC.pencil,20),
    svg(IC.dna,20)
  ];

  const decks = S.materials.slice(0, 4)
    .map((material, index) => {
      const questionCount =
        S.questions.filter(question => {
          return question.materialId === material.id;
        }).length;

      const mapHasRate =
        Object.prototype.hasOwnProperty.call(
          homeCorrectRates,
          material.id
        );

      const rawRate =
        material.correctRate !== null &&
        material.correctRate !== undefined
          ? material.correctRate
          : mapHasRate
            ? homeCorrectRates[material.id]
            : null;

      const hasRate =
        rawRate !== null &&
        rawRate !== undefined &&
        Number.isFinite(Number(rawRate));

      const correctRate =
        hasRate
          ? Math.max(
              0,
              Math.min(
                100,
                Number(rawRate)
              )
            )
          : 0;

      const rateClass =
        !hasRate
          ? ""
          : correctRate >= 70
            ? ""
            : correctRate >= 55
              ? "warn"
              : "danger";

      const rateLabel =
        hasRate
          ? `${correctRate}%`
          : `<span style="font-size:11px;color:var(--gray)">未挑戦</span>`;

      return `
        <div
          class="mini-set-card"
          onclick="navigate('question-edit',{materialId:'${esc(material.id)}'})"
        >
          <div class="mini-set-icon color-${index % 6}">
            ${deckIcons[index % deckIcons.length]}
          </div>

          <div class="mini-set-info">
            <div class="mini-set-title">
              ${esc(material.name)}
            </div>

            <div class="mini-set-meta">
              ${questionCount}問
            </div>

            <div class="mini-set-bar-bg">
              <div
                class="mini-set-bar-fill"
                style="width:${correctRate}%"
              ></div>
            </div>
          </div>

          <div class="mini-set-pct ${rateClass}">
            ${rateLabel}
          </div>

          <div class="mini-set-arrow">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          </div>
        </div>
      `;
    })
    .join("");

  return decks || `
    <div
      class="text-center text-gray"
      style="padding:24px 0"
    >
      セットがまだありません。「セット追加」から始めよう。
    </div>
  `;
}

async function refreshHomeMaterialsLater() {
  if (homeMaterialsRefreshing) {
    return;
  }

  if (typeof loadMaterialsFromServer !== "function") {
    return;
  }

  homeMaterialsRefreshing = true;

  setTimeout(async () => {
    try {
      await loadMaterialsFromServer(true);

      if (!isHomeScreenVisible()) {
        return;
      }

      const deckEl = document.getElementById("home-decks");

      if (deckEl) {
        deckEl.innerHTML = renderHomeDecksHTML();
      }
    } finally {
      homeMaterialsRefreshing = false;
    }
  }, 0);
}

async function loadHomeCalendarFromServer(force = false) {
  if (homeCalendarLoading) {
    return;
  }

  if (homeCalendarLoaded && !force) {
    return;
  }

  homeCalendarLoading = true;

  try {
    const userId = encodeURIComponent(S.user.userId || S.user.id || S.user.email || S.user.name || "");
    const response = await fetch(`/api/calendar/summary?userId=${userId}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "カレンダー情報の取得に失敗しました");
    }

    homeCalendarSummary = {
      streak: Number(data.streak || 0),
      studied: Number(data.studied || 0),
      total: Number(data.total || 7),
      days: Array.isArray(data.days) ? data.days : []
    };

    homeCalendarLoaded = true;

    // 正答率も取得（並行）
    await loadCorrectRatesFromServer();

    const calendarEl = document.getElementById("home-calendar-card");

    if (calendarEl && isHomeScreenVisible()) {
      calendarEl.outerHTML = renderHomeCalendar();
    }
  } catch {
    homeCalendarSummary = null;
  } finally {
    homeCalendarLoading = false;
  }
}

function markHomeCalendarDirty() {
  homeCalendarLoaded = false;
  homeCalendarSummary = null;

  if (isHomeScreenVisible()) {
    refreshHomeCalendarLater(true);
  }
}

function refreshHomeCalendarLater(force = false) {
  setTimeout(() => {
    loadHomeCalendarFromServer(force);
  }, 0);
}

/* 学習カレンダーカードを生成する（今日を含む直近7日間を表示） */
function renderHomeCalendar() {
  if (!homeCalendarLoaded) {
    setTimeout(() => {
      loadHomeCalendarFromServer();
    }, 0);
  }

  const today = new Date();
  const dayLabelsByDow = ["日", "月", "火", "水", "木", "金", "土"];

  const fallbackDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 6 + i);

    return {
      day: d.getDate(),
      dow: d.getDay(),
      studied: false,
      isToday: d.toDateString() === today.toDateString()
    };
  });

  const summary = homeCalendarSummary || {
    streak: 0,
    studied: 0,
    total: 7,
    days: fallbackDays
  };

  const cells = summary.days.map(day => {
    const cls = day.isToday ? "today" : day.studied ? "done" : "";
    const colorCls = day.dow === 0 ? "sun" : day.dow === 6 ? "sat" : "";

    return `
      <div class="cal-cell ${cls} ${colorCls}">
        <div class="cal-cell-dow">${dayLabelsByDow[day.dow]}</div>
        <div class="cal-cell-num">${day.day}</div>
        <div class="cal-cell-mark">
          ${day.studied
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
            : day.isToday
              ? `<span class="cal-today-dot"></span>`
              : ``}
        </div>
      </div>`;
  }).join("");

  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const streak = summary.streak;
  const studied = summary.studied;
  const total = summary.total || 7;

  return `
    <div class="cal-card" id="home-calendar-card">
      <div class="cal-head">
        <div class="cal-head-title">学習カレンダー</div>
        <div class="cal-head-month">${year}年${month}月</div>
      </div>

      <div class="cal-streak">
        <div class="cal-streak-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5c0 2 1.5 3.5 3.5 3.5s3.5-1.5 3.5-3.5c0-3-2.5-3-2.5-6 0 0 0-2-2-2-2 0-2 2-2 2 0 3-2.5 3-2.5 6z" fill="currentColor" fill-opacity=".25"/><path d="M12 3c0 3 4 4 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 1-1 2-3 2-5z"/></svg>
        </div>

        <div class="cal-streak-text">
          <div class="cal-streak-big"><strong>${streak}</strong>日連続学習中</div>
          <div class="cal-streak-sub">この調子でがんばろう！</div>
        </div>

        <div class="cal-streak-bar">
          <div class="cal-streak-bar-fill" style="width:${Math.min(100, (studied / total) * 100)}%"></div>
        </div>
      </div>

      <div class="cal-week">${cells}</div>

      <div class="cal-legend">
        <div class="cal-legend-item"><span class="cal-legend-dot done"></span>完了</div>
        <div class="cal-legend-item"><span class="cal-legend-dot today"></span>今日</div>
      </div>
    </div>
  `;
}


/* ホーム画面本体 */
function renderHome() {
  refreshHomeMaterialsLater();
  refreshHomeCalendarLater(true);

  setTimeout(() => {
    loadCorrectRatesFromServer();
  }, 0);

  const point = Number(S.user.point ?? S.user.points ?? 0);
  const lv = getLevel(point);
  const xp = getXP(point);
  const firstName = (S.user.name || "").split(/\s|　/)[0];

  return `
  <div id="home-root">
    <div class="home-top">
      <div class="home-top-bar">
        <button class="home-menu-btn" onclick="navigate('mypage')" aria-label="menu">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="14" y2="17"/></svg>
        </button>
        <div class="home-brand">Revino</div>
        <button class="home-notif-btn" onclick="showNotif()" aria-label="notifications">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
          <div class="notif-dot"></div>
        </button>
      </div>
      <div class="home-greeting-block">
        <div class="home-greet-line">やあ、${esc(firstName)}さん！</div>
        <div class="home-greet-sub">今日も復習をがんばろう。</div>
      </div>
      ${renderHomeCalendar()}
    </div>

    <div class="home-body">
      <div class="section-header">
        <div class="section-title">セット一覧</div>
        <button class="section-link" onclick="navigate('materials')">すべて見る ›</button>
      </div>
      <div id="home-decks">
        ${renderHomeDecksHTML()}
      </div>
      <div class="home-action-row">
        <button class="btn btn-outline action-add" onclick="navigate('upload')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          セット追加
        </button>
        <button class="btn btn-primary" onclick="navigate('question-set')">
          今すぐ復習
          <span class="arrow-fab">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </span>
        </button>
      </div>

      <div class="section-header" style="margin-top:24px">
        <div class="section-title">クイックモード</div>
      </div>
      <div class="learn-shortcut-row">
        <div class="learn-shortcut-card" onclick="navigate('question-set')">
          <div class="learn-shortcut-icon blue">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1D4ED8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </div>
          <div class="learn-shortcut-label">個人学習</div>
          <div class="learn-shortcut-arrow">›</div>
        </div>
        <div class="learn-shortcut-card" onclick="navigate('battle-start')">
          <div class="learn-shortcut-icon red">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
          </div>
          <div class="learn-shortcut-label">対戦モード</div>
          <div class="learn-shortcut-arrow">›</div>
        </div>
      </div>
      <div class="learn-shortcut-row">
        <div class="learn-shortcut-card" onclick="navigate('undefined')">
          <div class="learn-shortcut-icon red">
            <!-- SVG icon for Magic wand -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
          </div>
          <div class="learn-shortcut-label">RPGモード</div>
          <div class="learn-shortcut-arrow">›</div>
        </div>
        <div class="learn-shortcut-card" onclick="navigate('puzzle-room')">
          <div class="learn-shortcut-icon red">
            <!-- SVG icon for Peace of puzzle -->
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>
          </div>
          <div class="learn-shortcut-label">パズルルーム</div>
          <div class="learn-shortcut-arrow">›</div>
        </div>
      </div>
      <div style="height:24px"></div>
    </div>
  </div>`;
}

/* お知らせポップアップ（プロトタイプ用） */
function showNotif() {
  alert('お知らせ\n\n① 田中 太郎さんが対戦を申請しました\n② 新しい問題セットが公開されました\n\n※ プロトタイプのため詳細画面は省略しています');
}