const express = require("express");
const multer = require("multer");
const http = require("http");
const https = require("https");
const { randomUUID } = require("crypto");

const {
  isSupportedDocument,
  extractDocumentText,
  isMeaningfulDocumentText
} = require("./documentTextExtractor");

const router = express.Router();

const MAX_FILE_SIZE =
  15 * 1024 * 1024;

/*
 * 複数人利用時にOllamaへ長文を投げすぎないため、
 * まずは3500文字に絞る。
 */
const MAX_TEXT_LENGTH =
  3500;

const AI_GENERATE_TIMEOUT_MS =
  60 * 60 * 1000;

const JOB_RESULT_KEEP_MS =
  60 * 60 * 1000;

const MAX_JOB_STORE_SIZE =
  100;

const documentJobs =
  new Map();

let documentQueue =
  Promise.resolve();

let documentQueuedCount =
  0;

function nowIso() {
  return new Date().toISOString();
}

function cleanupOldJobs() {
  const now =
    Date.now();

  for (const [jobId, job] of documentJobs.entries()) {
    if (
      job.finishedAtMs &&
      now - job.finishedAtMs > JOB_RESULT_KEEP_MS
    ) {
      documentJobs.delete(jobId);
    }
  }

  if (documentJobs.size <= MAX_JOB_STORE_SIZE) {
    return;
  }

  const removable =
    [...documentJobs.entries()]
      .filter(([, job]) => {
        return ["completed", "failed"].includes(job.status);
      })
      .sort((a, b) => {
        return (a[1].finishedAtMs || 0) - (b[1].finishedAtMs || 0);
      });

  while (
    documentJobs.size > MAX_JOB_STORE_SIZE &&
    removable.length > 0
  ) {
    const [jobId] =
      removable.shift();

    documentJobs.delete(jobId);
  }
}

function getPublicJob(job) {
  if (!job) {
    return null;
  }

  return {
    jobId:
      job.jobId,

    status:
      job.status,

    progress:
      job.progress,

    message:
      job.message,

    queuePosition:
      job.queuePosition,

    createdAt:
      job.createdAt,

    startedAt:
      job.startedAt,

    finishedAt:
      job.finishedAt,

    fileName:
      job.fileName,

    sourceType:
      job.sourceType,

    textLength:
      job.textLength,

    document:
      job.document,

    error:
      job.error,

    result:
      job.status === "completed"
        ? job.result
        : null
  };
}

function updateJob(jobId, patch) {
  const job =
    documentJobs.get(jobId);

  if (!job) {
    return null;
  }

  Object.assign(job, patch);

  return job;
}

function enqueueDocumentJob(jobId, runner) {
  documentQueuedCount++;

  const queuedAt =
    Date.now();

  const run =
    documentQueue.then(
      async () => {
        documentQueuedCount =
          Math.max(
            0,
            documentQueuedCount - 1
          );

        updateJob(jobId, {
          status:
            "running",

          progress:
            45,

          message:
            "AI問題生成・Gemini確認中です",

          queuePosition:
            0,

          startedAt:
            nowIso(),

          waitedMs:
            Date.now() - queuedAt
        });

        return await runner();
      },
      async () => {
        documentQueuedCount =
          Math.max(
            0,
            documentQueuedCount - 1
          );

        updateJob(jobId, {
          status:
            "running",

          progress:
            45,

          message:
            "AI問題生成・Gemini確認中です",

          queuePosition:
            0,

          startedAt:
            nowIso(),

          waitedMs:
            Date.now() - queuedAt
        });

        return await runner();
      }
    );

  documentQueue =
    run.catch(() => {});

  return run;
}

function postJsonLongWait(
  url,
  body,
  timeoutMs = AI_GENERATE_TIMEOUT_MS
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
                    responseText
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

const INTERNAL_APP_URL =
  String(
    process.env.APP_INTERNAL_URL ||
    `http://127.0.0.1:${process.env.PORT || 3000}`
  ).replace(/\/$/, "");

function createHttpError(message, statusCode = 500) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  return error;
}

const upload = multer({
  storage:
    multer.memoryStorage(),

  limits: {
    fileSize:
      MAX_FILE_SIZE,

    files:
      1
  },

  fileFilter(req, file, callback) {
    if (!isSupportedDocument(file.originalname)) {
      return callback(
        createHttpError(
          "PDF、DOC、DOCX、TXT、MDのみアップロードできます",
          400
        )
      );
    }

    callback(null, true);
  }
});

function receiveSingleFile(req, res) {
  return new Promise((resolve, reject) => {
    upload.single("file")(
      req,
      res,
      error => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

function getUploadErrorMessage(error) {
  if (
    error instanceof multer.MulterError &&
    error.code === "LIMIT_FILE_SIZE"
  ) {
    return "ファイルサイズは15MB以下にしてください";
  }

  return error.message || "ファイルの受信に失敗しました";
}

async function extractUploadedDocument(file) {
  if (!file) {
    throw createHttpError(
      "ファイルを選択してください",
      400
    );
  }

  const startedAt =
    Date.now();

  console.log(
    "DOCUMENT_EXTRACT_START:",
    {
      fileName:
        file.originalname,

      sizeBytes:
        file.size
    }
  );

  const extracted =
    await extractDocumentText(file);

  const originalText =
    String(extracted.text || "").trim();

  console.log(
    "DOCUMENT_EXTRACT_END:",
    {
      fileName:
        file.originalname,

      method:
        extracted.method,

      elapsedMs:
        Date.now() - startedAt,

      originalLength:
        originalText.length,

      preview:
        originalText.slice(0, 300)
    }
  );

  if (!isMeaningfulDocumentText(originalText, 50)) {
    throw createHttpError(
      "文書から問題生成に使える本文を取得できませんでした",
      422
    );
  }

  const text =
    originalText.slice(0, MAX_TEXT_LENGTH);

  console.log(
    "DOCUMENT_TEXT_READY:",
    {
      fileName:
        file.originalname,

      method:
        extracted.method,

      originalLength:
        originalText.length,

      sentLength:
        text.length,

      truncated:
        originalText.length > MAX_TEXT_LENGTH,

      preview:
        text.slice(0, 500)
    }
  );

  return {
    text,
    method:
      extracted.method,
    fileName:
      file.originalname,
    originalLength:
      originalText.length,
    sentLength:
      text.length,
    truncated:
      originalText.length > MAX_TEXT_LENGTH
  };
}

async function callExistingAiGenerate({
  text,
  userId,
  materialName,
  categoryName,
  categoryId,
  sourceFileName,
  sourceType
}) {
  const startedAt =
    Date.now();

  console.log(
    "DOCUMENT_TO_AI_REQUEST:",
    {
      target:
        `${INTERNAL_APP_URL}/api/AI/generate`,

      fileName:
        sourceFileName,

      sourceType,

      textLength:
        text.length,

      timeoutMs:
        AI_GENERATE_TIMEOUT_MS,

      preview:
        text.slice(0, 500)
    }
  );

  let response;

  try {
    response =
      await postJsonLongWait(
        `${INTERNAL_APP_URL}/api/AI/generate`,
        {
          text,
          userId,
          materialName,
          categoryName,
          categoryId,
          sourceFileName,
          sourceType
        },
        AI_GENERATE_TIMEOUT_MS
      );
  } catch (error) {
    console.error(
      "DOCUMENT_TO_AI_FETCH_ERROR:",
      {
        fileName:
          sourceFileName,

        sourceType,

        elapsedMs:
          Date.now() - startedAt,

        message:
          error.message
      }
    );

    throw createHttpError(
      error.message || "AI問題生成に失敗しました",
      504
    );
  }

  const responseText =
    await response.text();

  console.log(
    "DOCUMENT_TO_AI_RESPONSE:",
    {
      fileName:
        sourceFileName,

      sourceType,

      status:
        response.status,

      elapsedMs:
        Date.now() - startedAt,

      responseLength:
        responseText.length
    }
  );

  let responseData;

  try {
    responseData =
      JSON.parse(responseText);
  } catch {
    throw createHttpError(
      "aiRoutes.jsからJSON以外の応答が返されました: " +
      responseText,
      502
    );
  }

  if (!response.ok || !responseData.ok) {
    throw createHttpError(
      responseData.error || "aiRoutes.jsで問題生成に失敗しました",
      response.status || 500
    );
  }

  return responseData;
}

function createDocumentGenerationJob({
  documentData,
  userId,
  materialName,
  categoryName,
  categoryId
}) {
  cleanupOldJobs();

  const jobId =
    randomUUID();

  const queuePosition =
    documentQueuedCount + 1;

  const job = {
    jobId,
    status:
      "queued",
    progress:
      30,
    message:
      "AI生成の順番待ちです",
    queuePosition,
    createdAt:
      nowIso(),
    startedAt:
      null,
    finishedAt:
      null,
    finishedAtMs:
      null,
    fileName:
      documentData.fileName,
    sourceType:
      documentData.method,
    textLength:
      documentData.sentLength,
    document: {
      fileName:
        documentData.fileName,
      method:
        documentData.method,
      originalLength:
        documentData.originalLength,
      sentLength:
        documentData.sentLength,
      truncated:
        documentData.truncated,
      preview:
        documentData.text.slice(0, 500)
    },
    result:
      null,
    error:
      null
  };

  documentJobs.set(jobId, job);

  enqueueDocumentJob(
    jobId,
    async () => {
      try {
        const aiResult =
          await callExistingAiGenerate({
            text:
              documentData.text,
            userId,
            materialName,
            categoryName,
            categoryId,
            sourceFileName:
              documentData.fileName,
            sourceType:
              documentData.method
          });

        updateJob(jobId, {
          status:
            "completed",
          progress:
            100,
          message:
            "問題生成が完了しました",
          finishedAt:
            nowIso(),
          finishedAtMs:
            Date.now(),
          result: {
            ok:
              true,
            ...aiResult,
            document:
              job.document
          }
        });

        console.log(
          "DOCUMENT_AI_GENERATE_COMPLETE:",
          {
            jobId,
            fileName:
              documentData.fileName,
            extractedLength:
              documentData.sentLength,
            materialId:
              aiResult.materialId,
            questionCount:
              aiResult.questions?.length || 0
          }
        );
      } catch (error) {
        updateJob(jobId, {
          status:
            "failed",
          progress:
            100,
          message:
            "問題生成に失敗しました",
          finishedAt:
            nowIso(),
          finishedAtMs:
            Date.now(),
          error:
            error.message || "問題生成に失敗しました"
        });

        console.error(
          "DOCUMENT_AI_JOB_FAILED:",
          {
            jobId,
            fileName:
              documentData.fileName,
            error:
              error.message
          }
        );
      }
    }
  );

  return job;
}

router.post("/extract", async (req, res) => {
  try {
    await receiveSingleFile(req, res);

    const documentData =
      await extractUploadedDocument(req.file);

    res.json({
      ok: true,
      ...documentData
    });
  } catch (error) {
    console.error(
      "document extract error:",
      error
    );

    res
      .status(error.statusCode || 400)
      .json({
        ok: false,
        message:
          getUploadErrorMessage(error)
      });
  }
});

/*
 * 複数人利用前提のため、ここではAI生成完了までHTTPを握らない。
 * 抽出後にジョブを作って202で返し、フロント側が /jobs/:jobId をポーリングする。
 */
router.post("/generate", async (req, res) => {
  try {
    await receiveSingleFile(req, res);

    const userId =
      req.session?.userId ||
      req.body?.userId;

    if (!userId) {
      throw createHttpError(
        "ログインユーザーが確認できません",
        401
      );
    }

    const documentData =
      await extractUploadedDocument(req.file);

    const job =
      createDocumentGenerationJob({
        documentData,
        userId,
        materialName:
          req.body?.materialName || "生成された問題セット",
        categoryName:
          req.body?.categoryName || "一般",
        categoryId:
          req.body?.categoryId || null
      });

    res.status(202).json({
      ok:
        true,
      queued:
        true,
      jobId:
        job.jobId,
      status:
        job.status,
      message:
        job.message,
      queuePosition:
        job.queuePosition,
      document:
        job.document
    });
  } catch (error) {
    console.error(
      "document generate error:",
      error
    );

    res
      .status(error.statusCode || 500)
      .json({
        ok: false,
        message:
          getUploadErrorMessage(error)
      });
  }
});

router.get("/jobs/:jobId", (req, res) => {
  cleanupOldJobs();

  const job =
    documentJobs.get(
      req.params.jobId
    );

  if (!job) {
    return res.status(404).json({
      ok: false,
      message: "ジョブが見つかりません"
    });
  }

  res.json({
    ok: true,
    job:
      getPublicJob(job)
  });
});

module.exports =
  router;