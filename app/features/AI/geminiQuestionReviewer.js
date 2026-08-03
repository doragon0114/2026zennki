"use strict";

const http = require("http");
const https = require("https");
const crypto = require("crypto");

/* ============================================================
   Gemini無料枠向け設定
============================================================ */

const GEMINI_REVIEW_TIMEOUT_MS =
  Number(
    process.env.GEMINI_REVIEW_TIMEOUT_MS ||
    180000
  );

const GEMINI_REVIEW_ENABLED =
  String(
    process.env.GEMINI_REVIEW_ENABLED ||
    "true"
  ).toLowerCase() !== "false";

/*
 * 無料枠を使い切った場合でも、
 * Ollamaの問題生成全体を失敗させない。
 */
const GEMINI_REVIEW_REQUIRED =
  String(
    process.env.GEMINI_REVIEW_REQUIRED ||
    "false"
  ).toLowerCase() === "true";

/*
 * 高頻度の軽量処理向けモデル。
 */
const GEMINI_MODEL =
  String(
    process.env.GEMINI_MODEL ||
    "gemini-3.1-flash-lite"
  ).trim();

/*
 * Geminiへ送る資料本文を制限する。
 * Ollamaへは3500文字渡していても、
 * Gemini確認では2500文字までにする。
 */
const GEMINI_REVIEW_MAX_SOURCE_LENGTH =
  Number(
    process.env.GEMINI_REVIEW_MAX_SOURCE_LENGTH ||
    3500
  );

/*
 * Geminiの出力量を制限する。
 */
const GEMINI_REVIEW_MAX_OUTPUT_TOKENS =
  Number(
    process.env.GEMINI_REVIEW_MAX_OUTPUT_TOKENS ||
    3500
  );

/*
 * 無料枠の短時間連続呼び出しを避ける。
 * 5000msなら1分間に最大約12回。
 */
const GEMINI_REVIEW_MIN_INTERVAL_MS =
  Number(
    process.env.GEMINI_REVIEW_MIN_INTERVAL_MS ||
    5000
  );

/*
 * 429・503などの一時エラー再試行回数。
 */
const GEMINI_REVIEW_MAX_RETRIES =
  Number(
    process.env.GEMINI_REVIEW_MAX_RETRIES ||
    3
  );

/*
 * 同じ資料・同じ問題を何度も確認しないための
 * メモリキャッシュ保持時間。
 */
const GEMINI_REVIEW_CACHE_TTL_MS =
  Number(
    process.env.GEMINI_REVIEW_CACHE_TTL_MS ||
    6 * 60 * 60 * 1000
  );

const GEMINI_API_BASE_URL =
  String(
    process.env.GEMINI_API_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");

let geminiQueue =
  Promise.resolve();

let geminiQueuedCount =
  0;

let lastGeminiRequestAt =
  0;

const reviewCache =
  new Map();


/* ============================================================
   無料枠向け共通処理
============================================================ */

function sleep(milliseconds) {
  return new Promise(resolve => {
    setTimeout(
      resolve,
      milliseconds
    );
  });
}

/*
 * 資料本文をGemini確認用に短縮する。
 */
function buildGeminiSourceText(sourceText) {
  const normalized =
    String(sourceText || "")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  return normalized.slice(
    0,
    GEMINI_REVIEW_MAX_SOURCE_LENGTH
  );
}

/*
 * 同じ資料と問題から同じキャッシュキーを作る。
 */
function createReviewCacheKey(
  sourceText,
  questions
) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        sourceText,
        questions,
        model:
          GEMINI_MODEL
      })
    )
    .digest("hex");
}

function getCachedReview(cacheKey) {
  const cached =
    reviewCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (
    Date.now() -
    cached.createdAt >
    GEMINI_REVIEW_CACHE_TTL_MS
  ) {
    reviewCache.delete(
      cacheKey
    );

    return null;
  }

  return cached.value;
}

function setCachedReview(
  cacheKey,
  value
) {
  reviewCache.set(
    cacheKey,
    {
      createdAt:
        Date.now(),

      value
    }
  );

  /*
   * メモリを増やしすぎないようにする。
   */
  if (reviewCache.size > 100) {
    const oldestKey =
      reviewCache.keys().next().value;

    reviewCache.delete(
      oldestKey
    );
  }
}

/*
 * 前回のGemini呼び出しから一定時間空ける。
 */
async function waitForGeminiInterval() {
  const elapsed =
    Date.now() -
    lastGeminiRequestAt;

  const waitMs =
    GEMINI_REVIEW_MIN_INTERVAL_MS -
    elapsed;

  if (waitMs > 0) {
    await sleep(waitMs);
  }

  lastGeminiRequestAt =
    Date.now();
}


/* ============================================================
   GeminiのJSON出力形式
============================================================ */

const GEMINI_REVIEW_SCHEMA = {
  type: "object",

  additionalProperties: false,

  required: [
    "questions",
    "summary"
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
          "explanation",
          "changed",
          "issues"
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
          },

          /*
           * Geminiが内容を変更したか。
           */
          changed: {
            type: "boolean"
          },

          /*
           * 変更理由。
           */
          issues: {
            type: "array",

            items: {
              type: "string"
            }
          }
        }
      }
    },

    summary: {
      type: "object",

      additionalProperties: false,

      required: [
        "changedCount",
        "notes"
      ],

      properties: {
        changedCount: {
          type: "integer"
        },

        notes: {
          type: "string"
        }
      }
    }
  }
};

/* ============================================================
   Geminiキュー
============================================================ */

function enqueueGeminiReview(job) {
  geminiQueuedCount++;

  const run =
    geminiQueue.then(
      async () => {
        geminiQueuedCount =
          Math.max(
            0,
            geminiQueuedCount - 1
          );

        await waitForGeminiInterval();

        return await job();
      },

      async () => {
        geminiQueuedCount =
          Math.max(
            0,
            geminiQueuedCount - 1
          );

        await waitForGeminiInterval();

        return await job();
      }
    );

  geminiQueue =
    run.catch(() => {});

  return run;
}

/* ============================================================
   HTTP POST
============================================================ */

function postJson(
  url,
  body,
  headers = {},
  timeoutMs = GEMINI_REVIEW_TIMEOUT_MS
) {
  return new Promise(
    (resolve, reject) => {
      const target =
        new URL(url);

      const payload =
        JSON.stringify(body);

      const client =
        target.protocol === "https:"
          ? https
          : http;

      const request =
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
                Buffer.byteLength(payload),

              ...headers
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
                responseText += chunk;
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
                    responseText
                });
              }
            );
          }
        );

      request.on(
        "timeout",
        () => {
          request.destroy(
            new Error(
              `Gemini request timeout after ${timeoutMs}ms`
            )
          );
        }
      );

      request.on(
        "error",
        reject
      );

      request.write(payload);
      request.end();
    }
  );
}


/* ============================================================
   429・503などの再試行
============================================================ */

function isRetryableStatus(status) {
  return (
    status === 408 ||
    status === 429 ||
    status >= 500
  );
}

async function postJsonWithRetry(
  url,
  body,
  headers = {}
) {
  let lastResponse =
    null;

  let lastError =
    null;

  for (
    let attempt = 0;
    attempt <= GEMINI_REVIEW_MAX_RETRIES;
    attempt++
  ) {
    try {
      const response =
        await postJson(
          url,
          body,
          headers,
          GEMINI_REVIEW_TIMEOUT_MS
        );

      lastResponse =
        response;

      if (
        response.ok ||
        !isRetryableStatus(
          response.status
        )
      ) {
        return response;
      }

      /*
       * 最後の試行ならそのまま返す。
       */
      if (
        attempt >=
        GEMINI_REVIEW_MAX_RETRIES
      ) {
        return response;
      }

      /*
       * 1秒、2秒、4秒と待機時間を増やす。
       * 同時再試行を避けるため乱数も加える。
       */
      const delay =
        Math.min(
          60000,
          1000 * (2 ** attempt)
        ) +
        Math.floor(
          Math.random() * 1000
        );

      console.warn(
        "GEMINI_RETRY_WAIT:",
        {
          status:
            response.status,

          attempt:
            attempt + 1,

          delayMs:
            delay
        }
      );

      await sleep(delay);
    } catch (error) {
      lastError =
        error;

      if (
        attempt >=
        GEMINI_REVIEW_MAX_RETRIES
      ) {
        throw error;
      }

      const delay =
        Math.min(
          60000,
          1000 * (2 ** attempt)
        ) +
        Math.floor(
          Math.random() * 1000
        );

      console.warn(
        "GEMINI_NETWORK_RETRY:",
        {
          attempt:
            attempt + 1,

          delayMs:
            delay,

          message:
            error.message
        }
      );

      await sleep(delay);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return lastResponse;
}

/* ============================================================
   Gemini応答から本文を取り出す
============================================================ */

function extractGeminiText(responseData) {
  const parts =
    responseData
      ?.candidates
      ?.[0]
      ?.content
      ?.parts;

  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .map(part => {
      return String(
        part?.text || ""
      );
    })
    .join("")
    .trim();
}

/* ============================================================
   GeminiのJSONを解析
============================================================ */

function parseGeminiJson(text) {
  const cleaned =
    String(text || "")
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/[“”]/g, '"')
      .trim();

  if (!cleaned) {
    throw new Error(
      "Geminiの確認結果が空でした"
    );
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    /*
     * 前後に不要な文章が付いた場合は、
     * 最初と最後の中括弧を探す。
     */
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start === -1 ||
      end === -1 ||
      end <= start
    ) {
      throw new Error(
        "Geminiの確認結果からJSONを取得できませんでした"
      );
    }

    return JSON.parse(
      cleaned.slice(
        start,
        end + 1
      )
    );
  }
}

/* ============================================================
   Gemini訂正後の形式確認
============================================================ */

function validateReviewedQuestions(result) {
  if (
    !result ||
    !Array.isArray(result.questions) ||
    result.questions.length !== 5
  ) {
    throw new Error(
      "Geminiの確認結果は5問である必要があります"
    );
  }

  const choiceKeys =
    [
      "A",
      "B",
      "C",
      "D"
    ];

  result.questions.forEach(
    (question, index) => {
      const questionText =
        String(
          question?.question || ""
        ).trim();

      if (!questionText) {
        throw new Error(
          `Gemini確認後の${index + 1}問目に問題文がありません`
        );
      }

      const choices =
        question?.choices || {};

      const choiceValues =
        choiceKeys.map(key => {
          return String(
            choices[key] || ""
          ).trim();
        });

      if (
        choiceValues.some(
          value => !value
        )
      ) {
        throw new Error(
          `Gemini確認後の${index + 1}問目の選択肢が不足しています`
        );
      }

      /*
       * 4択内に同じ文章が重複していないか確認。
       */
      if (
        new Set(choiceValues).size !== 4
      ) {
        throw new Error(
          `Gemini確認後の${index + 1}問目に重複した選択肢があります`
        );
      }

      const answer =
        String(
          question.answer || ""
        )
          .trim()
          .toUpperCase();

      if (!choiceKeys.includes(answer)) {
        throw new Error(
          `Gemini確認後の${index + 1}問目の正解ラベルが不正です`
        );
      }
    }
  );

  return result;
}

/* ============================================================
   Geminiへ送るプロンプト
============================================================ */

function buildReviewPrompt(
  sourceText,
  questions
) {
  return `
あなたは学習問題の検証・訂正担当です。

以下の資料本文と、
Ollamaが作成した4択問題5問を照合してください。

各問題を実際に解き、
内容に問題がある場合だけ訂正してください。

確認基準:
- 資料本文を根拠に回答できること
- 正解が1つに定まること
- answerが正しい選択肢を示していること
- 選択肢の重複がないこと
- 意味不明な選択肢がないこと
- OCRのノイズが混ざっていないこと
- 問題文と選択肢の組み合わせが自然であること
- 解説が正解の根拠として成立していること
- 資料本文にない事実を追加しないこと
- 元の問題が正しければ変更しないこと
- 必ず5問すべて返すこと

訂正した問題はchangedをtrueにしてください。
issuesには訂正した理由を短く入れてください。

問題がなければ、
changedをfalse、
issuesを空配列にしてください。

JSON以外は出力しないでください。

【資料本文】
${sourceText}

【Ollamaが生成した問題】
${JSON.stringify(
  {
    questions
  },
  null,
  2
)}
  `.trim();
}

/* ============================================================
   Gemini確認本体
============================================================ */

async function reviewQuestionsWithGemini({
  sourceText,
  questions
}) {
  if (!GEMINI_REVIEW_ENABLED) {
    return {
      questions,

      review: {
        enabled:
          false,

        status:
          "skipped",

        model:
          GEMINI_MODEL,

        changedCount:
          0,

        notes:
          "Gemini確認は無効です"
      }
    };
  }

  const apiKey =
    String(
      process.env.GEMINI_API_KEY || ""
    ).trim();

  if (!apiKey) {
    if (GEMINI_REVIEW_REQUIRED) {
      throw new Error(
        "GEMINI_API_KEYが設定されていません"
      );
    }

    return {
      questions,

      review: {
        enabled:
          true,

        status:
          "skipped",

        model:
          GEMINI_MODEL,

        changedCount:
          0,

        notes:
          "APIキー未設定のためOllamaの問題を使用しました"
      }
    };
  }

  if (
    !Array.isArray(questions) ||
    questions.length !== 5
  ) {
    throw new Error(
      "Geminiへ渡す問題は5問である必要があります"
    );
  }

  /*
   * Gemini確認用に本文を短くする。
   */
  const reviewSourceText =
    buildGeminiSourceText(
      sourceText
    );

  const cacheKey =
    createReviewCacheKey(
      reviewSourceText,
      questions
    );

  const cachedResult =
    getCachedReview(
      cacheKey
    );

  if (cachedResult) {
    console.log(
      "GEMINI_REVIEW_CACHE_HIT:",
      {
        model:
          GEMINI_MODEL,

        questionCount:
          questions.length
      }
    );

    return {
      ...cachedResult,

      review: {
        ...cachedResult.review,

        cached:
          true
      }
    };
  }

  const startedAt =
    Date.now();

  const endpoint =
    `${GEMINI_API_BASE_URL}` +
    `/models/${encodeURIComponent(GEMINI_MODEL)}` +
    `:generateContent`;

  try {
    // この後にGeminiリクエスト処理を続ける
    console.log(
      "GEMINI_REVIEW_START:",
      {
        model:
          GEMINI_MODEL,

        sourceLength:
          String(sourceText || "").length,

        questionCount:
          questions.length,

        queueWaiting:
          geminiQueuedCount
      }
    );

    /*
     * Gemini generateContentへ送信する。
     */
    const response =
        await enqueueGeminiReview(
            async () => {
            return await postJsonWithRetry(
                endpoint,

                {
                contents: [
                    {
                    role:
                        "user",

                    parts: [
                        {
                        text:
                            buildReviewPrompt(
                            reviewSourceText,
                            questions
                            )
                        }
                    ]
                    }
                ],

                generationConfig: {
                    temperature:
                    0,

                    /*
                    * 出力トークンを制限する。
                    */
                    maxOutputTokens:
                    GEMINI_REVIEW_MAX_OUTPUT_TOKENS,

                    /*
                    * 無料枠のトークン消費を抑える。
                    * 3.1 Flash-Liteではminimalが使用可能。
                    */
                    thinkingConfig: {
                    thinkingLevel:
                        "minimal"
                    },

                    responseMimeType:
                    "application/json",

                    responseJsonSchema:
                    GEMINI_REVIEW_SCHEMA
                }
                },

                {
                "x-goog-api-key":
                    apiKey
                }
            );
            }
        );

    if (!response.ok) {
      let errorMessage =
        response.text;

      try {
        const errorData =
          JSON.parse(
            response.text
          );

        errorMessage =
          errorData
            ?.error
            ?.message ||
          response.text;
      } catch {
        // JSON以外なら本文をそのまま使う
      }

      throw new Error(
        `Gemini API error (${response.status}): ${errorMessage}`
      );
    }

    const responseData =
      JSON.parse(
        response.text
      );

    const rawText =
      extractGeminiText(
        responseData
      );

    const parsed =
      validateReviewedQuestions(
        parseGeminiJson(
          rawText
        )
      );

    const changedCount =
      parsed.questions.filter(
        question => {
          return question.changed;
        }
      ).length;

    console.log(
      "GEMINI_REVIEW_END:",
      {
        model:
          GEMINI_MODEL,

        elapsedMs:
          Date.now() - startedAt,

        changedCount,

        notes:
          String(
            parsed.summary?.notes || ""
          ).slice(
            0,
            200
          )
      }
    );

    const reviewResult = {
        questions:
            parsed.questions.map(
            question => {
                return {
                question:
                    String(
                    question.question
                    ).trim(),

                choices: {
                    A:
                    String(
                        question.choices.A
                    ).trim(),

                    B:
                    String(
                        question.choices.B
                    ).trim(),

                    C:
                    String(
                        question.choices.C
                    ).trim(),

                    D:
                    String(
                        question.choices.D
                    ).trim()
                },

                answer:
                    String(
                    question.answer
                    )
                    .trim()
                    .toUpperCase(),

                explanation:
                    String(
                    question.explanation || ""
                    ).trim()
                };
            }
            ),

        review: {
            enabled:
            true,

            status:
            "completed",

            model:
            GEMINI_MODEL,

            changedCount,

            notes:
            String(
                parsed.summary?.notes || ""
            ).trim(),

            cached:
            false,

            details:
            parsed.questions.map(
                (question, index) => {
                return {
                    questionNumber:
                    index + 1,

                    changed:
                    Boolean(
                        question.changed
                    ),

                    issues:
                    Array.isArray(
                        question.issues
                    )
                        ? question.issues.map(
                            issue => {
                            return String(issue);
                            }
                        )
                        : []
                };
                }
            )
        }
        };

        /*
        * 同じ問題が再送されたときに
        * Geminiを再呼び出ししない。
        */
        setCachedReview(
        cacheKey,
        reviewResult
        );

        return reviewResult;
    } catch (error) {
    console.error(
        "GEMINI_REVIEW_FAILED:",
        {
        model:
            GEMINI_MODEL,

        elapsedMs:
            Date.now() - startedAt,

        message:
            error.message
        }
    );

    if (GEMINI_REVIEW_REQUIRED) {
        throw error;
    }

    const isQuotaError =
        String(error.message)
        .includes("429") ||
        String(error.message)
        .includes("RESOURCE_EXHAUSTED");

    return {
        questions,

        review: {
        enabled:
            true,

        status:
            isQuotaError
            ? "quota_exceeded"
            : "failed",

        model:
            GEMINI_MODEL,

        changedCount:
            0,

        notes:
            isQuotaError
            ? "Gemini無料枠の上限に達したため、Ollamaの問題を使用しました"
            : "Gemini確認に失敗したため、Ollamaの問題を使用しました",

        error:
            error.message
        }
    };
    }
}

module.exports = {
  reviewQuestionsWithGemini
};