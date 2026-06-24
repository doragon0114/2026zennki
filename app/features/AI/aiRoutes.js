const express = require("express");
const router = express.Router();
const { randomUUID } = require("crypto");
const db = require("../DB/dbRoutes");

console.log("DB接続情報:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME
});

// ==================================================
// Google Vision AI で画像からテキスト抽出
// POST /api/AI/ocr
// ==================================================
router.post("/ocr", async (req, res) => {
  const { image } = req.body;

  if (!image) {
    return res.status(400).json({
      ok: false,
      error: "image is required"
    });
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: image
              },
              features: [
                {
                  type: "TEXT_DETECTION"
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Google Vision APIでエラーが発生しました");
    }

    const text =
      data.responses?.[0]?.fullTextAnnotation?.text ||
      "テキストが見つかりませんでした";

    res.json({
      ok: true,
      text
    });
  } catch (err) {
    console.error("ocr error:", err);

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ==================================================
// Ollama で問題生成 → MySQLに保存
// POST /api/AI/generate
//
// 保存先:
// categories
// materials
// question
// question_choices
//
// リクエストボディ:
// {
//   text,
//   userId,
//   categoryId?,    // 数字
//   categoryName?,  // 例: 基本情報
//   materialName?
// }
// ==================================================
router.post("/generate", async (req, res) => {
  const {
    text,
    userId,
    categoryId,
    categoryName,
    materialName
  } = req.body;

  if (!text) {
    return res.status(400).json({
      ok: false,
      error: "text is required"
    });
  }

  if (!userId) {
    return res.status(400).json({
      ok: false,
      error: "userId is required"
    });
  }

  try {
    // ==================================================
    // 1. Ollamaで問題生成
    // ==================================================
    const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "qwen2.5:3b",
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
    "answer": "C",
    "explanation": "正解の根拠（1〜2文）+代表的な誤答がなぜ違うか（1文）"
  }
]

5問の正解をA・B・C・Dに1〜2問ずつ分散させること。

【ノートの内容】
${text}`,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }

    const data = await response.json();

    let raw = String(data.response || "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("JSONが見つかりませんでした");
    }

    raw = raw.slice(start, end + 1);
    raw = raw.replace(/[\x00-\x1F\x7F]/g, " ");

    const generatedQuestions = JSON.parse(raw);

    if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
      throw new Error("問題データが空です");
    }

    // ==================================================
    // 2. AI出力をDB保存用に変換
    // ==================================================
    const normalized = generatedQuestions.slice(0, 5).map((q, index) => {
      const choicesObj = q.choices || {};

      const choiceKeys = ["A", "B", "C", "D"];
      const choices = choiceKeys.map(key => {
        return String(choicesObj[key] || "").trim();
      });

      const answer = String(q.answer || "").trim().toUpperCase();
      const correct = choiceKeys.indexOf(answer);

      if (!q.question || choices.some(choice => !choice)) {
        throw new Error(`${index + 1}問目の形式が正しくありません`);
      }

      return {
        text: String(q.question).trim(),
        choices,
        correct: correct === -1 ? 0 : correct,
        explanation: String(q.explanation || "").trim()
      };
    });

    // ==================================================
    // 3. カテゴリを決定
    // SQL変更後:
    // categories.category_id は INT AUTO_INCREMENT
    // ==================================================
    let finalCategoryId = null;

    if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
      const category = await db.findCategoryById(categoryId);

      if (!category) {
        return res.status(400).json({
          ok: false,
          error: "指定されたカテゴリIDが存在しません"
        });
      }

      finalCategoryId = category.category_id;
    } else if (categoryName) {
      const category = await db.findOrCreateCategoryByName(categoryName);
      finalCategoryId = category ? category.category_id : null;
    }

    // ==================================================
    // 4. materials に問題セットを作成
    // ==================================================
    const materialId = randomUUID();

    await db.createQuestionList(
      materialId,
      userId,
      finalCategoryId,
      materialName || "生成された問題セット",
      text
    );

    // ==================================================
    // 5. question / question_choices に問題を保存
    // ==================================================
    const saved = [];

    for (const q of normalized) {
      const questionId = randomUUID();
      const question = await db.createQuestion(questionId, materialId, q);
      saved.push(question);
    }

    console.log(`問題セット ${materialId} に ${saved.length} 問保存しました`);

    res.json({
      ok: true,
      materialId,
      categoryId: finalCategoryId,
      questions: normalized,
      saved
    });
  } catch (err) {
    console.error("generate error:", err);

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;