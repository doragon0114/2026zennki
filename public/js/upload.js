/* ============================================================
   upload.js — 資料アップロード・AI解析画面
   ─────────────────────────────────────────────────────────────
   担当: AI機能担当 ★ このファイルが主な作業対象です

   TODO（AI担当者へ）:
     ・runAIAnalysis(params) の中身を本物の AI API 呼び出しに置き換える
       現在はモックデータ（AI_GENERATED_TEMPLATES）から問題を生成しているが、
       実際には資料テキストを API に送り、返ってきた問題データを使う

     ・finishAnalysis(params) でサーバーへの問題保存処理を追加する
       現在は S.questions に直接 push しているが、
       本番では DB 保存 API を呼んでから navigate する

   関連データ（shared.js に定義）:
     ・AI_GENERATED_TEMPLATES  … 現在使っているモック問題テンプレート
     ・S.materials / S.questions … 教材・問題を格納する状態オブジェクト
     ・save()                  … localStorage に保存する関数
============================================================ */


/* ============================================================
   資料アップロード画面
   カメラ撮影またはファイル選択で教材を取り込む
============================================================ */
function renderUpload() {
  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('home')"></button>
      <div class="header-title">資料アップロード</div>
      <div style="width:40px;flex-shrink:0"></div>
    </div>
    <div class="screen-body">
      <div class="upload-section-label">アップロード方法を選択</div>
      <div class="upload-methods">
        <button class="upload-method-btn selected" id="method-camera" onclick="selectMethod('camera')">
          <div class="upload-method-icon-tile blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2L9 4h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div class="upload-method-label">カメラ撮影</div>
          <div class="upload-method-sub">ノートを撮影</div>
        </button>
        <button class="upload-method-btn" id="method-file" onclick="selectMethod('file')">
          <div class="upload-method-icon-tile purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </div>
          <div class="upload-method-label">ファイル選択</div>
          <div class="upload-method-sub">PDF・Word等</div>
        </button>
      </div>
      <div class="upload-area" onclick="triggerFileSelect()">
        <div class="upload-area-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="upload-area-title">タップしてファイルを選択</div>
        <div class="upload-area-sub">PDF・Word・画像ファイルに対応</div>
      </div>
      <div class="file-chosen hidden" id="file-chosen-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <span id="file-chosen-name"></span>
      </div>
      <input type="file" id="file-input" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" style="display:none" onchange="onFileChosen(event)">
      <div class="form-group">
        <label class="form-label">資料名</label>
        <input class="form-input" id="material-name" type="text" placeholder="例：数学ノート 第3章">
      </div>
      <div class="form-group">
        <label class="form-label">カテゴリ（任意）</label>
        <input class="form-input" id="material-cat" type="text" placeholder="例：数学、英語、歴史">
      </div>
      <button class="btn btn-primary" onclick="startUpload()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        AIで解析・問題生成
      </button>
    </div>`;
}

function selectMethod(m) {
  uploadMethod = m;
  document.getElementById('method-camera').classList.toggle('selected', m==='camera');
  document.getElementById('method-file').classList.toggle('selected', m==='file');
}

function triggerFileSelect() { document.getElementById('file-input').click(); }

function onFileChosen(e) {
  const f = e.target.files[0]; if(!f) return;
  document.getElementById('file-chosen-bar').classList.remove('hidden');
  document.getElementById('file-chosen-name').textContent = f.name;
  if (!document.getElementById('material-name').value)
    document.getElementById('material-name').value = f.name.replace(/\.[^.]+$/,'');
}

function startUpload() {
  const name = document.getElementById('material-name').value.trim() || '無題の資料';
  const cat  = document.getElementById('material-cat').value.trim() || '一般';
  navigate('analyzing', { materialId:uid(), name, category:cat });
}


/* ============================================================
   AI解析中画面
   「データ読込→テキスト抽出→問題生成→セット作成」の4ステップを表示する
============================================================ */
function renderAnalyzing(params) {
  return `
    <div class="screen-header blue-bg">
      <div class="header-title">AI解析中</div>
    </div>
    <div class="analyzing-screen">
      <div class="analyzing-icon">${svg(IC.bot,48)}</div>
      <div class="analyzing-title">AIが資料を解析しています</div>
      <div class="analyzing-sub">しばらくお待ちください…</div>
      <div class="analyzing-steps" id="analysis-steps">
        <div class="step-item active" id="step1"><div class="step-dot"></div>データを読み込み中</div>
        <div class="step-item" id="step2"><div class="step-dot"></div>テキストを抽出中</div>
        <div class="step-item" id="step3"><div class="step-dot"></div>問題を自動生成中</div>
        <div class="step-item" id="step4"><div class="step-dot"></div>問題セットを作成中</div>
      </div>
    </div>`;
}

/* ステップアニメーションを順番に実行し、完了後に finishAnalysis() を呼ぶ
   TODO(AI担当): ここで実際の API 呼び出しを行う（fetch など） */
function runAIAnalysis(params) {
  const steps = ['step1','step2','step3','step4'];
  let i = 0;
  const tick = () => {
    const el = document.getElementById(steps[i]); if(!el) return;
    el.classList.remove('active'); el.classList.add('done');
    el.querySelector('.step-dot').style.background = 'var(--green)';
    i++;
    if (i < steps.length) {
      const nx = document.getElementById(steps[i]); if(nx) nx.classList.add('active');
      setTimeout(tick, 900);
    } else {
      finishAnalysis(params);
    }
  };
  setTimeout(tick, 800);
}

/* AI解析の完了処理
   TODO(AI担当): モックデータの代わりに API レスポンスの問題データを使う
                 サーバー保存が必要な場合はここで DB 保存 API を呼ぶ */
function finishAnalysis(params) {
  const { materialId, name, category } = params;
  S.materials.push({
    id: materialId, name: name||'無題の資料', type: uploadMethod,
    filename: name, createdAt: new Date().toISOString(), questionCount: 5, shared: false,
  });
  const newQs = AI_GENERATED_TEMPLATES.map((q,i) => ({
    ...q, id:`${materialId}_${i}`, materialId, category: category||q.category,
  }));
  S.questions.push(...newQs);
  save();
  setTimeout(() => navigate('question-edit', {materialId}), 500);
}
