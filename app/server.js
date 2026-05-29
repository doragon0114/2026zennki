const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");

require("dotenv").config();

const authRoutes = require("./features/auth/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const ollamaRoutes = require("./ollama/ollamaRoutes");
const studyRoutes = require("./features/study/studyRoutes");

const { initBattleWebSocket } = require("./features/battle/battleSocket");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, "public");

// ===== 共通ミドルウェア =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== セッション設定 =====
// 現在の auth.js が localStorage 認証なら、画面遷移には requireLogin を使わない。
// ただし、後でサーバー認証へ戻せるように session は残しておく。
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
// API
// ==================================================

// 認証API
// 今の auth.js は localStorage 認証ですが、後でAPI認証へ戻す場合に使えます。
app.use("/api/auth", authRoutes);
app.use("/api/study", studyRoutes);

// Ollama確認用API
if (process.env.ENABLE_OLLAMA_TOOLS !== "false") {
  app.use("/api/ollama", ollamaRoutes);
}

// サーバー確認
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    server: "running",
    app: "revino",
    mode: "spa",
    index: "/index.html",
    websocket: "/ws/battle",
    publicPath,
    ollamaTools: process.env.ENABLE_OLLAMA_TOOLS !== "false"
  });
});

// ==================================================
// 画面ルーター
// ==================================================
// /home, /battle, /mypage などは全部 index.html を返す。
// index.html 内で shared.js の navigate() が画面を切り替える。
app.use("/", pageRoutes);

// ==================================================
// 静的ファイル
// ==================================================
// /css/style.css
// /js/shared.js
// /js/home.js
// などを配信する。
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
// WebSocket対戦機能
// ==================================================
// battle.js が /ws/battle に接続するため、app.listen ではなく
// http.createServer(app) に WebSocket を乗せる。
initBattleWebSocket(server);

// ==================================================
// 起動
// ==================================================
server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});