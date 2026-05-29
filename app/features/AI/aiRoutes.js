const express = require('express');
const router = express.Router();

// Google Vision AI で画像からテキスト抽出
router.post('/ocr', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image is required' });

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        })
      }
    );
    const data = await response.json();
    const text = data.responses?.[0]?.fullTextAnnotation?.text
      || 'テキストが見つかりませんでした';
    res.json({ text });
  } catch (err) {
    console.error('ocr error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Ollama で問題生成
router.post('/generate', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:3b',
        prompt: `以下の授業ノートの内容から、理解度を確認するための4択問題を5問作成してください。
必ず以下のJSON形式のみで回答してください。前置きや説明は不要です。

[
  {
    "question": "問題文をここに書く",
    "choices": {
      "A": "選択肢A",
      "B": "選択肢B",
      "C": "選択肢C",
      "D": "選択肢D"
    },
    "answer": "A",
    "explanation": "解説文をここに書く"
  }
]

【ノートの内容】
${text}`,
        stream: false
      })
    });

    const data = await response.json();
    console.log('ollama raw response:', data.response);

    let raw = data.response;
    raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();

    // [ から ] までを切り出す
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('JSONが見つかりませんでした');
    raw = raw.substring(start, end + 1);

    const questions = JSON.parse(raw);
    res.json({ questions });
  } catch (err) {
    console.error('generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;