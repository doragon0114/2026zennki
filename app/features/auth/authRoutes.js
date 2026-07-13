const express = require("express");
const authService = require("./authRepository");

const router = express.Router();

// アカウント作成
router.post("/register", async (req, res) => {
  try {
    const {
      username,
      profile,
      userTags,
      email,
      password
    } = req.body;

    const user = await authService.createUser({
      username,
      profile,
      userTags,
      email,
      password
    });

    req.session.userId = user.userId;

    res.status(201).json({
      ok: true,
      message: "アカウントを作成しました",
      user
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error.message
    });
  }
});

// ログイン
router.post("/login", async (req, res) => {
  try {
    const { loginId, password } = req.body;

    const user = await authService.loginUser({
      loginId,
      password
    });

    req.session.userId = user.userId;

    res.json({
      ok: true,
      message: "ログインしました",
      user
    });
  } catch (error) {
    res.status(401).json({
      ok: false,
      message: error.message
    });
  }
});

// ログアウト
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      ok: true,
      message: "ログアウトしました"
    });
  });
});

// ログイン中ユーザー取得
router.get("/me", async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        ok: false,
        message: "ログインしていません"
      });
    }

    const user = await authService.findPublicUserByUserId(req.session.userId);

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "ユーザーが見つかりません"
      });
    }

    res.json({
      ok: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "ユーザー情報の取得に失敗しました"
    });
  }
});

// プロフィール更新
router.put("/profile", async (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        ok: false,
        message: "ログインしていません"
      });
    }

    const {
      username,
      profile,
      userTags,
      email,
      avatar
    } = req.body;

    const user = await authService.updateUserProfile(req.session.userId, {
      username,
      profile,
      userTags,
      email,
      avatar
    });

    res.json({
      ok: true,
      message: "プロフィールを更新しました",
      user
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error.message
    });
  }
});

module.exports = router;