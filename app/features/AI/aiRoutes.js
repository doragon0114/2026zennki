const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../DB/dbRoutes');

console.log('DB接続情報:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
});

function createId() {
  return crypto.randomBytes(2).toString('hex'); // CHAR(4)に合わせて4文字
}

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

// Ollama で問題生成 → MySQLに保存
router.post('/generate', async (req, res) => {
  const { text, categoryId } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });

  try {
    // ① Ollamaで問題生成
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

    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) throw new Error('JSONが見つかりませんでした');
    // raw = raw.substring(start, end + 1);
    raw = raw.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\s+/g, ' ');

    const questions = JSON.parse(raw);

    // ② choicesを配列・correctをインデックスに変換
    const normalized = questions.map((q) => {
      const choicesArr = Object.values(q.choices);
      const answerIndex = Object.keys(q.choices).indexOf(q.answer);
      return {
        text: q.question,
        choices: choicesArr,
        correct: answerIndex === -1 ? 0 : answerIndex,
        explanation: q.explanation || '',
      };
    });

    // ③ 問題リストを作成してMySQLに保存
    const qlistId = createId();
    const catId = categoryId || '0001'; // カテゴリーIDは仮値
    await db.createQuestionList(qlistId, catId);

    const saved = [];
    for (const q of normalized) {
      const qid = createId();
      const question = await db.createQuestion(qid, qlistId, q);
      saved.push(question);
    }

    console.log(`問題リスト ${qlistId} に ${saved.length} 問保存しました`);

    res.json({ questions: normalized, qlistId });
  } catch (err) {
    console.error('generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;