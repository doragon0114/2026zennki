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
      <div class="battle-start-desc">5問4択で他のユーザーと対戦！<br>正解数を競い、ポイントを獲得しよう。</div>
      <div class="battle-start-info">
        <div class="battle-start-info-row">
          <div class="info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="16" rx="2"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="4" y1="10" x2="20" y2="10"/></svg>
          </div>
          <span>出題数：5問</span>
        </div>
        <div class="battle-start-info-row">
          <div class="info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
          </div>
          <span>制限時間：15秒／問</span>
        </div>
        <div class="battle-start-info-row">
          <div class="info-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/><path d="M9 21h6"/><path d="M12 17v4"/></svg>
          </div>
          <span>勝利：+30pt　引き分け：+10pt</span>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%;font-size:17px;padding:18px" onclick="navigate('battle-matching')">
        マッチ開始
        <span class="arrow-fab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
        </span>
      </button>
      <button class="btn btn-ghost" style="width:100%;margin-top:10px" onclick="navigate('home')">キャンセル</button>
    </div>`;
}


/* ============================================================
   対戦マッチング画面
   3.5秒後にランダムで相手を選び対戦を開始する
============================================================ */
function renderBattleMatching() {
  return `
    <div class="screen-header">
      <button class="back-btn" onclick="navigate('battle-start')"></button>
      <div class="header-title">対戦マッチング</div>
      <div style="width:40px"></div>
    </div>
    <div class="matching-screen">
      <div class="matching-vs-row">
        <div class="matching-player-card">
          ${getAvatarHTML(S.user.avatar, 56)}
          <div class="matching-player-name">${esc(S.user.name)}</div>
        </div>
        <div class="matching-vs-badge">VS</div>
        <div class="matching-player-card">
          <div class="matching-opp-placeholder">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <div class="matching-player-name" style="color:var(--text-3)">???</div>
        </div>
      </div>
      <div class="matching-status-text">対戦相手を探しています<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span></div>
      <button class="btn btn-ghost btn-sm" onclick="navigate('battle-start')" style="margin-top:4px">キャンセル</button>
    </div>`;
}

/* TODO(DB担当): ローカルの BATTLE_OPPONENTS の代わりにサーバーのマッチング API を呼ぶ */
function runMatchmaking() {
  setTimeout(()=>{
    const opp       = BATTLE_OPPONENTS[Math.floor(Math.random()*BATTLE_OPPONENTS.length)];
    const battleQs  = shuffle(S.questions).slice(0,5);
    if (battleQs.length<5) { alert('問題が少なすぎます。資料をアップロードして問題を追加してください。'); navigate('battle-start'); return; }
    const oppAnswers = battleQs.map(q=>({ chosen: Math.random()<opp.accuracy ? q.correct : (q.correct+1+Math.floor(Math.random()*3))%4, correct:false }));
    oppAnswers.forEach((a,i)=>{ a.correct = a.chosen===battleQs[i].correct; });
    S.battleSession = { opponent:opp, questions:battleQs, current:0, playerAnswers:[], oppAnswers, playerScore:0, oppScore:oppAnswers.filter(a=>a.correct).length };
    navigate('battle', {});
  }, 3500);
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
  const intro      = document.getElementById('battle-vs-intro');
  const startDelay = intro ? 1550 : 0;
  if (intro) setTimeout(() => { const el = document.getElementById('battle-vs-intro'); if (el) el.remove(); }, 1550);

  setTimeout(() => {
    let t = 15;
    battleTimerInterval = setInterval(() => {
      t--;
      const el = document.getElementById('battle-timer'); if (!el) { clearInterval(battleTimerInterval); return; }
      el.textContent = t;
      if (t <= 5) el.classList.add('timer-urgent');
      if (t <= 0) { clearInterval(battleTimerInterval); answerBattle(-1); }
    }, 1000);
  }, startDelay);
}

function answerBattle(chosen) {
  clearInterval(battleTimerInterval);
  const sess = S.battleSession;
  const q    = sess.questions[sess.current];
  const ok   = chosen !== -1 && chosen === q.correct;
  sess.playerAnswers.push({ chosen, correct: ok });
  if (ok) sess.playerScore++;
  document.getElementById('player-score').textContent = sess.playerScore;

  const oppAns = sess.oppAnswers[sess.current];
  const labels = ['A','B','C','D'];

  document.querySelectorAll('.bchoice-btn').forEach((btn, ci) => {
    btn.classList.add('disabled');
    if (ci === q.correct)          btn.classList.add('correct');
    else if (ci === chosen && !ok) btn.classList.add('wrong');
  });

  const pDot = document.getElementById(`dot-p-${sess.current}`);
  if (pDot) { pDot.className = `pdot pdot-${ok?'correct':'wrong'} pdot-pop`; }
  const oDot = document.getElementById(`dot-o-${sess.current}`);
  if (oDot) { oDot.className = `pdot pdot-${oppAns.correct?'correct':'wrong'} pdot-pop`; }

  const oStatus = document.getElementById('opp-status');
  if (oStatus) oStatus.innerHTML = oppAns.correct
    ? `<span style="color:var(--green);font-weight:700">✓ 正解しました</span>`
    : `<span style="color:var(--red);font-weight:700">✗ 不正解でした</span>`;

  const fb  = document.getElementById('battle-feedback');
  const fbr = document.getElementById('battle-feedback-result');
  const fbe = document.getElementById('battle-feedback-explain');
  fbr.textContent = ok ? '✓ 正解！' : `✗ 不正解（正解：${labels[q.correct]}）`;
  fbr.className   = `bif-result ${ok ? 'correct' : 'wrong'}`;
  fbe.textContent = (oppAns.correct ? `${sess.opponent.name} も正解 ✓` : `${sess.opponent.name} は不正解 ✗`)
    + (q.explanation ? `\n解説: ${q.explanation}` : '');
  const isLast = sess.current + 1 >= sess.questions.length;
  document.getElementById('battle-next-btn').textContent = isLast ? '結果を見る ›' : '次の問題へ →';
  fb.classList.add('show');
}

function nextBattleQ() {
  S.battleSession.current++;
  if (S.battleSession.current >= S.battleSession.questions.length) finishBattle();
  else navigate('battle',{});
}

/* TODO(DB担当): 結果をサーバーに保存し、ランキングを更新する */
function finishBattle() {
  clearInterval(battleTimerInterval);
  const sess = S.battleSession;
  if (sess.playerScore>sess.oppScore) { S.user.wins++; S.user.points+=150; }
  else if (sess.playerScore===sess.oppScore) { S.user.points+=50; }
  save();
  navigate('battle-result',{});
}

/* 獲得ポイントを 0 からカウントアップする */
function startPointCountUp() {
  const sess = S.battleSession; if (!sess) return;
  const outcome = sess.playerScore > sess.oppScore ? 'win' : sess.playerScore === sess.oppScore ? 'draw' : 'lose';
  const target  = outcome === 'win' ? 150 : outcome === 'draw' ? 50 : 0;
  if (target === 0) return;
  const el = document.getElementById('battle-result-pts');
  if (!el) return;
  el.textContent = '+0pt';
  let n = 0;
  const iv = setInterval(() => {
    n = Math.min(n + Math.ceil(target / 25), target);
    el.textContent = `+${n}pt`;
    if (n >= target) clearInterval(iv);
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
  const ptGain     = outcome==='win' ? 150 : outcome==='draw' ? 50 : 0;
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
  const MOCK_HISTORY = [
    { date:'2026/05/18', opponent:'田中 太郎',   avatar:'🐧', result:'win',  myScore:4, oppScore:2, pts:+30 },
    { date:'2026/05/17', opponent:'鈴木 花子',   avatar:'🦊', result:'lose', myScore:2, oppScore:4, pts:-10 },
    { date:'2026/05/17', opponent:'山田 一郎',   avatar:'🐻', result:'win',  myScore:5, oppScore:1, pts:+30 },
    { date:'2026/05/16', opponent:'佐藤 美咲',   avatar:'🐱', result:'draw', myScore:3, oppScore:3, pts:+10 },
    { date:'2026/05/15', opponent:'伊藤 健太',   avatar:'🐼', result:'lose', myScore:1, oppScore:5, pts:-10 },
    { date:'2026/05/14', opponent:'渡辺 さくら', avatar:'🦋', result:'win',  myScore:4, oppScore:3, pts:+30 },
    { date:'2026/05/13', opponent:'田中 太郎',   avatar:'🐧', result:'win',  myScore:5, oppScore:0, pts:+30 },
  ];

  const wins  = MOCK_HISTORY.filter(h=>h.result==='win').length;
  const loses = MOCK_HISTORY.filter(h=>h.result==='lose').length;
  const draws = MOCK_HISTORY.filter(h=>h.result==='draw').length;
  const resultLabel = { win:'勝利', lose:'敗北', draw:'引き分け' };
  const resultClass = { win:'bh-win', lose:'bh-lose', draw:'bh-draw' };

  const rows = MOCK_HISTORY.map(h => `
    <div class="bh-row">
      <div class="bh-avatar">${getAvatarHTML(h.avatar,36)}</div>
      <div class="bh-info">
        <div class="bh-opponent">${esc(h.opponent)}</div>
        <div class="bh-date">${h.date}</div>
      </div>
      <div class="bh-score">${h.myScore} - ${h.oppScore}</div>
      <div class="bh-result ${resultClass[h.result]}">${resultLabel[h.result]}</div>
      <div class="bh-pts ${h.pts>0?'bh-pts-pos':h.pts<0?'bh-pts-neg':'bh-pts-zero'}">${h.pts>0?'+':''}${h.pts}pt</div>
    </div>`).join('');

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="navigate('mypage')"></button>
      <div class="header-title">対戦履歴</div>
      <div style="width:40px"></div>
    </div>
    <div class="screen-body">
      <div class="bh-summary">
        <div class="bh-summary-item"><div class="bh-summary-num win">${wins}</div><div class="bh-summary-lbl">勝利</div></div>
        <div class="bh-summary-sep"></div>
        <div class="bh-summary-item"><div class="bh-summary-num draw">${draws}</div><div class="bh-summary-lbl">引き分け</div></div>
        <div class="bh-summary-sep"></div>
        <div class="bh-summary-item"><div class="bh-summary-num lose">${loses}</div><div class="bh-summary-lbl">敗北</div></div>
      </div>
      <div class="bh-list">${rows}</div>
    </div>`;
}
