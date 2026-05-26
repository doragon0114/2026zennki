/* ============================================================
   materials.js — セット一覧・問題確認・問題編集画面
   ─────────────────────────────────────────────────────────────
   担当: フロントエンド担当

   TODO（DB担当者へ）:
     ・renderMaterials()    : S.materials の代わりにサーバーから教材一覧を取得
     ・deleteQuestion()     : ローカル削除の後にサーバー削除 API も呼ぶ
     ・shareSet()           : サーバーへ公開フラグを送信する
     ・saveEdit() / openAddQuestion(): 問題の保存・追加をサーバー API 経由にする
============================================================ */


/* ============================================================
   セット一覧画面
============================================================ */
function renderMaterials() {
  const items = S.materials.length === 0
    ? `<div style="text-align:center;padding:60px 20px">
        <div class="empty-icon-wrap">${svg(IC.folder,52)}</div>
        <div style="font-size:16px;font-weight:800;color:var(--dark);margin-bottom:6px">資料がありません</div>
        <div style="font-size:13px;color:var(--gray);margin-bottom:20px">資料をアップロードしてAIで問題を生成しましょう</div>
        <button class="btn btn-primary btn-sm" onclick="navigate('upload')">${svg(IC.zap,14)} 資料をアップロード</button>
       </div>`
    : S.materials.map(m => {
        const qc       = S.questions.filter(q=>q.materialId===m.id).length;
        const matIcons = [svg(IC.leaf,22),svg(IC.bookOpen,22),svg(IC.flask,22),svg(IC.globe,22),svg(IC.pencil,22),svg(IC.dna,22),svg(IC.map,22)];
        const idx      = S.materials.indexOf(m);
        const icon     = matIcons[idx % matIcons.length];
        const pct      = Math.min(95, 40 + idx*15);
        return `
          <div class="mini-set-card" onclick="navigate('question-edit',{materialId:'${m.id}'})" style="padding:16px">
            <div class="mini-set-icon color-${idx%6}">${icon}</div>
            <div class="mini-set-info">
              <div class="mini-set-title" style="font-size:14px">${esc(m.name)}</div>
              <div style="margin:4px 0">${m.shared?'<span class="tag tag-green">公開中</span>':'<span class="tag tag-gray">非公開</span>'}<span class="tag tag-sky">${esc(m.type==='camera'?'カメラ':'ファイル')}</span></div>
              <div class="mini-set-bar-bg"><div class="mini-set-bar-fill" style="width:${pct}%"></div></div>
              <div class="mini-set-meta">${fmtDate(m.createdAt)} ・ ${qc}問</div>
            </div>
            <div style="color:var(--gray);font-size:18px">›</div>
          </div>`;
      }).join('');

  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('home')">←</button>
      <div class="header-title">セット一覧</div>
      <button class="header-action" onclick="navigate('upload')">＋追加</button>
    </div>
    <div class="screen-body">${items}</div>`;
}


/* ============================================================
   問題確認・編集画面
============================================================ */
function renderQuestionEdit(params) {
  const { materialId } = params;
  const mat   = S.materials.find(m=>m.id===materialId);
  const qs    = S.questions.filter(q=>q.materialId===materialId);
  const title = mat ? esc(mat.name) : '問題確認・編集';

  const items = qs.length === 0
    ? `<div style="text-align:center;padding:40px 20px;color:var(--gray)">
        <div class="empty-icon-wrap">${svg(IC.help,40)}</div>
        <div style="font-weight:800;color:var(--dark);margin-bottom:6px">問題がありません</div>
        <div style="font-size:13px">下のボタンから手動追加できます</div>
       </div>`
    : qs.map((q,i) => `
        <div class="qedit-item" id="qitem-${q.id}">
          <div class="qedit-header">
            <div class="qedit-num">Q${i+1}</div>
            <div class="qedit-text">${esc(q.text)}</div>
            <div class="qedit-actions">
              <button class="btn btn-outline btn-xs" onclick="openEdit('${q.id}')">編集</button>
              <button class="btn btn-danger btn-xs" onclick="deleteQuestion('${q.id}')">削除</button>
            </div>
          </div>
          <div class="qedit-choices">
            ${q.choices.map((c,ci)=>`<div class="qedit-choice ${ci===q.correct?'correct':''}"><span class="qedit-choice-label">${ci===q.correct?'✓':String.fromCharCode(65+ci)}</span><span>${esc(c)}</span></div>`).join('')}
          </div>
          <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
            <span class="tag tag-blue">${esc(q.category)}</span>
            ${(q.tags||[]).map(t=>`<span class="tag tag-gray">${esc(t)}</span>`).join('')}
          </div>
        </div>`).join('');

  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('materials')">←</button>
      <div class="header-title">${title}</div>
      <button class="header-action" onclick="openAddQuestion('${materialId}')">＋追加</button>
    </div>
    <div class="screen-body">
      ${mat && mat.shared
        ? '<div class="alert alert-success">✓ この問題セットは公開中です</div>'
        : `<div style="display:flex;gap:8px;margin-bottom:14px">
             <button class="btn btn-outline-gray btn-sm" onclick="shareSet('${materialId}')">${svg(IC.share,14)} 公開・共有</button>
             <button class="btn btn-primary btn-sm" onclick="navigate('question-set')">▶ 学習する</button>
           </div>`}
      ${items}
    </div>
    <div id="edit-modal-root"></div>`;
}

/* 問題を削除する
   TODO(DB担当): save() の後にサーバー削除 API も呼ぶ */
function deleteQuestion(qid) {
  if (!confirm('この問題を削除しますか？')) return;
  const q   = S.questions.find(x=>x.id===qid);
  const mid = q?.materialId;
  S.questions = S.questions.filter(q=>q.id!==qid);
  save();
  const el = document.getElementById(`qitem-${qid}`);
  if (el) el.remove();
}

/* 問題セットを公開する
   TODO(DB担当): サーバーへ公開フラグを送信する */
function shareSet(materialId) {
  const mat = S.materials.find(m=>m.id===materialId);
  if (mat) { mat.shared=true; save(); }
  alert('問題セットを公開しました！\n他のユーザーがこのセットを学習できるようになりました。');
  navigate('question-edit', { materialId });
}

/* 問題編集モーダルを開く */
function openEdit(qid) {
  editingQid = qid;
  const q    = S.questions.find(x=>x.id===qid); if(!q) return;
  const root = document.getElementById('edit-modal-root');
  root.innerHTML = `
    <div class="edit-modal-overlay" id="edit-overlay">
      <div class="edit-modal">
        <button class="edit-modal-close" onclick="closeEdit()">${svg(IC.x,18)}</button>
        <div class="edit-modal-title">${svg(IC.pencil,16)} 問題を編集</div>
        <div class="form-group">
          <label class="form-label">問題文</label>
          <textarea class="inline-input" id="edit-q-text" rows="3">${esc(q.text)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">選択肢（正解を選択）</label>
          ${q.choices.map((c,ci)=>`<div class="choice-input-row"><input type="radio" name="correct-choice" value="${ci}" ${ci===q.correct?'checked':''}><input class="inline-input" id="edit-c${ci}" type="text" value="${esc(c)}" style="margin-bottom:0"></div>`).join('')}
        </div>
        <div class="form-group">
          <label class="form-label">解説</label>
          <textarea class="inline-input" id="edit-explain" rows="2">${esc(q.explanation||'')}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">カテゴリ</label>
          <input class="inline-input" id="edit-cat" type="text" value="${esc(q.category)}" style="margin-bottom:0">
        </div>
        <button class="btn btn-primary mt12" onclick="saveEdit()">${svg(IC.save,15)} 保存する</button>
      </div>
    </div>`;
}

/* 問題追加モーダルを開く */
function openAddQuestion(materialId) {
  editingQid = '__new__' + materialId;
  const root = document.getElementById('edit-modal-root');
  root.innerHTML = `
    <div class="edit-modal-overlay" id="edit-overlay">
      <div class="edit-modal">
        <button class="edit-modal-close" onclick="closeEdit()">${svg(IC.x,18)}</button>
        <div class="edit-modal-title">${svg(IC.plus,16)} 問題を追加</div>
        <div class="form-group">
          <label class="form-label">問題文</label>
          <textarea class="inline-input" id="edit-q-text" rows="3" placeholder="問題を入力してください"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">選択肢（正解を選択）</label>
          ${[0,1,2,3].map(ci=>`<div class="choice-input-row"><input type="radio" name="correct-choice" value="${ci}" ${ci===0?'checked':''}><input class="inline-input" id="edit-c${ci}" type="text" placeholder="選択肢${ci+1}" style="margin-bottom:0"></div>`).join('')}
        </div>
        <div class="form-group">
          <label class="form-label">解説（任意）</label>
          <textarea class="inline-input" id="edit-explain" rows="2" placeholder="解説を入力"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">カテゴリ</label>
          <input class="inline-input" id="edit-cat" type="text" placeholder="例：数学" style="margin-bottom:0">
        </div>
        <button class="btn btn-primary mt12" onclick="saveEdit()">${svg(IC.plus,15)} 追加する</button>
      </div>
    </div>`;
}

/* 編集・追加を保存する
   TODO(DB担当): save() の後にサーバー保存 API も呼ぶ */
function saveEdit() {
  const text = document.getElementById('edit-q-text').value.trim();
  if (!text) { alert('問題文を入力してください'); return; }
  const choices = [0,1,2,3].map(i=>document.getElementById(`edit-c${i}`).value.trim());
  if (choices.some(c=>!c)) { alert('すべての選択肢を入力してください'); return; }
  const correctEl    = document.querySelector('input[name="correct-choice"]:checked');
  const correct      = correctEl ? parseInt(correctEl.value) : 0;
  const explanation  = document.getElementById('edit-explain').value.trim();
  const category     = document.getElementById('edit-cat').value.trim() || '一般';

  if (editingQid.startsWith('__new__')) {
    const materialId = editingQid.replace('__new__','');
    S.questions.push({ id:uid(), materialId, text, choices, correct, explanation, category, tags:['手動追加'] });
    save(); closeEdit(); navigate('question-edit',{materialId});
  } else {
    const q = S.questions.find(x=>x.id===editingQid);
    if (q) { Object.assign(q,{text,choices,correct,explanation,category}); save(); }
    closeEdit(); navigate('question-edit',{materialId:q?.materialId});
  }
}

/* 編集モーダルを閉じる */
function closeEdit() { const r=document.getElementById('edit-modal-root'); if(r) r.innerHTML=''; }
