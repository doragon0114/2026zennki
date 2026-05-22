const express = require("express");

const router = express.Router();

function getOllamaUrl() {
  return process.env.OLLAMA_URL || "http://ollama:11434";
}

function getDefaultModel() {
  return process.env.OLLAMA_MODEL || "qwen2.5:3b";
}

// GET /api/ollama/health
router.get("/health", async (req, res) => {
  try {
    const response = await fetch(`${getOllamaUrl()}/api/tags`);

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        ollama: "error",
        url: getOllamaUrl(),
        status: response.status
      });
    }

    const data = await response.json();

    res.json({
      ok: true,
      ollama: "connected",
      url: getOllamaUrl(),
      models: data.models || []
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      ollama: "disconnected",
      url: getOllamaUrl(),
      message: error.message
    });
  }
});

// POST /api/ollama/chat
router.post("/chat", async (req, res) => {
  const {
    prompt,
    model = getDefaultModel()
  } = req.body;

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({
      ok: false,
      message: "prompt が空です"
    });
  }

  try {
    const response = await fetch(`${getOllamaUrl()}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        message: "Ollama API の呼び出しに失敗しました",
        detail: data
      });
    }

    res.json({
      ok: true,
      model,
      response: data.response || "",
      raw: data
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Ollamaとの通信に失敗しました",
      error: error.message
    });
  }
});

module.exports = router;