const express = require("express");
const session = require("express-session");
const path = require("path");

require("dotenv").config();

const authRoutes = require("./features/auth/authRoutes");
const ollamaRoutes = require("./ollama/ollamaRoutes");
const pageRoutes = require("./routes/pageRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

const publicPath = path.join(__dirname, "public");

// ===== 共通ミドルウェア =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== セッション設定 =====
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-this-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24
    }
  })
);

// ==================================================
// Revino本体API
// ==================================================
app.use("/api/auth", authRoutes);

// ==================================================
// Ollama確認用API
// featuresには入れず、app/ollama にまとめる
// ==================================================
if (process.env.ENABLE_OLLAMA_TOOLS !== "false") {
  app.use("/api/ollama", ollamaRoutes);
}

// ===== サーバー確認 =====
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: "running",
    app: "revino",
    publicPath,
    ollamaTools: process.env.ENABLE_OLLAMA_TOOLS !== "false"
  });
});

// ==================================================
// 画面ルーター
// ==================================================
// home.html / mypage.html / battle.html などの保護ルートは、
// express.static より前に登録する
app.use("/", pageRoutes);

// ==================================================
// 静的ファイル
// docker-compose 側の ./public が /usr/src/app/public にマウントされる想定
// ==================================================
app.use(express.static(publicPath));

// ==================================================
// 404
// ==================================================
app.use((req, res) => {
  res.status(404).send(`
    <h1>404 Not Found</h1>
    <p>ページが見つかりません。</p>
    <p>${req.originalUrl}</p>
  `);
});

// ==================================================
// 起動
// ==================================================
app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});