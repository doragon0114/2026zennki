const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

function showMessage(text, type = "error") {
  message.textContent = text;
  message.className = `alert alert-${type}`;
}

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/api/auth/me");

    if (response.ok) {
      location.href = "/home";
    }
  } catch {
    // 未ログイン扱いなので何もしない
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.className = "alert alert-error hidden";
  message.textContent = "";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

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
      showMessage(data.message || "ログインに失敗しました", "error");
      return;
    }

    location.href = "/home";
  } catch {
    showMessage("通信エラーが発生しました", "error");
  }
});