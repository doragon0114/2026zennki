/* ============================================================
   study.js — 個人学習（問題集選択・問題回答・結果）画面
   ─────────────────────────────────────────────────────────────
   担当: フロントエンド担当

   TODO（DB担当者へ）:
     ・finishStudy(): 学習結果をサーバーに保存する
       現在は S.user.totalStudied++ → save() だけだが、
       本番では API 経由でユーザーの学習履歴をサーバー保存する
============================================================ */


/* ============================================================
   問題集選択画面
   カテゴリフィルターで絞り込み、学習する問題セットを選ぶ
============================================================ */
function renderQuestionSet() {
  const categories = ['すべて', ...new Set(S.questions.map(q=>q.category))];
  const filtered   = S.studyFilter==='すべて' ? S.questions : S.questions.filter(q=>q.category===S.studyFilter);
  const sets       = S.materials.map(m=>({ mat:m, qs:filtered.filter(q=>q.materialId===m.id) })).filter(x=>x.qs.length>0);
  const icons      = [svg(IC.leaf,22),svg(IC.bookOpen,22),svg(IC.flask,22),svg(IC.globe,22),svg(IC.pencil,22),svg(IC.dna,22)];
  const badges     = ['badge-gold','badge-silver','badge-bronze'];

  const chips = categories.map(c=>`<button class="chip ${c===S.studyFilter?'active':''}" onclick="setStudyFilter('${esc(c)}')">${esc(c)}</button>`).join('');
  const cards = sets.length === 0
    ? `<div style="text-align:center;padding:60px 20px;color:var(--gray)">
        <div class="empty-icon-wrap">${svg(IC.inbox,48)}</div>
        <div style="font-size:15px;font-weight:800;color:var(--dark);margin-bottom:6px">問題がありません</div>
        <div style="font-size:13px">別のカテゴリを選ぶか資料を追加しましょう</div>
       </div>`
    : sets.map((x,i)=>`
        <div class="qset-card" onclick='startStudy(${JSON.stringify(x.qs.map(q=>q.id))})'>
          <div class="qset-icon color-${i%6}">${icons[i%icons.length]}</div>
          <div class="qset-info">
            <div class="qset-title">${esc(x.mat.name)}</div>
            <div style="margin:3px 0"><span class="tag tag-sky">高校</span><span class="tag tag-green">中級</span></div>
            <div class="qset-meta">${x.qs.length}問 ・ ${[...new Set(x.qs.map(q=>q.category))].join('・')}</div>
          </div>
          <div class="qset-badge ${badges[i%badges.length]}">${['A','B','C'][i%3]}</div>
        </div>`).join('');

  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('home')">←</button>
      <div class="header-title">問題集を選択</div>
    </div>
    <div class="category-chips">${chips}</div>
    <div class="screen-body" style="padding-top:8px">${cards}</div>`;
}

function setStudyFilter(cat) { S.studyFilter=cat; navigate('question-set'); }

/* 学習セッションを開始する */
function startStudy(qids) {
  const qs = qids.map(id=>S.questions.find(q=>q.id===id)).filter(Boolean);
  if (!qs.length) { alert('問題がありません'); return; }
  S.studySession = { questions:shuffle(qs), current:0, answers:[], startTime:Date.now() };
  navigate('question', { mode:'study' });
}


/* ============================================================
   問題回答画面（個人学習モード）
============================================================ */
function renderQuestion() {
  const sess = S.studySession;
  if (!sess) { navigate('question-set'); return ''; }
  const { questions, current } = sess;
  const q      = questions[current];
  const pct    = Math.round((current/questions.length)*100);
  const labels = ['A','B','C','D'];

  return `
    <div class="question-bg">
      <div class="q-header">
        <button class="back-btn" onclick="confirmQuit()">←</button>
        <div class="q-progress-area">
          <div class="q-progress-bar-bg"><div class="q-progress-bar-fill" style="width:${pct}%"></div></div>
          <div class="q-progress-label">${current+1} / ${questions.length} 問</div>
        </div>
        <div class="streak-badge">${svg(IC.flame,14)}<span>${current}</span></div>
      </div>
      <div class="q-card fade-in">
        <span class="q-num-badge">問題 ${current+1} · ${esc(q.category)}</span>
        <div class="q-text">${esc(q.text)}</div>
      </div>
      <div class="choices" id="choices-area">
        ${q.choices.map((c,ci)=>`
          <button class="choice-btn" id="choice-${ci}" onclick="answerStudy(${ci})">
            <div class="choice-lbl">${labels[ci]}</div>
            <span>${esc(c)}</span>
          </button>`).join('')}
      </div>
      <div class="answer-feedback" id="answer-feedback">
        <div class="feedback-result" id="feedback-result"></div>
        <div class="feedback-explanation" id="feedback-explain"></div>
        <button class="btn btn-primary feedback-next-btn" id="next-btn" onclick="nextQuestion()">次の問題へ →</button>
      </div>
    </div>`;
}

/* 選択肢が押されたとき：正誤を判定してフィードバックを表示する */
function answerStudy(chosen) {
  const sess = S.studySession;
  const q    = sess.questions[sess.current];
  const ok   = chosen === q.correct;
  sess.answers.push({ questionId:q.id, chosen, correct:ok });
  const labels = ['A','B','C','D'];
  document.querySelectorAll('.choice-btn').forEach((btn,i)=>{
    btn.classList.add('disabled');
    if (i===q.correct)          btn.classList.add('correct');
    else if (i===chosen && !ok) btn.classList.add('wrong');
  });
  const fb  = document.getElementById('answer-feedback');
  const fbr = document.getElementById('feedback-result');
  const fbe = document.getElementById('feedback-explain');
  fbr.textContent = ok ? '✓ 正解！すごい！' : `✗ 不正解（正解：${labels[q.correct]}）`;
  fbr.className   = `feedback-result ${ok?'correct':'wrong'}`;
  fbe.textContent = q.explanation || '';
  const isLast = sess.current+1 >= sess.questions.length;
  document.getElementById('next-btn').textContent = isLast ? '結果を見る ›' : '次の問題へ →';
  fb.classList.add('show');
}

function nextQuestion() {
  S.studySession.current++;
  if (S.studySession.current >= S.studySession.questions.length) finishStudy();
  else navigate('question', { mode:'study' });
}

/* TODO(DB担当): ここでサーバーへ学習結果を保存する */
function finishStudy() {
  S.user.totalStudied++;
  save();
  navigate('result', { answers:S.studySession.answers, questions:S.studySession.questions });
}

function confirmQuit() { if (confirm('演習を中断しますか？')) navigate('question-set'); }


/* ============================================================
   学習結果画面
   正答率・ランク・獲得ポイント・全問題の解説を表示する
============================================================ */
function renderResult(params) {
  const { answers, questions } = params;
  const correct      = answers.filter(a=>a.correct).length;
  const total        = answers.length;
  const pct          = Math.round((correct/total)*100);
  const rank         = getRank(pct);
  const labels       = ['A','B','C','D'];
  const pointsGained = correct * 10;

  const reviews = questions.map((q,i)=>{
    const ans = answers[i]; const ok = ans?.correct;
    return `
      <div class="review-item">
        <div class="review-item-header">
          <div class="review-badge ${ok?'ok':'ng'}">${ok?'○':'✗'}</div>
          <div class="review-q">Q${i+1}. ${esc(q.text)}</div>
        </div>
        ${!ok?`<div class="review-answer">あなたの答え: <span class="review-wrong">${ans?labels[ans.chosen]+'. '+esc(q.choices[ans.chosen]):'未回答'}</span> ／ 正解: <span class="review-correct">${labels[q.correct]}. ${esc(q.choices[q.correct])}</span></div>`:''}
        ${q.explanation?`<div class="review-explain">${esc(q.explanation)}</div>`:''}
      </div>`;
  }).join('');

  return `
    <div class="result-hero">
      <div class="result-sparkles">${svg(IC.sparkles,22)}${svg(IC.sparkles,18)}${svg(IC.sparkles,22)}</div>
      <span class="result-rank-emoji">${rank.icon}</span>
      <div class="result-rank-text">${rank.label}</div>
      <div class="result-pct">${pct}<span style="font-size:24px">%</span></div>
      <div class="result-pct-label">正答率 ・ +${pointsGained}pt 獲得！</div>
    </div>
    <div class="result-body">
      <div class="result-stats-row">
        <div class="result-stat"><div class="result-stat-num green">${correct}</div><div class="result-stat-lbl">正解</div></div>
        <div class="result-stat"><div class="result-stat-num coral">${total-correct}</div><div class="result-stat-lbl">不正解</div></div>
        <div class="result-stat"><div class="result-stat-num blue">${total}</div><div class="result-stat-lbl">合計問題数</div></div>
      </div>
      <div class="section-heading-icon">${svg(IC.bookOpen,16)} 解説・振り返り</div>
      ${reviews}
      <div class="flex-row mt16">
        <button class="btn btn-outline" onclick="retryWrong()">✗ 解き直す</button>
        <button class="btn btn-primary" onclick="navigate('question-set')">次の問題へ</button>
      </div>
    </div>`;
}

/* 間違えた問題だけを再学習する */
function retryWrong() {
  const sess = S.studySession; if(!sess) { navigate('question-set'); return; }
  const wrong = sess.answers.filter(a=>!a.correct).map(a=>a.questionId);
  if (!wrong.length) { alert('間違えた問題はありません！完璧です！'); return; }
  startStudy(wrong);
}
