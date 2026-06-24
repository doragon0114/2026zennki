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
let materialsLoaded = false;
let materialsLoading = false;

function getCurrentUserId() {
  return S.user?.userId || S.user?.id || "";
}

function withUserId(url) {
  const userId = getCurrentUserId();

  if (!userId) {
    return url;
  }

  const sep = url.includes("?") ? "&" : "?";

  return `${url}${sep}userId=${encodeURIComponent(userId)}`;
}

async function loadMaterialsFromServer(force = false) {
  if (materialsLoading) {
    return;
  }

  if (materialsLoaded && !force) {
    return;
  }

  materialsLoading = true;

  try {
    const response = await fetch(withUserId("/api/materials"));
    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || "問題セットの取得に失敗しました");
    }

    applyMaterialsPayload(data);
    materialsLoaded = true;
    save();
  } catch {
    alert("問題セットをサーバーから取得できませんでした。");
  } finally {
    materialsLoading = false;
  }
}

function applyMaterialsPayload(data) {
  S.materials = Array.isArray(data.materials) ? data.materials : [];
  S.questions = Array.isArray(data.questions) ? data.questions : [];
}

function renderMaterialsLoading(title = "セット一覧") {
  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('home')">←</button>
      <div class="header-title">${esc(title)}</div>
      <button class="header-action" onclick="navigate('upload')">＋追加</button>
    </div>
    <div class="screen-body">
      <div style="text-align:center;padding:80px 20px;color:var(--gray)">
        <div class="empty-icon-wrap">${svg(IC.folder,52)}</div>
        <div style="font-size:15px;font-weight:800;color:var(--dark);margin-bottom:6px">
          問題セットを読み込み中です
        </div>
        <div style="font-size:13px">
          studyData.json からデータを取得しています...
        </div>
      </div>
    </div>
  `;
}
function renderMaterials() {
  if (!materialsLoaded) {
    setTimeout(async () => {
      await loadMaterialsFromServer(true);
      navigate("materials");
    }, 0);

    return renderMaterialsLoading("セット一覧");
  }

  const items = S.materials.length === 0
    ? `<div style="text-align:center;padding:60px 20px">
        <div class="empty-icon-wrap">${svg(IC.folder,52)}</div>
        <div style="font-size:16px;font-weight:800;color:var(--dark);margin-bottom:6px">資料がありません</div>
        <div style="font-size:13px;color:var(--gray);margin-bottom:20px">資料をアップロードしてAIで問題を生成しましょう</div>
        <button class="btn btn-primary btn-sm" onclick="navigate('upload')">${svg(IC.zap,14)} 資料をアップロード</button>
       </div>`
    : S.materials.map((m, idx) => {
        const qc = S.questions.filter(q => q.materialId === m.id).length;
        const matIcons = [
          svg(IC.leaf,22),
          svg(IC.bookOpen,22),
          svg(IC.flask,22),
          svg(IC.globe,22),
          svg(IC.pencil,22),
          svg(IC.dna,22),
          svg(IC.map,22)
        ];
        const icon = matIcons[idx % matIcons.length];
        const pct = Math.min(95, 40 + idx * 15);

        return `
          <div class="mini-set-card" onclick="navigate('question-edit',{materialId:'${esc(m.id)}'})" style="padding:16px">
            <div class="mini-set-icon color-${idx%6}">${icon}</div>
            <div class="mini-set-info">
              <div class="mini-set-title" style="font-size:14px">${esc(m.name)}</div>
              <div style="margin:4px 0">
                ${m.shared ? '<span class="tag tag-green">公開中</span>' : '<span class="tag tag-gray">非公開</span>'}
                <span class="tag tag-sky">${esc(m.type === "camera" ? "カメラ" : "ファイル")}</span>
              </div>
              <div class="mini-set-bar-bg">
                <div class="mini-set-bar-fill" style="width:${pct}%"></div>
              </div>
              <div class="mini-set-meta">${fmtDate(m.createdAt || new Date().toISOString())} ・ ${qc}問</div>
            </div>
            <div
              style="
                display:flex;
                flex-direction:column;
                align-items:center;
                justify-content:center;
                gap:8px;
              "
            >
              <div style="color:var(--gray);font-size:18px">›</div>

              <button
                type="button"
                class="btn btn-danger btn-xs"
                onclick="
                  event.stopPropagation();
                  deleteMaterialSet('${esc(m.id)}');
                "
              >
                削除
              </button>
            </div>
          </div>`;
      }).join("");

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
function renderQuestionEdit(params = {}) {
  const { materialId } = params;

  if (!materialId) {
    return `
      <div class="screen-header blue-bg">
        <button class="back-btn" onclick="navigate('materials')">←</button>
        <div class="header-title">問題確認・編集</div>
      </div>
      <div class="screen-body">
        <div style="text-align:center;padding:60px 20px;color:var(--gray)">
          <div class="empty-icon-wrap">${svg(IC.help,40)}</div>
          <div style="font-weight:800;color:var(--dark);margin-bottom:6px">問題セットが選択されていません</div>
          <button class="btn btn-primary mt16" onclick="navigate('materials')">セット一覧へ戻る</button>
        </div>
      </div>
    `;
  }

  if (!materialsLoaded) {
    setTimeout(async () => {
      await loadMaterialsFromServer(true);
      navigate("question-edit", { materialId });
    }, 0);

    return renderMaterialsLoading("問題確認・編集");
  }

  const mat = S.materials.find(m => m.id === materialId);
  const qs = S.questions.filter(q => q.materialId === materialId);
  const title = mat ? esc(mat.name) : "問題確認・編集";

  const items = qs.length === 0
    ? `<div style="text-align:center;padding:40px 20px;color:var(--gray)">
        <div class="empty-icon-wrap">${svg(IC.help,40)}</div>
        <div style="font-weight:800;color:var(--dark);margin-bottom:6px">問題がありません</div>
        <div style="font-size:13px">下のボタンから手動追加できます</div>
       </div>`
    : qs.map((q, i) => `
        <div class="qedit-item" id="qitem-${esc(q.id)}">
          <div class="qedit-header">
            <div class="qedit-num">Q${i + 1}</div>
            <div class="qedit-text">${esc(q.text)}</div>
            <div class="qedit-actions">
              <button class="btn btn-outline btn-xs" onclick="openEdit('${esc(q.id)}')">編集</button>
              <button class="btn btn-danger btn-xs" onclick="deleteQuestion('${esc(q.id)}')">削除</button>
            </div>
          </div>

          <div class="qedit-choices">
            ${q.choices.map((c, ci) => `
              <div class="qedit-choice ${ci === q.correct ? "correct" : ""}">
                <span class="qedit-choice-label">${ci === q.correct ? "✓" : String.fromCharCode(65 + ci)}</span>
                <span>${esc(c)}</span>
              </div>
            `).join("")}
          </div>

          <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
            <span class="tag tag-blue">${esc(q.category || "一般")}</span>
            ${(q.tags || []).map(t => `<span class="tag tag-gray">${esc(t)}</span>`).join("")}
          </div>
        </div>
      `).join("");

  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('materials')">←</button>
      <div class="header-title">${title}</div>
      <button class="header-action" onclick="openAddQuestion('${esc(materialId)}')">＋追加</button>
    </div>

    <div class="screen-body">
        ${mat && mat.shared
          ? `
            <div class="alert alert-success">
              ✓ この問題セットは公開中です
            </div>

            <div
              style="
                display:flex;
                gap:8px;
                margin-bottom:14px;
                flex-wrap:wrap;
              "
            >
              <button
                class="btn btn-outline-gray btn-sm"
                onclick="shareSet('${esc(materialId)}', false)"
              >
                非公開にする
              </button>

              <button
                class="btn btn-primary btn-sm"
                onclick="navigate('question-set')"
              >
                ▶ 学習する
              </button>

              <button
                class="btn btn-danger btn-sm"
                onclick="deleteMaterialSet('${esc(materialId)}')"
              >
                セットを削除
              </button>
            </div>
          `
          : `
            <div
              style="
                display:flex;
                gap:8px;
                margin-bottom:14px;
                flex-wrap:wrap;
              "
            >
              <button
                class="btn btn-outline-gray btn-sm"
                onclick="shareSet('${esc(materialId)}', true)"
              >
                ${svg(IC.share,14)} 公開・共有
              </button>

              <button
                class="btn btn-primary btn-sm"
                onclick="navigate('question-set')"
              >
                ▶ 学習する
              </button>

              <button
                class="btn btn-danger btn-sm"
                onclick="deleteMaterialSet('${esc(materialId)}')"
              >
                セットを削除
              </button>
            </div>
          `}
      ${items}
    </div>

    <div id="edit-modal-root"></div>`;
}

/* 問題を削除する
   TODO(DB担当): save() の後にサーバー削除 API も呼ぶ */
async function deleteQuestion(qid) {
  if (!confirm("この問題を削除しますか？")) {
    return;
  }

  const q = S.questions.find(item => item.id === qid);
  const materialId = q?.materialId;

  if (!q || !materialId) {
    alert("削除する問題が見つかりません");
    return;
  }

  try {
    const response = await fetch(withUserId(`/api/materials/${encodeURIComponent(materialId)}/questions/${encodeURIComponent(qid)}`), {
      method: "DELETE"
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data.message || "問題の削除に失敗しました");
      return;
    }

    applyMaterialsPayload(data.payload || data);
    save();

    navigate("question-edit", { materialId });
  } catch {
    alert("通信エラーが発生しました");
  }
}

// ==================================================
// 問題セット全体を削除する
// ==================================================
async function deleteMaterialSet(materialId) {
  const material = S.materials.find(item => {
    return item.id === materialId;
  });

  if (!material) {
    alert("削除する問題セットが見つかりません");
    return;
  }

  const questionCount = S.questions.filter(question => {
    return question.materialId === materialId;
  }).length;

  const confirmed = confirm(
    `問題セット「${material.name}」を削除しますか？\n\n` +
    `${questionCount}問の問題もすべて削除されます。\n` +
    "この操作は取り消せません。"
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch(
      withUserId(
        `/api/materials/${encodeURIComponent(materialId)}`
      ),
      {
        method: "DELETE"
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(
        data.message || "問題セットの削除に失敗しました"
      );
      return;
    }

    applyMaterialsPayload(data.payload || data);

    materialsLoaded = true;

    // 個人学習側に削除前データが残らないようにする
    if (typeof studyLoaded !== "undefined") {
      studyLoaded = false;
    }

    // 削除対象を演習中データが参照していた場合は破棄する
    if (
      S.studySession &&
      Array.isArray(S.studySession.questions) &&
      S.studySession.questions.some(question => {
        return question.materialId === materialId;
      })
    ) {
      S.studySession = null;
    }

    save();

    // users.question_count の最新値を取得
    if (
      typeof refreshMyPageUserFromServer === "function"
    ) {
      await refreshMyPageUserFromServer();
    }

    alert(
      `問題セット「${material.name}」を削除しました。\n` +
      `${Number(data.deleted?.deletedQuestionCount || questionCount)}問を削除しました。`
    );

    navigate("materials");
  } catch (err) {
    console.error("deleteMaterialSet error:", err);
    alert("通信エラーが発生しました");
  }
}

/* 問題セットを公開する
   TODO(DB担当): サーバーへ公開フラグを送信する */
async function shareSet(materialId, shared = true) {
  try {
    const response = await fetch(withUserId(`/api/materials/${encodeURIComponent(materialId)}/share`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        shared
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data.message || "公開状態の更新に失敗しました");
      return;
    }

    applyMaterialsPayload(data.payload || data);
    save();

    alert(shared
      ? "問題セットを公開しました！\n他のユーザーがこのセットを学習できるようになりました。"
      : "問題セットを非公開にしました。"
    );

    navigate("question-edit", { materialId });
  } catch {
    alert("通信エラーが発生しました");
  }
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
async function saveEdit() {
  const text = document.getElementById("edit-q-text").value.trim();

  if (!text) {
    alert("問題文を入力してください");
    return;
  }

  const choices = [0, 1, 2, 3].map(i => {
    return document.getElementById(`edit-c${i}`).value.trim();
  });

  if (choices.some(choice => !choice)) {
    alert("すべての選択肢を入力してください");
    return;
  }

  const correctEl = document.querySelector('input[name="correct-choice"]:checked');
  const correct = correctEl ? parseInt(correctEl.value, 10) : 0;
  const explanation = document.getElementById("edit-explain").value.trim();
  const category = document.getElementById("edit-cat").value.trim() || "一般";

  const payload = {
    text,
    choices,
    correct,
    explanation,
    category,
    tags: editingQid.startsWith("__new__") ? ["手動追加"] : undefined
  };

  try {
    let response;

    if (editingQid.startsWith("__new__")) {
      const materialId = editingQid.replace("__new__", "");

      response = await fetch(withUserId(`/api/materials/${encodeURIComponent(materialId)}/questions`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        alert(data.message || "問題の追加に失敗しました");
        return;
      }

      applyMaterialsPayload(data.payload || data);
      save();
      closeEdit();
      navigate("question-edit", { materialId });
      return;
    }

    const q = S.questions.find(item => item.id === editingQid);

    if (!q) {
      alert("編集する問題が見つかりません");
      return;
    }

    response = await fetch(withUserId(`/api/materials/${encodeURIComponent(q.materialId)}/questions/${encodeURIComponent(q.id)}`), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...payload,
        tags: Array.isArray(q.tags) ? q.tags : []
      })
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      alert(data.message || "問題の保存に失敗しました");
      return;
    }

    applyMaterialsPayload(data.payload || data);
    save();
    closeEdit();
    navigate("question-edit", { materialId: q.materialId });
  } catch {
    alert("通信エラーが発生しました");
  }
}

/* 編集モーダルを閉じる */
function closeEdit() { const r=document.getElementById('edit-modal-root'); if(r) r.innerHTML=''; }
