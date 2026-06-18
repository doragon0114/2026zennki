/* ============================================================
   battle.js — 対戦モード関連画面すべて
   ─────────────────────────────────────────────────────────────
   担当: 対戦・マッチング担当

   画面一覧:
     ・renderBattleStart()    … 対戦開始画面（ルール説明）
     ・renderBattleMatching() … マッチング中画面
     ・renderBattle()         … 対戦中画面（問題回答）
     ・renderBattleResult()   … 対戦結果画面
     ・renderBattleHistory()  … 対戦履歴画面

   TODO（DB担当者へ）:
     ・runMatchmaking()  : ランダムなローカル相手の代わりにサーバーのマッチング API を呼ぶ
     ・finishBattle()    : 結果をサーバーに保存し、ランキングを更新する
     ・renderBattleHistory(): MOCK_HISTORY をサーバーから取得した実データに差し替える
============================================================ */


/* ============================================================
   対戦モード開始画面
============================================================ */
function renderBattleStart() {
  const savedSubject = localStorage.getItem("revino_battle_subject") || "math";
  const savedAge = localStorage.getItem("revino_battle_age") || "15";

  const option = (value, label) => {
    return `<option value="${value}" ${savedSubject === value ? "selected" : ""}>${label}</option>`;
  };

  return `
    <div class="battle-start-screen">
      <div class="screen-header red-bg" style="position:absolute;top:0;left:0;right:0;padding:18px 20px 12px;backdrop-filter:none;background:transparent;z-index:2">
        <button class="back-btn" onclick="navigate('home')"></button>
        <div class="header-title">対戦モード</div>
        <div style="width:40px"></div>
      </div>

      <div style="height:42px"></div>

      <div class="battle-start-emblem">
        <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 50l24-24"/><path d="M10 50h8v-8"/>
          <path d="M50 50L26 26"/><path d="M54 50h-8v-8"/>
          <path d="M40 16l-4 4 8 8 4-4z" fill="currentColor" fill-opacity="0.15"/>
          <path d="M24 16l4 4-8 8-4-4z" fill="currentColor" fill-opacity="0.15"/>
          <circle cx="32" cy="32" r="3" fill="currentColor"/>
        </svg>
      </div>

      <div class="battle-start-title">対戦モード</div>
      <div class="battle-start-desc">
        5問4択で他のユーザーと対戦！<br>
        正解数を競い、ポイントを獲得しよう。
      </div>

      <div class="battle-start-info">
        <div class="battle-start-info-row">
          <div class="info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="5" width="16" height="16" rx="2"/>
              <line x1="8" y1="3" x2="8" y2="7"/>
              <line x1="16" y1="3" x2="16" y2="7"/>
              <line x1="4" y1="10" x2="20" y2="10"/>
            </svg>
          </div>
          <span>出題数：5問</span>
        </div>

        <div class="battle-start-info-row">
          <div class="info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="9"/>
              <polyline points="12 7 12 12 15 14"/>
            </svg>
          </div>
          <span>制限時間：15秒／問</span>
        </div>

        <div class="battle-start-info-row">
          <div class="info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/>
              <path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
              <path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/>
              <path d="M9 21h6"/>
              <path d="M12 17v4"/>
            </svg>
          </div>
          <span>勝利：+${BATTLE_POINT_WIN}pt　引き分け：+${BATTLE_POINT_DRAW}pt</span>
        </div>

        <div class="battle-start-info-row">
          <div class="info-icon">
            ${svg(IC.bookOpen, 18)}
          </div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:900;margin-bottom:6px">教科</div>
            <select id="battle-subject" class="form-input" onchange="saveBattleSettings()">
              ${option("japanese", "国語")}
              ${option("math", "数学")}
              ${option("english", "英語")}
              ${option("science", "理科")}
              ${option("social", "社会")}
            </select>
          </div>
        </div>

        <div class="battle-start-info-row">
          <div class="info-icon">
            ${svg(IC.user, 18)}
          </div>
          <div style="flex:1">
            <div style="font-size:12px;font-weight:900;margin-bottom:6px">年齢</div>
            <input
              id="battle-age"
              class="form-input"
              type="number"
              min="1"
              max="120"
              value="${esc(savedAge)}"
              onchange="saveBattleSettings()"
            >
          </div>
        </div>
      </div>

      <button class="btn btn-primary" style="width:100%;font-size:17px;padding:18px" onclick="navigate('battle-matching')">
        マッチ開始
        <span class="arrow-fab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        </span>
      </button>

      <button class="btn btn-ghost" style="width:100%;margin-top:10px" onclick="navigate('home')">
        キャンセル
      </button>
    </div>`;
}


/* ============================================================
   対戦マッチング画面
   3.5秒後にランダムで相手を選び対戦を開始する
============================================================ */
function renderBattleMatching() {
  return `
    <div class="screen-header">
      <button class="back-btn" onclick="cancelBattleMatching()"></button>
      <div class="header-title">対戦マッチング</div>
      <div style="width:40px"></div>
    </div>

    <div class="matching-screen">
      <div class="matching-vs-row">
        <div class="matching-player-card">
          ${getAvatarHTML(S.user.avatar, 56)}
          <div class="matching-player-name">${esc(S.user.name || S.user.username || "YOU")}</div>
        </div>

        <div class="matching-vs-badge">VS</div>

        <div class="matching-player-card">
          <div class="matching-opp-placeholder">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div class="matching-player-name" style="color:var(--text-3)">???</div>
        </div>
      </div>

      <div class="matching-status-text">
        対戦相手を探しています<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
      </div>

      <div id="battle-matching-status" class="battle-status-message">
        サーバーに接続しています。
      </div>

      <button class="btn btn-ghost btn-sm" onclick="cancelBattleMatching()" style="margin-top:4px">
        キャンセル
      </button>
    </div>`;
}

/* TODO(DB担当): ローカルの BATTLE_OPPONENTS の代わりにサーバーのマッチング API を呼ぶ */
async function runMatchmaking() {
  try {
    saveBattleSettings();

    const subject = getBattleSubject();
    const age = getBattleAge();

    updateBattleMatchingStatus(`${BATTLE_SUBJECT_LABELS[subject]} / ${age}歳で接続中です。`);

    await getBattleSocket();

    updateBattleMatchingStatus(`${BATTLE_SUBJECT_LABELS[subject]} / ${age}歳で相手を探しています。`);

    const userId = S.user?.userId || S.user?.id;

    if (!userId) {
      alert("ログイン情報が確認できないため、対戦できません。");
      navigate("battle-start");
      return;
    }

    sendBattleMessage({
      type: "join",
      userId,
      name: S.user.name || S.user.username || "ゲスト",
      age,
      subject,
      avatar: S.user.avatar || "🐧"
    });
  } catch {
    alert("対戦サーバーに接続できませんでした。");
    navigate("battle-start");
  }
}


let battleWs = null;
let battlePlayerId = null;
let battleRoomId = null;
let battleWaitingResult = false;
let battleHistoryLoaded = false;
let battleHistoryLoading = false;
let battleHistoryItems = [];

const BATTLE_POINT_WIN = 30;
const BATTLE_POINT_DRAW = 10;

const BATTLE_SUBJECT_LABELS = {
  japanese: "国語",
  math: "数学",
  english: "英語",
  science: "理科",
  social: "社会"
};

async function loadBattleHistoryFromServer(force = false) {
  if (battleHistoryLoading) {
    return;
  }

  if (battleHistoryLoaded && !force) {
    return;
  }

  battleHistoryLoading = true;

  try {
    const userId = encodeURIComponent(S.user.userId || S.user.id || S.user.email || S.user.name || "");

    const response = await fetch(`/api/battle/history?userId=${userId}`);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "対戦履歴の取得に失敗しました");
    }

    battleHistoryItems = Array.isArray(data.history) ? data.history : [];
    battleHistoryLoaded = true;

    const loadingEl = document.getElementById("battle-history-loading");
    if (loadingEl) {
      navigate("battle-history");
    }
  } catch {
    const loadingEl = document.getElementById("battle-history-loading");

    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;color:var(--gray)">
          <div class="empty-icon-wrap">${svg(IC.swords,48)}</div>
          <div style="font-size:15px;font-weight:800;color:var(--dark);margin-bottom:6px">
            対戦履歴を取得できませんでした
          </div>
          <button class="btn btn-primary mt16" onclick="loadBattleHistoryFromServer(true)">
            再読み込み
          </button>
        </div>
      `;
    }
  } finally {
    battleHistoryLoading = false;
  }
}

function getBattleSubject() {
  const el = document.getElementById("battle-subject");
  return el ? el.value : localStorage.getItem("revino_battle_subject") || "math";
}

function getBattleAge() {
  const el = document.getElementById("battle-age");
  const value = el ? Number(el.value) : Number(localStorage.getItem("revino_battle_age") || 15);

  if (!Number.isInteger(value) || value < 1 || value > 120) {
    return 15;
  }

  return value;
}

function saveBattleSettings() {
  localStorage.setItem("revino_battle_subject", getBattleSubject());
  localStorage.setItem("revino_battle_age", String(getBattleAge()));
}

function closeBattleSocket() {
  if (battleWs && battleWs.readyState === WebSocket.OPEN) {
    battleWs.send(JSON.stringify({ type: "leave" }));
    battleWs.close();
  }

  battleWs = null;
  battlePlayerId = null;
  battleRoomId = null;
  battleWaitingResult = false;
}

function getBattleSocket() {
  return new Promise((resolve, reject) => {
    if (battleWs && battleWs.readyState === WebSocket.OPEN) {
      resolve(battleWs);
      return;
    }

    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    battleWs = new WebSocket(`${protocol}//${location.host}/ws/battle`);

    battleWs.addEventListener("open", () => {
      resolve(battleWs);
    });

    battleWs.addEventListener("message", event => {
      const data = JSON.parse(event.data);
      handleBattleServerMessage(data);
    });

    battleWs.addEventListener("close", () => {
      battleWs = null;
    });

    battleWs.addEventListener("error", () => {
      reject(new Error("WebSocket接続に失敗しました"));
    });
  });
}

function sendBattleMessage(data) {
  if (!battleWs || battleWs.readyState !== WebSocket.OPEN) {
    return false;
  }

  battleWs.send(JSON.stringify(data));
  return true;
}

function updateBattleMatchingStatus(message) {
  const el = document.getElementById("battle-matching-status");

  if (el) {
    el.textContent = message;
  }
}

function cancelBattleMatching() {
  closeBattleSocket();
  navigate("battle-start");
}

/* ============================================================
   対戦中画面
   スコア・進行ドット・タイマー・問題カードを表示する
============================================================ */
function renderBattle() {
  const sess = S.battleSession; if(!sess) { navigate('battle-matching'); return ''; }
  const { questions, current, opponent, playerScore, oppScore, playerAnswers, oppAnswers } = sess;
  const q      = questions[current];
  const labels = ['A','B','C','D'];

  const makeDots = (isPlayer) => questions.map((_,i) => {
    let state = 'empty';
    if (i < current) {
      const a = isPlayer ? playerAnswers[i] : oppAnswers[i];
      state = a.correct ? 'correct' : 'wrong';
    } else if (i === current) {
      state = isPlayer ? 'current' : 'opp-current';
    }
    return `<div class="pdot pdot-${state}" id="dot-${isPlayer?'p':'o'}-${i}"></div>`;
  }).join('');

  const vsIntro = current === 0 ? `
    <div class="battle-vs-intro" id="battle-vs-intro">
      <div class="bvi-side">
        ${getAvatarHTML(S.user.avatar, 60)}
        <div class="bvi-name">${esc(S.user.name)}</div>
      </div>
      <div class="bvi-vs">VS</div>
      <div class="bvi-side">
        ${getAvatarHTML(opponent.avatar, 60)}
        <div class="bvi-name">${esc(opponent.name)}</div>
      </div>
    </div>` : '';

  return `
    ${vsIntro}
    <div class="battle-screen">
      <div class="battle-status-bar">
        <div class="battle-q-label">Q${current+1} <span class="bql-total">/ ${questions.length}</span></div>
        <div class="battle-in-progress">対戦中</div>
        <div class="battle-timer-pill" id="battle-timer">15</div>
      </div>

      <div class="battle-scores-section">
        <div class="battle-score-bloc">
          <div class="bsb-top">
            ${getAvatarHTML(S.user.avatar, 32)}
            <div class="bsb-name">${esc(S.user.name)}</div>
          </div>
          <div class="bsb-num" id="player-score">${playerScore}</div>
          <div class="bsb-dots">${makeDots(true)}</div>
        </div>
        <div class="bsb-vs">VS</div>
        <div class="battle-score-bloc">
          <div class="bsb-top">
            ${getAvatarHTML(opponent.avatar, 32)}
            <div class="bsb-name">${esc(opponent.name)}</div>
          </div>
          <div class="bsb-num opp" id="opp-score">${oppScore}</div>
          <div class="bsb-dots">${makeDots(false)}</div>
        </div>
      </div>

      <div class="battle-q-card fade-in">
        <div class="battle-q-text">${esc(q.text)}</div>
        <div class="battle-choices-grid" id="battle-choices">
          ${q.choices.map((c,ci)=>`
            <button class="bchoice-btn" id="bchoice-${ci}" onclick="answerBattle(${ci})">
              <span class="bchoice-lbl">${labels[ci]}</span>
              <span class="bchoice-text">${esc(c)}</span>
            </button>`).join('')}
        </div>
        <div class="battle-inline-feedback" id="battle-feedback">
          <div class="bif-result" id="battle-feedback-result"></div>
          <div class="bif-explain" id="battle-feedback-explain"></div>
          <button class="btn btn-primary bif-next-btn" id="battle-next-btn" onclick="nextBattleQ()">次の問題へ →</button>
        </div>
      </div>

      <div class="battle-opp-status">
        ${getAvatarHTML(opponent.avatar, 24)}
        <span id="opp-status"><span class="opp-thinking-text">相手が回答中</span><span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span></span>
      </div>
    </div>`;
}

/* Q1 の VS イントロが終わってからタイマーを開始する（1問あたり15秒） */
function startBattleTimer() {
  clearInterval(battleTimerInterval);

  const sess = S.battleSession;

  if (!sess) {
    return;
  }

  const intro = document.getElementById("battle-vs-intro");
  const startDelay = intro ? 1550 : 0;

  if (intro) {
    setTimeout(() => {
      const el = document.getElementById("battle-vs-intro");
      if (el) {
        el.remove();
      }
    }, 1550);
  }

  setTimeout(() => {
    let t = sess.timeLimit || 15;

    const timerEl = document.getElementById("battle-timer");

    if (timerEl) {
      timerEl.textContent = t;
    }

    battleTimerInterval = setInterval(() => {
      t--;

      const el = document.getElementById("battle-timer");

      if (!el) {
        clearInterval(battleTimerInterval);
        return;
      }

      el.textContent = t;

      if (t <= 5) {
        el.classList.add("timer-urgent");
      }

      if (t <= 0) {
        clearInterval(battleTimerInterval);

        if (!battleWaitingResult) {
          answerBattle(-1);
        }
      }
    }, 1000);
  }, startDelay);
}

function answerBattle(chosen) {
  if (battleWaitingResult) {
    return;
  }

  battleWaitingResult = true;
  clearInterval(battleTimerInterval);

  document.querySelectorAll(".bchoice-btn").forEach(btn => {
    btn.classList.add("disabled");
    btn.disabled = true;
  });

  const ok = sendBattleMessage({
    type: "submitAnswer",
    answer: chosen
  });

  if (!ok) {
    alert("サーバーとの接続が切れています。");
    navigate("battle-start");
    return;
  }

  const oStatus = document.getElementById("opp-status");

  if (oStatus) {
    oStatus.innerHTML = `
      <span class="opp-thinking-text">相手の回答を待っています</span>
      <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
    `;
  }
}

function nextBattleQ() {
  const btn = document.getElementById("battle-next-btn");

  if (btn) {
    btn.disabled = true;
    btn.textContent = "相手を待っています...";
  }

  sendBattleMessage({
    type: "readyNext"
  });
}

/* TODO(DB担当): 結果をサーバーに保存し、ランキングを更新する */
function finishBattle() {
  clearInterval(battleTimerInterval);
  navigate("battle-result", {});
}

/* 獲得ポイントを 0 からカウントアップする */
function startPointCountUp() {
  const sess = S.battleSession;

  if (!sess) {
    return;
  }

  const outcome = sess.playerScore > sess.oppScore
    ? "win"
    : sess.playerScore === sess.oppScore
      ? "draw"
      : "lose";

  const target = outcome === "win"
    ? BATTLE_POINT_WIN
    : outcome === "draw"
      ? BATTLE_POINT_DRAW
      : 0;

  if (target === 0) {
    return;
  }

  const el = document.getElementById("battle-result-pts");

  if (!el) {
    return;
  }

  el.textContent = "+0pt";

  let n = 0;

  const iv = setInterval(() => {
    n = Math.min(n + Math.ceil(target / 20), target);
    el.textContent = `+${n}pt`;

    if (n >= target) {
      clearInterval(iv);
    }
  }, 28);
}


/* ============================================================
   対戦結果画面
============================================================ */
function renderBattleResult() {
  const sess = S.battleSession; if(!sess){navigate('home');return'';}
  const { opponent, questions, playerAnswers, oppAnswers, playerScore, oppScore } = sess;
  const labels     = ['A','B','C','D'];
  const outcome    = playerScore>oppScore ? 'win' : playerScore===oppScore ? 'draw' : 'lose';
  const outcomeText = outcome==='win' ? 'WIN' : outcome==='draw' ? 'DRAW' : 'LOSE';
  const ptGain = outcome === "win"
  ? BATTLE_POINT_WIN
  : outcome === "draw"
    ? BATTLE_POINT_DRAW
    : 0;
  const wrongByOpp = questions.filter((q,i)=>!oppAnswers[i].correct && playerAnswers[i]?.correct);

  const rows = questions.map((q,i)=>{
    const pa=playerAnswers[i]; const oa=oppAnswers[i];
    return `<tr><td>${esc(q.text.length>22?q.text.slice(0,22)+'…':q.text)}</td><td class="${pa?.correct?'tc':'tx'}">${pa?.correct?'○':'✗'}</td><td class="${oa?.correct?'tc':'tx'}">${oa?.correct?'○':'✗'}</td></tr>`;
  }).join('');

  const teachSection = wrongByOpp.length>0 ? `
    <div class="section-heading-icon">${svg(IC.bookOpen,16)} 教え合い機能</div>
    ${wrongByOpp.map(q=>`
      <div class="teach-box">
        <div class="teach-box-title">${svg(IC.lightbulb,15)} ${esc(opponent.name)} に教えてあげよう！</div>
        <div class="teach-box-text"><strong>${esc(q.text)}</strong><br>正解: ${labels[q.correct]}. ${esc(q.choices[q.correct])}${q.explanation?`<br><small style="color:var(--gray)">${esc(q.explanation)}</small>`:''}</div>
      </div>`).join('')}` : '';

  return `
    <div class="battle-result-screen">
      <div class="br-hero ${outcome}">
        <div class="br-hero-label">対戦結果</div>
        <div class="br-outcome-text">${outcomeText}</div>
        <div class="br-pts" id="battle-result-pts">${ptGain>0?`+${ptGain}pt`:'+0pt'}</div>
        <div class="br-score-compare">
          <div class="br-score-side">
            ${getAvatarHTML(S.user.avatar, 36)}
            <div class="br-score-name">${esc(S.user.name)}</div>
            <div class="br-score-num mine">${playerScore}</div>
          </div>
          <div class="br-score-vs">VS</div>
          <div class="br-score-side">
            ${getAvatarHTML(opponent.avatar, 36)}
            <div class="br-score-name">${esc(opponent.name)}</div>
            <div class="br-score-num theirs">${oppScore}</div>
          </div>
        </div>
      </div>
      <div class="screen-body">
        <div class="section-heading-icon">${svg(IC.barChart,16)} 問題別結果</div>
        <div class="card" style="padding:0;overflow:hidden">
          <table class="battle-review-table">
            <thead><tr><th>問題</th><th>${esc(S.user.name)}</th><th>${getAvatarHTML(opponent.avatar,22)}</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${teachSection}
        <div class="flex-row mt16">
          <button class="btn btn-danger" onclick="navigate('battle-matching')">もう一度対戦</button>
          <button class="btn btn-primary" onclick="navigate('home')">ホームへ戻る</button>
        </div>
      </div>
    </div>`;
}


/* ============================================================
   対戦履歴画面
   TODO(DB担当): MOCK_HISTORY をサーバーから取得した実データに差し替える
============================================================ */
function renderBattleHistory() {
  if (!battleHistoryLoaded) {
    setTimeout(() => {
      loadBattleHistoryFromServer(true);
    }, 0);

    return `
      <div class="screen-header">
        <button class="back-btn" onclick="navigate('mypage')"></button>
        <div class="header-title">対戦履歴</div>
        <div style="width:40px"></div>
      </div>

      <div class="screen-body" id="battle-history-loading">
        <div style="text-align:center;padding:60px 20px;color:var(--gray)">
          <div class="empty-icon-wrap">${svg(IC.swords,48)}</div>
          <div style="font-size:15px;font-weight:800;color:var(--dark);margin-bottom:6px">
            対戦履歴を読み込み中です
          </div>
          <div style="font-size:13px">
            サーバーから履歴を取得しています...
          </div>
        </div>
      </div>
    `;
  }

  const history = battleHistoryItems;

  const wins = history.filter(h => h.result === "win").length;
  const loses = history.filter(h => h.result === "lose").length;
  const draws = history.filter(h => h.result === "draw").length;

  const resultLabel = {
    win: "勝利",
    lose: "敗北",
    draw: "引き分け"
  };

  const resultClass = {
    win: "bh-win",
    lose: "bh-lose",
    draw: "bh-draw"
  };

  const rows = history.length === 0
    ? `
      <div style="text-align:center;padding:60px 20px;color:var(--gray)">
        <div class="empty-icon-wrap">${svg(IC.swords,48)}</div>
        <div style="font-size:15px;font-weight:800;color:var(--dark);margin-bottom:6px">
          対戦履歴がありません
        </div>
        <div style="font-size:13px">
          対戦をするとここに履歴が表示されます
        </div>
        <button class="btn btn-danger mt16" onclick="navigate('battle-start')">
          対戦する
        </button>
      </div>
    `
    : history.map(h => `
      <div class="bh-row">
        <div class="bh-avatar">${getAvatarHTML(h.avatar || "🤖", 36)}</div>

        <div class="bh-info">
          <div class="bh-opponent">${esc(h.opponent || "対戦相手")}</div>
          <div class="bh-date">${esc(h.date || "")}</div>
        </div>

        <div class="bh-score">${Number(h.myScore || 0)} - ${Number(h.oppScore || 0)}</div>

        <div class="bh-result ${resultClass[h.result] || "bh-draw"}">
          ${resultLabel[h.result] || "引き分け"}
        </div>

        <div class="bh-pts ${Number(h.pts || 0) > 0 ? "bh-pts-pos" : Number(h.pts || 0) < 0 ? "bh-pts-neg" : "bh-pts-zero"}">
          ${Number(h.pts || 0) > 0 ? "+" : ""}${Number(h.pts || 0)}pt
        </div>
      </div>
    `).join("");

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="navigate('mypage')"></button>
      <div class="header-title">対戦履歴</div>
      <button class="header-action" onclick="refreshBattleHistory()">更新</button>
    </div>

    <div class="screen-body">
      <div class="bh-summary">
        <div class="bh-summary-item">
          <div class="bh-summary-num win">${wins}</div>
          <div class="bh-summary-lbl">勝利</div>
        </div>
        <div class="bh-summary-sep"></div>
        <div class="bh-summary-item">
          <div class="bh-summary-num draw">${draws}</div>
          <div class="bh-summary-lbl">引き分け</div>
        </div>
        <div class="bh-summary-sep"></div>
        <div class="bh-summary-item">
          <div class="bh-summary-num lose">${loses}</div>
          <div class="bh-summary-lbl">敗北</div>
        </div>
      </div>

      <div class="bh-list">${rows}</div>
    </div>
  `;
}

function refreshBattleHistory() {
  battleHistoryLoaded = false;
  loadBattleHistoryFromServer(true);
}

function handleBattleServerMessage(data) {
  switch (data.type) {
    case "connected":
      battlePlayerId = data.playerId;
      break;

    case "joined":
      updateBattleMatchingStatus(
        `${data.subjectLabel || ""} / ${data.age || ""}歳で相手を探しています。`
      );
      break;

    case "waiting":
      updateBattleMatchingStatus(data.message || "対戦相手を探しています。");
      break;

    case "matched":
      handleBattleMatched(data);
      break;

    case "question":
      handleBattleQuestion(data);
      break;

    case "answerAccepted":
      updateOpponentStatus("相手の回答を待っています");
      break;

    case "waitingNext":
      updateOpponentStatus(data.message || "相手を待っています");
      break;

    case "answerResult":
      handleBattleAnswerResult(data);
      break;

    case "finished":
      handleBattleFinished(data);
      break;

    case "opponentLeft":
      alert(data.message || "相手が退出しました。");
      closeBattleSocket();
      navigate("battle-start");
      break;

    case "error":
      alert(data.message || "対戦エラーが発生しました。");
      navigate("battle-start");
      break;

    default:
      break;
  }
}

function updateOpponentStatus(message) {
  const el = document.getElementById("opp-status");

  if (!el) {
    return;
  }

  el.innerHTML = `
    <span class="opp-thinking-text">${esc(message)}</span>
    <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
  `;
}

function handleBattleMatched(data) {
  battleRoomId = data.roomId;

  const opponent = data.players.find(player => player.id !== battlePlayerId);

  S.battleSession = {
    roomId: data.roomId,
    subject: data.subject,
    subjectLabel: data.subjectLabel,
    age: data.age,
    opponent: {
      id: opponent?.id,
      name: opponent?.name || "RIVAL",
      avatar: opponent?.avatar || "🤖"
    },
    questions: [],
    current: 0,
    playerAnswers: [],
    oppAnswers: [],
    playerScore: 0,
    oppScore: 0,
    timeLimit: 15,
    pointsApplied: false
  };

  updateBattleMatchingStatus("相手が見つかりました。問題を準備しています。");
}

function handleBattleQuestion(data) {
  battleWaitingResult = false;

  if (!S.battleSession) {
    return;
  }

  const questionIndex = data.index - 1;
  const scores = data.scores || {};
  const opponentId = S.battleSession.opponent.id;

  S.battleSession.current = questionIndex;
  S.battleSession.timeLimit = data.timeLimit || 15;

  S.battleSession.questions[questionIndex] = {
    id: data.question.id,
    text: data.question.text,
    choices: data.question.choices,
    correct: null,
    explanation: ""
  };

  S.battleSession.playerScore = scores[battlePlayerId] || 0;
  S.battleSession.oppScore = scores[opponentId] || 0;

  navigate("battle", {});
}

function handleBattleAnswerResult(data) {
  battleWaitingResult = false;
  clearInterval(battleTimerInterval);

  const sess = S.battleSession;

  if (!sess) {
    return;
  }

  const index = data.index - 1;
  const question = sess.questions[index];

  if (!question) {
    return;
  }

  const opponentId = sess.opponent.id;

  const myAnswer = data.answers[battlePlayerId] || {
    chosen: -1,
    correct: false
  };

  const oppAnswer = data.answers[opponentId] || {
    chosen: -1,
    correct: false
  };

  question.correct = data.correctIndex;
  question.explanation = data.explanation || "";

  sess.playerAnswers[index] = myAnswer;
  sess.oppAnswers[index] = oppAnswer;

  sess.playerScore = data.scores[battlePlayerId] || 0;
  sess.oppScore = data.scores[opponentId] || 0;

  showBattleFeedbackFromServer(data, myAnswer, oppAnswer);
}

function showBattleFeedbackFromServer(data, myAnswer, oppAnswer) {
  const sess = S.battleSession;
  const labels = ["A", "B", "C", "D"];

  const playerScoreEl = document.getElementById("player-score");
  const oppScoreEl = document.getElementById("opp-score");

  if (playerScoreEl) {
    playerScoreEl.textContent = sess.playerScore;
  }

  if (oppScoreEl) {
    oppScoreEl.textContent = sess.oppScore;
  }

  document.querySelectorAll(".bchoice-btn").forEach((btn, ci) => {
    btn.classList.add("disabled");
    btn.disabled = true;

    if (ci === data.correctIndex) {
      btn.classList.add("correct");
    } else if (ci === myAnswer.chosen && !myAnswer.correct) {
      btn.classList.add("wrong");
    }
  });

  const pDot = document.getElementById(`dot-p-${sess.current}`);

  if (pDot) {
    pDot.className = `pdot pdot-${myAnswer.correct ? "correct" : "wrong"} pdot-pop`;
  }

  const oDot = document.getElementById(`dot-o-${sess.current}`);

  if (oDot) {
    oDot.className = `pdot pdot-${oppAnswer.correct ? "correct" : "wrong"} pdot-pop`;
  }

  const oStatus = document.getElementById("opp-status");

  if (oStatus) {
    oStatus.innerHTML = oppAnswer.correct
      ? `<span style="color:var(--green);font-weight:700">✓ 正解しました</span>`
      : `<span style="color:var(--red);font-weight:700">✗ 不正解でした</span>`;
  }

  const fb = document.getElementById("battle-feedback");
  const fbr = document.getElementById("battle-feedback-result");
  const fbe = document.getElementById("battle-feedback-explain");
  const nextBtn = document.getElementById("battle-next-btn");

  if (!fb || !fbr || !fbe || !nextBtn) {
    return;
  }

  fbr.textContent = myAnswer.correct
    ? "✓ 正解！"
    : `✗ 不正解（正解：${labels[data.correctIndex]}）`;

  fbr.className = `bif-result ${myAnswer.correct ? "correct" : "wrong"}`;

  fbe.textContent = (oppAnswer.correct
    ? `${sess.opponent.name} も正解 ✓`
    : `${sess.opponent.name} は不正解 ✗`)
    + (data.explanation ? `\n解説: ${data.explanation}` : "");

  nextBtn.textContent = data.isLast ? "結果を見る ›" : "次の問題へ →";
  nextBtn.disabled = false;

  fb.classList.add("show");
}

function handleBattleFinished(data) {
  const sess = S.battleSession;

  if (!sess) {
    return;
  }

  const scores = data.scores || {};
  const opponentId = sess.opponent.id;

  sess.playerScore = scores[battlePlayerId] || 0;
  sess.oppScore = scores[opponentId] || 0;

  const outcome = sess.playerScore > sess.oppScore
    ? "win"
    : sess.playerScore === sess.oppScore
      ? "draw"
      : "lose";

  if (!sess.pointsApplied) {
    if (outcome === "win") {
      S.user.wins = Number(S.user.wins || 0) + 1;
      S.user.points = Number(S.user.points || 0) + BATTLE_POINT_WIN;
    } else if (outcome === "draw") {
      S.user.points = Number(S.user.points || 0) + BATTLE_POINT_DRAW;
    }

    sess.pointsApplied = true;
    save();
  }

  battleHistoryLoaded = false;

  navigate("battle-result", {});
}
