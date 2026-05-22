const mypageScreen = document.getElementById("mypageScreen");
const profileEditScreen = document.getElementById("profileEditScreen");
const bottomNav = document.getElementById("bottomNav");

const mypageAvatar = document.getElementById("mypageAvatar");
const mypageName = document.getElementById("mypageName");
const mypageEmail = document.getElementById("mypageEmail");
const levelBadge = document.getElementById("levelBadge");

const pointsValue = document.getElementById("pointsValue");
const winsValue = document.getElementById("winsValue");
const studiedValue = document.getElementById("studiedValue");
const questionCountValue = document.getElementById("questionCountValue");

const openProfileEditButton = document.getElementById("openProfileEditButton");
const backToMypageButton = document.getElementById("backToMypageButton");
const logoutButton = document.getElementById("logoutButton");

const profileForm = document.getElementById("profileForm");
const profileMessage = document.getElementById("profileMessage");

const editName = document.getElementById("editName");
const editEmail = document.getElementById("editEmail");

const avatarPicker = document.getElementById("avatarPicker");
const previewAvatar = document.getElementById("previewAvatar");

const AVATARS = ["🐧", "🦊", "🐻", "🐱", "🐼", "🦋", "🦁", "🐸", "🐯", "🦄", "🐮", "🐺"];

let currentUser = null;
let selectedAvatar = localStorage.getItem("revino_avatar") || "🐧";

function getLevel(points) {
  return Math.floor(Number(points || 0) / 100) + 1;
}

function getStoredStats() {
  try {
    return JSON.parse(localStorage.getItem("revino_stats") || "{}");
  } catch {
    return {};
  }
}

function showProfileMessage(text, type = "error") {
  profileMessage.textContent = text;
  profileMessage.className = `alert alert-${type}`;
}

function hideProfileMessage() {
  profileMessage.textContent = "";
  profileMessage.className = "alert hidden";
}

function showMypage() {
  profileEditScreen.classList.add("static-hidden");
  mypageScreen.classList.remove("static-hidden");
  bottomNav.classList.remove("hidden");
  hideProfileMessage();
}

function showProfileEdit() {
  mypageScreen.classList.add("static-hidden");
  profileEditScreen.classList.remove("static-hidden");
  bottomNav.classList.add("hidden");
  hideProfileMessage();
}

function renderAvatars() {
  avatarPicker.innerHTML = AVATARS
    .map((avatar) => {
      const selected = avatar === selectedAvatar ? "selected" : "";

      return `
        <button
          class="avatar-option ${selected}"
          type="button"
          data-avatar="${avatar}"
          aria-label="${avatar}を選択"
        >
          ${avatar}
        </button>
      `;
    })
    .join("");

  previewAvatar.textContent = selectedAvatar;
}

function applyUserToView(user) {
  const stats = getStoredStats();

  const points = Number(user.points ?? stats.points ?? 0);
  const wins = Number(user.wins ?? stats.wins ?? 0);
  const totalStudied = Number(user.totalStudied ?? stats.totalStudied ?? 0);
  const questionCount = Number(user.questionCount ?? stats.questionCount ?? 0);

  mypageAvatar.textContent = selectedAvatar;
  mypageName.textContent = user.username || "ユーザー";
  mypageEmail.textContent = user.email || "";

  levelBadge.textContent = `Lv. ${getLevel(points)}`;
  pointsValue.textContent = points;
  winsValue.textContent = wins;
  studiedValue.textContent = totalStudied;
  questionCountValue.textContent = questionCount;

  editName.value = user.username || "";
  editEmail.value = user.email || "";

  renderAvatars();
}

async function loadMyProfile() {
  try {
    const response = await fetch("/api/auth/me");

    if (!response.ok) {
      location.href = "/login.html";
      return;
    }

    const data = await response.json();
    currentUser = data.user;

    applyUserToView(currentUser);
  } catch {
    location.href = "/login.html";
  }
}

avatarPicker.addEventListener("click", (event) => {
  const button = event.target.closest(".avatar-option");

  if (!button) {
    return;
  }

  selectedAvatar = button.dataset.avatar;
  localStorage.setItem("revino_avatar", selectedAvatar);

  renderAvatars();
});

openProfileEditButton.addEventListener("click", showProfileEdit);
backToMypageButton.addEventListener("click", showMypage);

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  hideProfileMessage();

  const username = editName.value.trim();

  if (!username) {
    showProfileMessage("名前を入力してください", "error");
    return;
  }

  try {
    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        email: currentUser.email,
        profile: currentUser.profile || "",
        userTags: Array.isArray(currentUser.userTags) ? currentUser.userTags : []
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showProfileMessage(data.message || "プロフィール更新に失敗しました", "error");
      return;
    }

    currentUser = data.user;

    localStorage.setItem("revino_avatar", selectedAvatar);
    applyUserToView(currentUser);

    showProfileMessage("保存しました", "success");

    setTimeout(() => {
      showMypage();
    }, 700);
  } catch {
    showProfileMessage("通信エラーが発生しました", "error");
  }
});

logoutButton.addEventListener("click", async () => {
  if (!confirm("ログアウトしますか？")) {
    return;
  }

  try {
    await fetch("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    location.href = "/login.html";
  }
});

loadMyProfile();