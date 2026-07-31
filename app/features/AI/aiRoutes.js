const express = require("express");
const router = express.Router();
const { randomUUID } = require("crypto");
const http = require("http");
const https = require("https");
const db = require("../DB/dbRoutes");

const {
  reviewQuestionsWithGemini
} = require("./geminiQuestionReviewer");

const OLLAMA_WAIT_TIMEOUT_MS =
  60 * 60 * 1000;

const MAX_AI_SOURCE_TEXT_LENGTH =
  3500;

let ollamaQueue =
  Promise.resolve();

let ollamaQueuedCount =
  0;

function enqueueOllamaJob(job) {
  ollamaQueuedCount++;

  const run =
    ollamaQueue.then(
      async () => {
        ollamaQueuedCount =
          Math.max(
            0,
            ollamaQueuedCount - 1
          );

        return await job();
      },
      async () => {
        ollamaQueuedCount =
          Math.max(
            0,
            ollamaQueuedCount - 1
          );

        return await job();
      }
    );

  ollamaQueue =
    run.catch(() => {});

  return run;
}

function postJsonLongWait(
  url,
  body,
  timeoutMs = OLLAMA_WAIT_TIMEOUT_MS
) {
  return new Promise((resolve, reject) => {
    const target =
      new URL(url);

    const payload =
      JSON.stringify(body);

    const client =
      target.protocol === "https:"
        ? https
        : http;

    const req =
      client.request(
        {
          protocol:
            target.protocol,

          hostname:
            target.hostname,

          port:
            target.port,

          path:
            `${target.pathname}${target.search}`,

          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Content-Length":
              Buffer.byteLength(payload)
          },

          timeout:
            timeoutMs
        },
        response => {
          let responseText =
            "";

          response.setEncoding(
            "utf8"
          );

          response.on(
            "data",
            chunk => {
              responseText +=
                chunk;
            }
          );

          response.on(
            "end",
            () => {
              resolve({
                ok:
                  response.statusCode >= 200 &&
                  response.statusCode < 300,

                status:
                  response.statusCode,

                text:
                  async () =>
                    responseText,

                json:
                  async () =>
                    JSON.parse(responseText)
              });
            }
          );
        }
      );

    req.on(
      "timeout",
      () => {
        req.destroy(
          new Error(
            `request timeout after ${timeoutMs}ms`
          )
        );
      }
    );

    req.on(
      "error",
      reject
    );

    req.write(payload);
    req.end();
  });
}

function buildPromptSourceText(sourceText) {
  const text =
    String(sourceText || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  if (
    text.length <=
    MAX_AI_SOURCE_TEXT_LENGTH
  ) {
    return text;
  }

  return text.slice(
    0,
    MAX_AI_SOURCE_TEXT_LENGTH
  );
}

function extractGeneratedQuestionArray(rawResponse) {
  const raw =
    String(rawResponse || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/[“”]/g, '"')
      .trim();

  if (!raw) {
    throw new Error(
      "Ollamaの回答が空でした"
    );
  }

  try {
    const parsed =
      JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (Array.isArray(parsed.questions)) {
      return parsed.questions;
    }
  } catch {
    // 下の配列抽出へ進む
  }

  const start =
    raw.indexOf("[");

  const end =
    raw.lastIndexOf("]");

  if (
    start === -1 ||
    end === -1 ||
    end <= start
  ) {
    console.error(
      "Ollama raw response preview:",
      raw.slice(0, 1000)
    );

    throw new Error(
      "Ollamaの回答からJSON配列を取得できませんでした"
    );
  }

  const sliced =
    raw
      .slice(start, end + 1)
      .replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(sliced);
}

function getUsefulTermsFromText(sourceText) {
  const text =
    String(sourceText || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[「」『』【】（）()［］\[\]・●□※→⇒]/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();

  const terms =
    text.match(
      /[A-Za-z0-9一-龥ぁ-んァ-ヶー]{2,30}/g
    ) || [];

  const ignore =
    new Set([
      "No",
      "Date",
      "これ",
      "それ",
      "ため",
      "こと",
      "もの",
      "こっち",
      "必要",
      "抽出",
      "データ",
      "のみ"
    ]);

  const unique = [];

  for (const term of terms) {
    const value =
      String(term || "").trim();

    if (
      value.length < 2 ||
      ignore.has(value) ||
      /^\d+$/.test(value)
    ) {
      continue;
    }

    if (!unique.includes(value)) {
      unique.push(value);
    }
  }

  return unique.slice(0, 12);
}

function getUsefulLinesFromText(sourceText) {
  return String(sourceText || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => {
      return line
        .replace(/[ \t]+/g, " ")
        .trim();
    })
    .filter(line => {
      if (line.length < 5) {
        return false;
      }

      if (/^(No\.?|Date|D|AP|PB|\d+)$/.test(line)) {
        return false;
      }

      return true;
    })
    .slice(0, 8);
}

function shortenText(value, maxLength = 60) {
  const text =
    String(value || "").trim();

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength) + "...";
}

function buildFallbackQuestionsFromText(sourceText) {
  const terms =
    getUsefulTermsFromText(sourceText);

  const lines =
    getUsefulLinesFromText(sourceText);

  const mainTerm =
    terms[0] ||
    "資料の内容";

  const secondTerm =
    terms[1] ||
    "重要語句";

  const thirdTerm =
    terms[2] ||
    "関連語句";

  const firstLine =
    lines[0] ||
    sourceText;

  const secondLine =
    lines[1] ||
    firstLine;

  const thirdLine =
    lines[2] ||
    secondLine;

  return [
    {
      question:
        "この資料で主に扱われている内容として最も適切なものはどれですか。",
      choices: {
        A: shortenText(mainTerm),
        B: "天気と気候の分類",
        C: "古典文学の作者名",
        D: "化学反応式の計算"
      },
      answer: "A",
      explanation:
        `資料内に「${shortenText(mainTerm, 80)}」という語句が含まれているためです。`
    },
    {
      question:
        "資料に登場する語句として正しいものはどれですか。",
      choices: {
        A: shortenText(secondTerm),
        B: "鎌倉幕府",
        C: "光合成",
        D: "二次方程式"
      },
      answer: "A",
      explanation:
        `資料内に「${shortenText(secondTerm, 80)}」という語句が確認できます。`
    },
    {
      question:
        "資料の説明内容に含まれているものとして最も近いものはどれですか。",
      choices: {
        A: shortenText(firstLine),
        B: "英単語の発音練習",
        C: "歴史上の人物の年表",
        D: "地層のでき方"
      },
      answer: "A",
      explanation:
        `資料には「${shortenText(firstLine, 100)}」とあります。`
    },
    {
      question:
        "資料の中で関連して説明されている語句はどれですか。",
      choices: {
        A: shortenText(thirdTerm),
        B: "俳句の季語",
        C: "酸素の発生方法",
        D: "三角形の合同条件"
      },
      answer: "A",
      explanation:
        `資料中に「${shortenText(thirdTerm, 80)}」が含まれているためです。`
    },
    {
      question:
        "資料の内容を確認する説明として最も適切なものはどれですか。",
      choices: {
        A: shortenText(secondLine || thirdLine),
        B: "資料とは関係のない内容を暗記する",
        C: "画像のファイル名だけを確認する",
        D: "資料にない一般知識だけを使う"
      },
      answer: "A",
      explanation:
        `資料本文には「${shortenText(secondLine || thirdLine, 100)}」という内容があります。`
    }
  ];
}

const QUESTION_LIST_SCHEMA = {
  type: "object",
  additionalProperties: false,

  required: [
    "questions"
  ],

  properties: {
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 5,

      items: {
        type: "object",
        additionalProperties: false,

        required: [
          "question",
          "choices",
          "answer",
          "explanation"
        ],

        properties: {
          question: {
            type: "string"
          },

          choices: {
            type: "object",
            additionalProperties: false,

            required: [
              "A",
              "B",
              "C",
              "D"
            ],

            properties: {
              A: {
                type: "string"
              },

              B: {
                type: "string"
              },

              C: {
                type: "string"
              },

              D: {
                type: "string"
              }
            }
          },

          answer: {
            type: "string",
            enum: [
              "A",
              "B",
              "C",
              "D"
            ]
          },

          explanation: {
            type: "string"
          }
        }
      }
    }
  }
};

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
  const { image } =
    req.body;

  if (!image) {
    return res.status(400).json({
      ok: false,
      error: "image is required"
    });
  }

  try {
    const response =
      await fetch(
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

    const data =
      await response.json();

    if (data.error) {
      throw new Error(
        data.error.message ||
        "Google Vision APIでエラーが発生しました"
      );
    }

    const text =
      data.responses?.[0]?.fullTextAnnotation?.text ||
      "テキストが見つかりませんでした";

    res.json({
      ok: true,
      text
    });
  } catch (err) {
    console.error(
      "ocr error:",
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// ==================================================
// Ollama で問題生成 → MySQLに保存
// POST /api/AI/generate
// ==================================================
router.post("/generate", async (req, res) => {
  const {
    text,
    userId,
    categoryId,
    categoryName,
    materialName
  } = req.body;

  const sourceText =
    String(text || "").trim();

  if (!sourceText) {
    return res.status(400).json({
      ok: false,
      error:
        "資料本文がありません"
    });
  }

  if (sourceText.length < 20) {
    return res.status(400).json({
      ok: false,
      error:
        "抽出された資料本文が短すぎます"
    });
  }

  console.log(
    "AI generate source:",
    {
      length:
        sourceText.length,

      preview:
        sourceText.slice(
          0,
          500
        )
    }
  );

  if (!userId) {
    return res.status(400).json({
      ok: false,
      error: "userId is required"
    });
  }

  try {
    const ollamaStartedAt =
      Date.now();

    const promptSourceText =
      buildPromptSourceText(
        sourceText
      );

    console.log(
      "OLLAMA_GENERATE_START:",
      {
        model:
          process.env.OLLAMA_MODEL ||
          "qwen2.5:3b",

        sourceLength:
          sourceText.length,

        promptSourceLength:
          promptSourceText.length,

        queueWaiting:
          ollamaQueuedCount,

        preview:
          promptSourceText.slice(
            0,
            300
          )
      }
    );

    const ollamaUrl =
      String(
        process.env.OLLAMA_URL ||
        "http://ollama:11434"
      ).replace(/\/$/, "");

    const response =
      await enqueueOllamaJob(
        async () => {
          console.log(
            "OLLAMA_QUEUE_START:",
            {
              sourceLength:
                sourceText.length,

              promptSourceLength:
                promptSourceText.length,

              waitedMs:
                Date.now() -
                ollamaStartedAt
            }
          );

          return await postJsonLongWait(
            `${ollamaUrl}/api/generate`,
            {
              model:
                process.env.OLLAMA_MODEL ||
                "qwen2.5:3b",

              format:
                QUESTION_LIST_SCHEMA,

              stream:
                false,

              options: {
                temperature:
                  0,

                num_ctx:
                  8192,

                num_predict:
                  900
              },

            prompt: `あなたは学習アプリ用の問題生成AIです。
          OCR結果には誤字や不要な記号が混ざる場合があります。
          それでも資料本文に含まれる語句や説明だけを根拠に、4択問題を5問作成してください。

          必ず次のJSONオブジェクトだけを返してください。
          前置き、Markdown、コードブロック、説明文は禁止です。

          {
            "questions": [
              {
                "question": "問題文",
                "choices": {
                  "A": "選択肢A",
                  "B": "選択肢B",
                  "C": "選択肢C",
                  "D": "選択肢D"
                },
                "answer": "AorBorCorD",
                "explanation": "解説"
              }
            ]
          }

          条件:
          - questions は必ず5件
          - answer は A, B, C, D のどれか
          - choices は必ず A, B, C, D を含める
          - 資料に書かれている内容だけを根拠にする
          - OCRのノイズらしき語句は無視してよい
          - JSON以外は絶対に出力しない
          - 資料内の異なる箇所（人物、年号、出来事、用語など）から幅広く出題すること

          explanationのルール（重要）:
          - 「問題文によると〜」「〜と書かれている」のように問題文や選択肢を言い換えるだけの解説は禁止
          - explanationは合計40文字以内、次の2文構成にすること
            ①正解の根拠（20字程度）
            ②代表的な誤答が違う理由（20字程度）
          - 長い説明や背景知識の羅列は禁止。簡潔に2文でまとめること
          - 以下の「文の構造の例」はあくまで書き方の参考であり、この例に出てくる語句・固有名詞・内容は絶対にそのまま使ってはいけない。必ず資料本文の内容だけを使うこと

          文の構造の例（内容は無視し、書き方だけ参考にすること）:
          "◯◯だから正解。△△は□□という理由で誤り。"

          【ルール違反の例（禁止）】
          "explanation": "問題文によると、◯◯は△△と協力しました。"

          資料本文:
          ${promptSourceText}

          JSONオブジェクトだけを出力してください。`
            },
            OLLAMA_WAIT_TIMEOUT_MS
          );
        }
      );

    console.log(
      "OLLAMA_HTTP_RESPONSE:",
      {
        status:
          response.status,

        elapsedMs:
          Date.now() -
          ollamaStartedAt
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `Ollama API error: ${errorText}`
      );
    }

    const data =
      await response.json();

    console.log(
      "OLLAMA_GENERATE_END:",
      {
        elapsedMs:
          Date.now() -
          ollamaStartedAt,

        responseLength:
          String(
            data.response || ""
          ).length,

        responsePreview:
          String(
            data.response || ""
          ).slice(0, 300)
      }
    );

    let generatedQuestions;

    try {
      generatedQuestions =
        extractGeneratedQuestionArray(
          data.response
        );
    } catch (parseError) {
      console.warn(
        "Ollama JSON extraction failed. fallback questions will be used:",
        {
          message:
            parseError.message,

          responsePreview:
            String(
              data.response || ""
            ).slice(0, 500)
        }
      );

      generatedQuestions =
        buildFallbackQuestionsFromText(
          sourceText
        );
    }

    if (
      !Array.isArray(generatedQuestions) ||
      generatedQuestions.length === 0
    ) {
      throw new Error(
        "問題データが空です"
      );
    }

    /* ============================================================
      Geminiで問題を解答・検証・訂正
      ------------------------------------------------------------
      Ollamaで生成した問題をMySQLへ保存する前に、
      Geminiへ資料本文と一緒に渡す。

      Geminiが確認する内容:
      ・正解ラベルが正しいか
      ・問題文と選択肢が成立しているか
      ・正解が1つに定まるか
      ・資料本文に根拠があるか
      ・選択肢が重複していないか
      ・解説が正しいか
    ============================================================ */

    const geminiReviewResult =
      await reviewQuestionsWithGemini({
        sourceText:
          promptSourceText,

        questions:
          generatedQuestions.slice(
            0,
            5
          )
      });

    /*
    * Geminiが訂正した問題で元の問題を置き換える。
    */
    generatedQuestions =
      geminiReviewResult.questions;

    /*
    * フロントへ返す確認結果。
    */
    const geminiReview =
      geminiReviewResult.review;

    console.log(
      "QUESTION_REVIEW_COMPLETE:",
      {
        status:
          geminiReview.status,

        model:
          geminiReview.model,

        changedCount:
          geminiReview.changedCount
      }
    );

    /*
    * Gemini確認後の問題をDB保存形式へ変換する。
    */
    const normalized =
      generatedQuestions
        .slice(0, 5)
        .map((q, index) => {
          const choicesObj =
            q.choices || {};

          const choiceKeys =
            ["A", "B", "C", "D"];

          const choices =
            choiceKeys.map(key => {
              return String(
                choicesObj[key] || ""
              ).trim();
            });

          const answer =
            String(q.answer || "")
              .trim()
              .toUpperCase();

          const correct =
            choiceKeys.indexOf(answer);

          if (
            !q.question ||
            choices.some(choice => !choice)
          ) {
            throw new Error(
              `${index + 1}問目の形式が正しくありません`
            );
          }

          if (correct === -1) {
            throw new Error(
              `${index + 1}問目の正解ラベルが正しくありません`
            );
          }

          return {
            text:
              String(q.question).trim(),

            choices,

            correct,

            explanation:
              String(
                q.explanation || ""
              ).trim()
          };
        });

    let finalCategoryId =
      null;

    if (
      categoryId !== undefined &&
      categoryId !== null &&
      categoryId !== ""
    ) {
      const category =
        await db.findCategoryById(
          categoryId
        );

      if (!category) {
        return res.status(400).json({
          ok: false,
          error: "指定されたカテゴリIDが存在しません"
        });
      }

      finalCategoryId =
        category.category_id;
    } else if (categoryName) {
      const category =
        await db.findOrCreateCategoryByName(
          categoryName
        );

      finalCategoryId =
        category
          ? category.category_id
          : null;
    }

    const materialId =
      randomUUID();

    await db.createQuestionList(
      materialId,
      userId,
      finalCategoryId,
      materialName || "生成された問題セット",
      sourceText
    );

    const saved = [];

    for (const q of normalized) {
      const questionId =
        randomUUID();

      const question =
        await db.createQuestion(
          questionId,
          materialId,
          q
        );

      saved.push(question);
    }

    console.log(
      `問題セット ${materialId} に ${saved.length} 問保存しました`
    );

    res.json({
      ok: true,

      materialId,

      categoryId:
        finalCategoryId,

      /*
      * Gemini確認後の問題。
      */
      questions:
        normalized,

      /*
      * Geminiによる訂正結果。
      */
      review:
        geminiReview,

      saved
    });
  } catch (err) {
    console.error(
      "generate error:",
      err
    );

    res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

module.exports = router;