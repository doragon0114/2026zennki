const express = require("express");
const path = require("path");
const fs = require("fs");

const router = express.Router();

const publicPath = path.join(__dirname, "../public");
const ollamaPath = path.join(__dirname, "../ollama");

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

const sendIndex = sendPublicPage("index.html");

// ==================================================
// SPA入口
// ==================================================
// どの画面URLでも index.html を返す。
// 実際の画面切り替えは public/js/shared.js の navigate() が行う。
// ==================================================

router.get("/", sendIndex);
router.get("/index.html", sendIndex);

// 認証系
router.get("/splash", sendIndex);
router.get("/splash.html", sendIndex);
router.get("/login", sendIndex);
router.get("/login.html", sendIndex);
router.get("/register", sendIndex);
router.get("/register.html", sendIndex);

// メイン画面
router.get("/home", sendIndex);
router.get("/home.html", sendIndex);
router.get("/materials", sendIndex);
router.get("/upload", sendIndex);
router.get("/ranking", sendIndex);
router.get("/mypage", sendIndex);

// 学習系
router.get("/question-set", sendIndex);
router.get("/question-edit", sendIndex);
router.get("/study", sendIndex);
router.get("/study-result", sendIndex);

// 対戦系
router.get("/battle", sendIndex);
router.get("/battle.html", sendIndex);
router.get("/battle-start", sendIndex);
router.get("/battle-start.html", sendIndex);
router.get("/battle-result", sendIndex);
router.get("/battle-result.html", sendIndex);
router.get("/battle-history", sendIndex);
router.get("/battle-history.html", sendIndex);

// プロフィール系
router.get("/profile-edit", sendIndex);

// Ollama確認画面だけは app/ollama 側のHTMLを返す
if (process.env.ENABLE_OLLAMA_TOOLS !== "false") {
  router.get("/ollama-test", sendOllamaPage("ollama-test.html"));
  router.get("/ollama-test.html", sendOllamaPage("ollama-test.html"));
}

module.exports = router;