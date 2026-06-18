/* ============================================================
   social.js — マイページ・プロフィール編集・ランキング画面
   ─────────────────────────────────────────────────────────────
   担当: フロントエンド担当

   TODO（DB担当者へ）:
     ・renderRanking()   : MOCK_RANKINGS の代わりにサーバーからランキングデータを取得する
     ・saveProfile()     : save() の後にサーバーへプロフィール更新 API も呼ぶ
     ・doLogout()        : サーバー側のセッション破棄 API を呼んでからリセットする
============================================================ */

let myPageUserRefreshing = false;

function numberValue(...values) {
  for (const value of values) {
    const n = Number(value);

    if (Number.isFinite(n)) {
      return n;
    }
  }

  return 0;
}

async function refreshMyPageUserFromServer() {
  if (myPageUserRefreshing) {
    return false;
  }

  myPageUserRefreshing = true;

  try {
    const response = await fetch("/api/auth/me");
    const data = await response.json();

    if (!response.ok || !data.ok || !data.user) {
      return false;
    }

    const avatar = getCurrentAvatar();

    if (typeof applyAuthUser === "function") {
      applyAuthUser(data.user);
      S.user.avatar = avatar;
      localStorage.setItem("revino_avatar", avatar);
      save();
    } else {
      S.user = {
        ...S.user,
        ...data.user
      };
      save();
    }

    return true;
  } catch {
    return false;
  } finally {
    myPageUserRefreshing = false;
  }
}

function updateMyPageStatsView() {
  const point = numberValue(S.user?.point, S.user?.points);
  const battleWinCount = numberValue(S.user?.battleWinCount, S.user?.wins);
  const studyCount = numberValue(S.user?.studyCount, S.user?.totalStudied);
  const questionCount = numberValue(S.user?.questionCount);

  const pointEl = document.getElementById("mypage-point");
  const winEl = document.getElementById("mypage-win-count");
  const studyEl = document.getElementById("mypage-study-count");
  const questionEl = document.getElementById("mypage-question-count");
  const levelEl = document.getElementById("mypage-level");

  if (pointEl) {
    pointEl.textContent = point;
  }

  if (winEl) {
    winEl.textContent = battleWinCount;
  }

  if (studyEl) {
    studyEl.textContent = studyCount;
  }

  if (questionEl) {
    questionEl.textContent = questionCount;
  }

  if (levelEl) {
    levelEl.textContent = `Lv. ${getLevel(point)}`;
  }
}

function refreshMyPageStatsLater() {
  setTimeout(async () => {
    const mypageRoot = document.getElementById("mypage-root");

    if (!mypageRoot) {
      return;
    }

    const updated = await refreshMyPageUserFromServer();

    if (!updated) {
      return;
    }

    // 取得中に別画面へ移動していたら何もしない
    if (!document.getElementById("mypage-root")) {
      return;
    }

    updateMyPageStatsView();
  }, 0);
}

/* ============================================================
   マイページ画面
   ユーザーのアバター・名前・レベル・各種統計を表示し、
   プロフィール編集・セット一覧・ランキング・対戦履歴・ログアウトへのメニューを提供する
============================================================ */
function renderMyPage() {
  if (!S.user) {
    setTimeout(() => navigate("login"), 0);
    return "";
  }

  refreshMyPageStatsLater();

  const avatar = getCurrentAvatar();
  S.user.avatar = avatar;

  const point = numberValue(S.user.point, S.user.points);
  const battleWinCount = numberValue(S.user.battleWinCount, S.user.wins);
  const studyCount = numberValue(S.user.studyCount, S.user.totalStudied);
  const questionCount = numberValue(S.user.questionCount);

  const lv = getLevel(point);

  return `
  <div id="mypage-root">
    <div class="mypage-hero">
      <span class="mypage-avatar">${getAvatarHTML(avatar, 72)}</span>
      <div class="mypage-name">${esc(S.user.name || S.user.username || "ユーザー")}</div>
      <div class="mypage-email">${esc(S.user.email || "")}</div>

      <div id="mypage-level" style="display:inline-block;background:linear-gradient(135deg,#FFD44D,var(--gold));color:white;padding:4px 14px;border-radius:14px;font-size:13px;font-weight:900;margin-bottom:14px;box-shadow:var(--shadow-gold)">
        Lv. ${lv}
      </div>

      <div class="mypage-stats">
        <div class="mypage-stat">
          <div class="mypage-stat-num" id="mypage-point">${point}</div>
          <div class="mypage-stat-lbl">ポイント</div>
        </div>
        <div class="mypage-stat">
          <div class="mypage-stat-num" id="mypage-win-count">${battleWinCount}</div>
          <div class="mypage-stat-lbl">対戦勝利</div>
        </div>
        <div class="mypage-stat">
          <div class="mypage-stat-num" id="mypage-study-count">${studyCount}</div>
          <div class="mypage-stat-lbl">学習回数</div>
        </div>
        <div class="mypage-stat">
          <div class="mypage-stat-num" id="mypage-question-count">${questionCount}</div>
          <div class="mypage-stat-lbl">問題数</div>
        </div>
      </div>
    </div>

    <div class="mypage-menu">
      <div class="mypage-menu-item" onclick="navigate('profile-edit')">
        <div class="mypage-menu-icon blue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <div class="mypage-menu-label">プロフィール編集</div>
        <div class="mypage-menu-arrow">›</div>
      </div>

      <div class="mypage-menu-item" onclick="navigate('materials')">
        <div class="mypage-menu-icon green">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 7l9-4 9 4-9 4-9-4z"/>
            <path d="M3 12l9 4 9-4"/>
            <path d="M3 17l9 4 9-4"/>
          </svg>
        </div>
        <div class="mypage-menu-label">セット一覧</div>
        <div class="mypage-menu-arrow">›</div>
      </div>

      <div class="mypage-menu-item" onclick="navigate('ranking')">
        <div class="mypage-menu-icon gold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 9H4a2 2 0 0 1-2-2V5h4"/>
            <path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/>
            <path d="M6 5h12v6a6 6 0 0 1-12 0V5z"/>
            <path d="M9 21h6"/>
            <path d="M12 17v4"/>
          </svg>
        </div>
        <div class="mypage-menu-label">ランキング</div>
        <div class="mypage-menu-arrow">›</div>
      </div>

      <div class="mypage-menu-item" onclick="navigate('battle-history')">
        <div class="mypage-menu-icon red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
            <line x1="13" y1="19" x2="19" y2="13"/>
            <line x1="16" y1="16" x2="20" y2="20"/>
          </svg>
        </div>
        <div class="mypage-menu-label">対戦履歴</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
    </div>

    <div class="mypage-menu" style="margin-top:8px">
      <div class="mypage-menu-item danger" onclick="doLogout()">
        <div class="mypage-menu-icon red">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <div class="mypage-menu-label">ログアウト</div>
        <div class="mypage-menu-arrow">›</div>
      </div>
    </div>

    <div style="height:16px"></div>
  </div>
  `;
}

/* ログアウト処理：確認後に S の中身をリセットしてログイン画面へ戻る
   TODO(DB担当): サーバー側のセッション破棄 API を呼んでからリセットする */
async function doLogout() {
  if (!confirm("ログアウトしますか？")) {
    return;
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    S.user = null;
    S.materials = [];
    S.questions = [];

    localStorage.removeItem("pz_user");
    localStorage.removeItem("pz_materials");
    localStorage.removeItem("pz_questions");
    localStorage.removeItem("revino_avatar");

    navigate("login");
  }
}


/* ============================================================
   プロフィール編集画面
   アバター（絵文字）の選択と名前の変更ができる
============================================================ */
const AVATARS=['🐧','🦊','🐻','🐱','🐼','🦋','🦁','🐸','🐯','🦄','🐮','🐺'];

let profileEditTags = [];

function getCurrentAvatar() {
  return localStorage.getItem("revino_avatar") || S.user?.avatar || "🐧";
}

function applyProfileUser(user, avatar) {
  if (typeof applyAuthUser === "function") {
    applyAuthUser(user);
  } else {
    const point = numberValue(user.point, user.points);
    const battleWinCount = numberValue(user.battleWinCount, user.wins);
    const studyCount = numberValue(user.studyCount, user.totalStudied);
    const questionCount = numberValue(user.questionCount);

    S.user = {
      ...S.user,
      userId: user.userId,
      name: user.username,
      username: user.username,
      email: user.email,
      profile: user.profile || "",
      userTags: Array.isArray(user.userTags) ? user.userTags : [],

      point,
      battleWinCount,
      studyCount,
      questionCount,

      points: point,
      wins: battleWinCount,
      totalStudied: studyCount
    };
  }

  S.user.avatar = avatar || getCurrentAvatar();
  localStorage.setItem("revino_avatar", S.user.avatar);
  save();
}

function showProfileMessage(text, type = "error") {
  const msg = document.getElementById("profile-msg");

  if (!msg) {
    alert(text);
    return;
  }

  msg.textContent = text;
  msg.className = `alert alert-${type}`;
}

function hideProfileMessage() {
  const msg = document.getElementById("profile-msg");

  if (!msg) {
    return;
  }

  msg.textContent = "";
  msg.className = "alert hidden";
}

function renderProfileEdit() {
  if (!S.user) {
    setTimeout(() => navigate("login"), 0);
    return "";
  }

  selectedAvatar = getCurrentAvatar();
  profileEditTags = Array.isArray(S.user.userTags) ? [...S.user.userTags] : [];

  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('mypage')">←</button>
      <div class="header-title">プロフィール編集</div>
      <div style="width:40px"></div>
    </div>

    <div class="screen-body">
      <div style="text-align:center;padding:16px 0 8px" id="preview-avatar-wrap">
        ${getAvatarHTML(selectedAvatar, 72)}
      </div>

      <div class="form-group">
        <label class="form-label">アバターを選択</label>
        <div class="avatar-picker">
          ${AVATARS.map(a => `
            <div
              class="avatar-option ${a === selectedAvatar ? "selected" : ""}"
              onclick="selectAvatar('${a}')"
              id="av-${a}"
            >
              ${a}
            </div>
          `).join("")}
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">${svg(IC.user, 14)} 名前</label>
        <input
          class="form-input"
          id="edit-name"
          type="text"
          value="${esc(S.user.name || S.user.username || "")}"
          placeholder="名前を入力"
        >
      </div>

      <div class="form-group">
        <label class="form-label">${svg(IC.mail, 14)} メールアドレス</label>
        <input
          class="form-input"
          id="edit-email"
          type="email"
          value="${esc(S.user.email || "")}"
          placeholder="メールアドレスを入力"
        >
      </div>

      <div class="form-group">
        <label class="form-label">プロフィール</label>
        <textarea
          class="form-input profile-textarea"
          id="edit-profile"
          rows="4"
          placeholder="プロフィールを入力"
        >${esc(S.user.profile || "")}</textarea>
      </div>

      <div class="form-group">
        <label class="form-label">ユーザータグ</label>

        <div class="tag-editor-row">
          <input
            class="form-input"
            id="profile-tag-input"
            type="text"
            maxlength="20"
            placeholder="例：数学"
            onkeydown="handleProfileTagKeydown(event)"
          >
          <button class="btn btn-outline" type="button" onclick="addProfileTag()">
            追加
          </button>
        </div>

        <div id="profile-selected-tags" class="selected-tags mt12">
          ${renderProfileTagsHTML()}
        </div>
      </div>

      <div id="profile-msg" class="alert hidden"></div>

      <button class="btn btn-primary" onclick="saveProfile()">
        ${svg(IC.save, 15)} 保存する
      </button>
    </div>
  `;
}

function renderProfileTagsHTML() {
  if (!profileEditTags.length) {
    return "タグ未追加";
  }

  return profileEditTags.map((tag, index) => `
    <span class="selected-tag">
      <span>${esc(tag)}</span>
      <button
        type="button"
        class="remove-tag-button"
        onclick="removeProfileTag(${index})"
      >
        ×
      </button>
    </span>
  `).join("");
}

function updateProfileTagsView() {
  const wrap = document.getElementById("profile-selected-tags");

  if (!wrap) {
    return;
  }

  wrap.innerHTML = renderProfileTagsHTML();
}

function addProfileTag() {
  const input = document.getElementById("profile-tag-input");

  if (!input) {
    return;
  }

  const tag = input.value.trim();

  if (!tag) {
    return;
  }

  if (tag.length > 20) {
    showProfileMessage("タグは20文字以内で入力してください", "error");
    return;
  }

  if (profileEditTags.includes(tag)) {
    showProfileMessage("同じタグは追加できません", "error");
    input.value = "";
    return;
  }

  if (profileEditTags.length >= 10) {
    showProfileMessage("タグは10個まで追加できます", "error");
    return;
  }

  profileEditTags.push(tag);
  input.value = "";
  hideProfileMessage();
  updateProfileTagsView();
}

function removeProfileTag(index) {
  profileEditTags.splice(index, 1);
  updateProfileTagsView();
}

function handleProfileTagKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addProfileTag();
  }
}

function selectAvatar(a) {
  selectedAvatar=a;
  document.querySelectorAll('.avatar-option').forEach(el=>el.classList.remove('selected'));
  const el=document.getElementById(`av-${a}`); if(el) el.classList.add('selected');
  const pw=document.getElementById('preview-avatar-wrap');
  if(pw) pw.innerHTML=getAvatarHTML(a,72);
}

/* TODO(DB担当): save() の後にサーバーへプロフィール更新 API も呼ぶ */
async function saveProfile() {
  const name = document.getElementById("edit-name").value.trim();
  const email = document.getElementById("edit-email").value.trim();
  const profile = document.getElementById("edit-profile").value.trim();
  const avatar = selectedAvatar || getCurrentAvatar();

  if (!name) {
    showProfileMessage("名前を入力してください", "error");
    return;
  }

  if (!email || !email.includes("@")) {
    showProfileMessage("メールアドレスの形式が正しくありません", "error");
    return;
  }

  hideProfileMessage();

  try {
    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: name,
        email,
        profile,
        userTags: profileEditTags
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showProfileMessage(data.message || "プロフィール更新に失敗しました", "error");
      return;
    }

    applyProfileUser(data.user, avatar);

    showProfileMessage("保存しました", "success");

    setTimeout(() => {
      navigate("mypage");
    }, 700);
  } catch {
    showProfileMessage("通信エラーが発生しました", "error");
  }
}


/* ============================================================
   ランキング画面
   自分のポイントに応じてランキングに自分を挿入し、上位3名を表彰台で表示する
   TODO（DB担当者へ）: MOCK_RANKINGS の代わりにサーバーからランキングデータを取得する
============================================================ */
function renderRanking() {
  const all = [...MOCK_RANKINGS];
  const insertAt = all.findIndex(u=>u.points<S.user.points);
  const me = { id:'me', name:S.user.name+' (あなた)', avatar:S.user.avatar, points:S.user.points, wins:S.user.wins, isMe:true };
  all.splice(insertAt===-1?all.length:insertAt, 0, me);

  const top3 = all.slice(0,3);
  const rest  = all.slice(3);
  const podiumOrder=[{i:1,cls:'second'},{i:0,cls:'first'},{i:2,cls:'third'}];
  const medals=['1','2','3'];
  const podiumH=['70px','54px','42px'];
  const po = podiumOrder.filter(p=>top3[p.i]).map(p=>{
    const u=top3[p.i];
    const h=p.cls==='first'?podiumH[0]:p.cls==='second'?podiumH[1]:podiumH[2];
    return `
      <div class="rank-podium">
        <div class="rank-podium-avatar">${getAvatarHTML(u.avatar,44)}</div>
        <div class="rank-podium-name">${esc(u.name.replace(' (あなた)',''))}</div>
        <div class="rank-podium-pts">${u.points}pt</div>
        <div class="rank-podium-box ${p.cls}" style="height:${h}">${medals[['first','second','third'].indexOf(p.cls)]}</div>
      </div>`;
  }).join('');

  const rows = all.map((u,i)=>`
    <div class="rank-item ${u.isMe?'me':''}">
      <div class="rank-num">${i+1}</div>
      <div class="rank-avatar-icon">${getAvatarHTML(u.avatar,36)}</div>
      <div class="rank-info">
        <div class="rank-name">${esc(u.name)}</div>
        <div class="rank-wins">${svg(IC.swords,12)} 勝利 ${u.wins}回</div>
      </div>
      <div class="rank-pts">${u.points}pt</div>
    </div>`).join('');

  return `
    <div class="ranking-hero">
      <div class="ranking-hero-icon"><img src="trophy.png" alt="trophy" class="ranking-trophy-img"></div>
      <div class="ranking-hero-title">ランキング</div>
      <div class="ranking-hero-sub">学校内で1位を目指そう！</div>
    </div>
    <div class="ranking-top3">${po}</div>
    <div class="rank-list">${rows}</div>`;
}
