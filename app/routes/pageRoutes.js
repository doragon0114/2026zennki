const express = require("express");
const path = require("path");
const fs = require("fs");

const requireLogin = require("../middleware/requireLogin");

const router = express.Router();

const publicPath = path.join(__dirname, "../public");
const ollamaPath = path.join(__dirname, "../ollama");

// ===== 画面送信用ヘルパー =====
function sendPublicPage(fileName) {
  return (req, res) => {
    const filePath = path.join(publicPath, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(`
        <h1>404 Not Found</h1>
        <p>${fileName} が public フォルダ内に見つかりません。</p>
        <p>確認先: ${filePath}</p>
      `);
    }

    res.sendFile(filePath);
  };
}

function sendOllamaPage(fileName) {
  return (req, res) => {
    const filePath = path.join(ollamaPath, fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).send(`
        <h1>404 Not Found</h1>
        <p>${fileName} が ollama フォルダ内に見つかりません。</p>
        <p>確認先: ${filePath}</p>
      `);
    }

    res.sendFile(filePath);
  };
}

// ==================================================
// 通常画面
// ==================================================

// アプリ開始
router.get("/", (req, res) => {
  res.redirect("/splash.html");
});

router.get("/splash", (req, res) => {
  res.redirect("/splash.html");
});

// 認証画面
router.get("/login", (req, res) => {
  res.redirect("/login.html");
});

router.get("/register", (req, res) => {
  res.redirect("/register.html");
});

// ==================================================
// ログイン必須画面
// ==================================================

// ホーム
router.get(["/home", "/home.html"], requireLogin, sendPublicPage("home.html"));

// マイページ
router.get(["/mypage", "/mypage.html"], requireLogin, sendPublicPage("mypage.html"));

// 対戦機能用
router.get(
  ["/battle-start", "/battle-start.html"],
  requireLogin,
  sendPublicPage("battle-start.html")
);

router.get(
  ["/battle", "/battle.html"],
  requireLogin,
  sendPublicPage("battle.html")
);

router.get(
  ["/battle-result", "/battle-result.html"],
  requireLogin,
  sendPublicPage("battle-result.html")
);

// ==================================================
// Ollama確認画面
// featuresには入れず app/ollama にまとめる
// ==================================================

if (process.env.ENABLE_OLLAMA_TOOLS !== "false") {
  router.get("/ollama-test", sendOllamaPage("ollama-test.html"));
  router.get("/ollama-test.html", sendOllamaPage("ollama-test.html"));
}

module.exports = router;