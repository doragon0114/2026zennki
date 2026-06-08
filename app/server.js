
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const path = require("path");
const http = require("http");

const authRoutes = require("./features/auth/authRoutes");
const pageRoutes = require("./routes/pageRoutes");
const ollamaRoutes = require("./ollama/ollamaRoutes");
const studyRoutes = require("./features/study/studyRoutes");
const aiRoutes = require("./features/AI/aiRoutes");  // 追加
const materialsRoutes = require("./features/materials/materialsRoutes");

const { initBattleWebSocket } = require("./features/battle/battleSocket");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, "public");

// ===== 共通ミドルウェア =====
app.use(express.json({ limit: "10mb" }));  // 変更: 画像base64転送に対応
app.use(express.urlencoded({ extended: true }));
app.use("/api/materials", materialsRoutes);

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
// API
// ==================================================

// 認証API
app.use("/api/auth", authRoutes);
app.use("/api/study", studyRoutes);

// Ollama確認用API
if (process.env.ENABLE_OLLAMA_TOOLS !== "false") {
  app.use("/api/ollama", ollamaRoutes);
}

// AI解析API（OCR・問題生成）  // 追加
app.use("/api/AI", aiRoutes);

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
app.use("/", pageRoutes);

// ==================================================
// 静的ファイル
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
// WebSocket対戦機能
// ==================================================
initBattleWebSocket(server);

// ==================================================
// 起動
// ==================================================
server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});