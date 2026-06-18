/* ============================================================
   auth.js
   スプラッシュ / ログイン / アカウント作成
   サーバーAPI連携版
============================================================ */

let registerUserTags = [];

/* ============================================================
   サーバーユーザー情報をSPA側の S.user 形式へ変換
============================================================ */
function applyAuthUser(user) {
  if (!user) {
    S.user = null;
    save();
    return;
  }

  const point = Number(user.point ?? user.points ?? 0);
  const battleWinCount = Number(user.battleWinCount ?? user.wins ?? 0);
  const studyCount = Number(user.studyCount ?? user.totalStudied ?? 0);
  const questionCount = Number(user.questionCount ?? 0);

  S.user = {
    userId: user.userId,
    name: user.username,
    username: user.username,
    email: user.email,
    profile: user.profile || "",
    userTags: Array.isArray(user.userTags) ? user.userTags : [],
    avatar: localStorage.getItem("revino_avatar") || user.avatar || "🐧",

    point,
    battleWinCount,
    studyCount,
    questionCount,

    points: point,
    wins: battleWinCount,
    totalStudied: studyCount,

    createdAt: user.createdAt
  };

  S.materials = [];
  S.questions = [];

  if (typeof materialsLoaded !== "undefined") {
    materialsLoaded = false;
  }

  save();
}

/* ============================================================
   ログイン状態確認
============================================================ */
async function checkLoginStatus() {
  try {
    const response = await fetch("/api/auth/me");

    if (!response.ok) {
      applyAuthUser(null);
      return null;
    }

    const data = await response.json();

    if (!data.ok || !data.user) {
      applyAuthUser(null);
      return null;
    }

    applyAuthUser(data.user);
    return data.user;
  } catch {
    applyAuthUser(null);
    return null;
  }
}

/* ============================================================
   スプラッシュ画面
============================================================ */
function renderSplash() {
  const sparkle = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.8 6.5L20 10l-6.2 1.5L12 18l-1.8-6.5L4 10l6.2-1.5L12 2z"/>
    </svg>
  `;

  const dot = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="4"/>
    </svg>
  `;

  return `
    <div class="splash-screen">
      <span class="splash-deco s1">${sparkle}</span>
      <span class="splash-deco s2">${sparkle}</span>
      <span class="splash-deco s3">${sparkle}</span>
      <span class="splash-deco s4">${dot}</span>
      <span class="splash-deco s5">${dot}</span>
      <span class="splash-deco s6">${dot}</span>

      <div class="splash-brand">
        <div class="splash-logo-mark"></div>
        <div class="splash-title">Revino</div>
        <div class="splash-tagline">
          Smart review.<br>
          <span>Stronger retention.</span>
        </div>
      </div>

      <div class="splash-illustration">
        <div class="splash-mascot">
          <div class="splash-mascot-face">
            <div class="splash-mascot-eyes">
              <span></span>
              <span></span>
            </div>
            <div class="splash-mascot-mouth"></div>
          </div>
          <div class="splash-mascot-deco"></div>
        </div>
      </div>

      <div style="width:100%">
        <div class="loading-bar">
          <div class="loading-fill"></div>
        </div>
        <div class="splash-dots">
          <span class="active"></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   ログイン画面
============================================================ */
function renderLogin() {
  return `
    <div class="auth-screen">
      <div class="auth-top">
        <div class="auth-logo"></div>
        <div class="auth-app-name">Revino</div>
        <div class="auth-screen-name">Welcome back. Let's keep learning.</div>
      </div>

      <div class="auth-card">
        <div class="form-group">
          <label class="form-label">${svg(IC.mail, 14)} メールアドレス</label>
          <input
            class="form-input"
            id="login-email"
            type="email"
            placeholder="example@email.com"
            autocomplete="email"
          >
        </div>

        <div class="form-group">
          <label class="form-label">${svg(IC.lock, 14)} パスワード</label>
          <input
            class="form-input"
            id="login-pw"
            type="password"
            placeholder="パスワードを入力"
            autocomplete="current-password"
          >
        </div>

        <div id="login-err" class="alert alert-error hidden"></div>

        <button class="btn btn-primary" type="button" onclick="doLogin()">
          ログイン ›
        </button>

        <button class="btn btn-outline mt12" type="button" onclick="navigate('register')">
          アカウントを作成
        </button>
      </div>
    </div>
  `;
}

/* ============================================================
   ログイン処理
============================================================ */
async function doLogin() {
  const emailEl = document.getElementById("login-email");
  const pwEl = document.getElementById("login-pw");
  const errEl = document.getElementById("login-err");

  const email = emailEl.value.trim();
  const password = pwEl.value;

  hideAuthError(errEl);

  if (!email || !password) {
    showAuthError(errEl, "メールアドレスとパスワードを入力してください");
    return;
  }

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        loginId: email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showAuthError(errEl, data.message || "ログインに失敗しました");
      return;
    }

    applyAuthUser(data.user);
    navigate("home");
  } catch {
    showAuthError(errEl, "通信エラーが発生しました");
  }
}

/* ============================================================
   アカウント作成画面
============================================================ */
function renderRegister() {
  registerUserTags = [];

  return `
    <div class="auth-screen">
      <div class="auth-top">
        <div class="auth-logo"></div>
        <div class="auth-app-name">Revino</div>
        <div class="auth-screen-name">Create your account</div>
      </div>

      <div class="auth-card">
        <div class="form-group">
          <label class="form-label">${svg(IC.user, 14)} 名前</label>
          <input
            class="form-input"
            id="reg-name"
            type="text"
            placeholder="例：田中 太郎"
            autocomplete="name"
          >
        </div>

        <div class="form-group">
          <label class="form-label">プロフィール</label>
          <textarea
            class="form-input profile-textarea"
            id="reg-profile"
            rows="3"
            placeholder="例：数学が好きです"
          ></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">ユーザータグ</label>

          <div class="tag-editor-row">
            <input
              class="form-input"
              id="reg-tag-input"
              type="text"
              maxlength="20"
              placeholder="例：数学"
              onkeydown="handleRegisterTagKeydown(event)"
            >
            <button class="btn btn-outline" type="button" onclick="addRegisterTag()">
              追加
            </button>
          </div>

          <div id="reg-selected-tags" class="selected-tags mt12"></div>
        </div>

        <div class="form-group">
          <label class="form-label">${svg(IC.mail, 14)} メールアドレス</label>
          <input
            class="form-input"
            id="reg-email"
            type="email"
            placeholder="example@email.com"
            autocomplete="email"
          >
        </div>

        <div class="form-group">
          <label class="form-label">${svg(IC.lock, 14)} パスワード（6文字以上）</label>
          <input
            class="form-input"
            id="reg-pw"
            type="password"
            placeholder="パスワードを入力"
            autocomplete="new-password"
          >
        </div>

        <div class="form-group">
          <label class="form-label">${svg(IC.lock, 14)} パスワード（確認）</label>
          <input
            class="form-input"
            id="reg-pw2"
            type="password"
            placeholder="もう一度入力"
            autocomplete="new-password"
          >
        </div>

        <div id="reg-err" class="alert alert-error hidden"></div>

        <button class="btn btn-gold" type="button" onclick="doRegister()">
          アカウントを作成
        </button>

        <div class="form-link mt12">
          すでにアカウントをお持ちの方は
          <span onclick="navigate('login')">ログイン</span>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   タグ処理
============================================================ */
function initRegisterScreen() {
  renderRegisterTags();
}

function renderRegisterTags() {
  const selectedTags = document.getElementById("reg-selected-tags");

  if (!selectedTags) {
    return;
  }

  selectedTags.innerHTML = "";

  if (registerUserTags.length === 0) {
    selectedTags.textContent = "タグ未追加";
    return;
  }

  registerUserTags.forEach((tag, index) => {
    const tagElement = document.createElement("span");
    tagElement.className = "selected-tag";

    const tagText = document.createElement("span");
    tagText.textContent = tag;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-tag-button";
    removeButton.textContent = "×";
    removeButton.onclick = () => removeRegisterTag(index);

    tagElement.appendChild(tagText);
    tagElement.appendChild(removeButton);
    selectedTags.appendChild(tagElement);
  });
}

function addRegisterTag() {
  const tagInput = document.getElementById("reg-tag-input");
  const errEl = document.getElementById("reg-err");

  if (!tagInput) {
    return;
  }

  const tag = tagInput.value.trim();

  if (!tag) {
    return;
  }

  if (tag.length > 20) {
    showAuthError(errEl, "タグは20文字以内で入力してください");
    return;
  }

  if (registerUserTags.includes(tag)) {
    showAuthError(errEl, "同じタグは追加できません");
    tagInput.value = "";
    return;
  }

  if (registerUserTags.length >= 10) {
    showAuthError(errEl, "タグは10個まで追加できます");
    return;
  }

  registerUserTags.push(tag);
  tagInput.value = "";
  hideAuthError(errEl);
  renderRegisterTags();
}

function removeRegisterTag(index) {
  registerUserTags.splice(index, 1);
  renderRegisterTags();
}

function handleRegisterTagKeydown(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    addRegisterTag();
  }
}

/* ============================================================
   アカウント作成処理
============================================================ */
async function doRegister() {
  const nameEl = document.getElementById("reg-name");
  const profileEl = document.getElementById("reg-profile");
  const emailEl = document.getElementById("reg-email");
  const pwEl = document.getElementById("reg-pw");
  const pw2El = document.getElementById("reg-pw2");
  const errEl = document.getElementById("reg-err");

  const username = nameEl.value.trim();
  const profile = profileEl.value.trim();
  const email = emailEl.value.trim();
  const password = pwEl.value;
  const passwordConfirm = pw2El.value;

  hideAuthError(errEl);

  if (!username || !email || !password) {
    showAuthError(errEl, "名前、メールアドレス、パスワードを入力してください");
    return;
  }

  if (password.length < 6) {
    showAuthError(errEl, "パスワードは6文字以上で入力してください");
    return;
  }

  if (password !== passwordConfirm) {
    showAuthError(errEl, "パスワードが一致しません");
    return;
  }

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        profile,
        userTags: registerUserTags,
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showAuthError(errEl, data.message || "アカウント作成に失敗しました");
      return;
    }

    applyAuthUser(data.user);
    navigate("home");
  } catch {
    showAuthError(errEl, "通信エラーが発生しました");
  }
}

/* ============================================================
   ログアウト処理
============================================================ */
async function doLogout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    S.user = null;
    save();
    navigate("login");
  }
}

/* ============================================================
   エラー表示
============================================================ */
function showAuthError(el, msg) {
  if (!el) {
    alert(msg);
    return;
  }

  el.textContent = msg;
  el.className = "alert alert-error";
}

function hideAuthError(el) {
  if (!el) {
    return;
  }

  el.textContent = "";
  el.className = "alert alert-error hidden";
}