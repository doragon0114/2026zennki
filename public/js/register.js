const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

const tagInput = document.getElementById("tagInput");
const addTagButton = document.getElementById("addTagButton");
const selectedTags = document.getElementById("selectedTags");

const userTags = [];

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

function renderTags() {
  selectedTags.innerHTML = "";

  if (userTags.length === 0) {
    selectedTags.textContent = "タグ未追加";
    return;
  }

  userTags.forEach((tag, index) => {
    const tagElement = document.createElement("span");
    tagElement.className = "selected-tag";

    const tagText = document.createElement("span");
    tagText.textContent = tag;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-tag-button";
    removeButton.textContent = "×";
    removeButton.dataset.index = index;

    tagElement.appendChild(tagText);
    tagElement.appendChild(removeButton);
    selectedTags.appendChild(tagElement);
  });
}

function addTag() {
  const tag = tagInput.value.trim();

  if (!tag) {
    return;
  }

  if (tag.length > 20) {
    showMessage("タグは20文字以内で入力してください", "error");
    return;
  }

  if (userTags.includes(tag)) {
    showMessage("同じタグは追加できません", "error");
    tagInput.value = "";
    return;
  }

  if (userTags.length >= 10) {
    showMessage("タグは10個まで追加できます", "error");
    return;
  }

  userTags.push(tag);
  tagInput.value = "";
  message.className = "alert alert-error hidden";
  message.textContent = "";
  renderTags();
}

window.addEventListener("DOMContentLoaded", async () => {
  renderTags();

  try {
    const response = await fetch("/api/auth/me");

    if (response.ok) {
      location.href = "/home";
    }
  } catch {
    // 未ログイン扱いなので何もしない
  }
});

addTagButton.addEventListener("click", addTag);

tagInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTag();
  }
});

selectedTags.addEventListener("click", (event) => {
  if (!event.target.classList.contains("remove-tag-button")) {
    return;
  }

  const index = Number(event.target.dataset.index);
  userTags.splice(index, 1);
  renderTags();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.className = "alert alert-error hidden";
  message.textContent = "";

  const username = document.getElementById("username").value.trim();
  const profile = document.getElementById("profile").value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        profile,
        userTags,
        email,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage(data.message || "アカウント作成に失敗しました", "error");
      return;
    }

    location.href = "/home";
  } catch {
    showMessage("通信エラーが発生しました", "error");
  }
});