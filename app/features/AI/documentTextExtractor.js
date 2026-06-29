const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const { execFile } = require("child_process");
const { promisify } = require("util");

const mammoth = require("mammoth");
const WordExtractor = require("word-extractor");
const { PDFParse } = require("pdf-parse");

const execFileAsync =
  promisify(execFile);

const wordExtractor =
  new WordExtractor();

const PDFTOTEXT_COMMAND =
  process.env.PDFTOTEXT_PATH ||
  "pdftotext";

const PDFTOPPM_COMMAND =
  process.env.PDFTOPPM_PATH ||
  "pdftoppm";

const MAX_PDF_OCR_PAGES =
  Number(
    process.env.MAX_PDF_OCR_PAGES ||
    20
  );

const SUPPORTED_DOCUMENT_EXTENSIONS =
  new Set([
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".md"
  ]);

function getExtension(fileName) {
  return path
    .extname(
      String(fileName || "")
    )
    .toLowerCase();
}

/*
 * pdf-parseが返す
 * -- 1 of 2 --
 * のようなページ区切りを削除する。
 */
function removePdfParsePageMarkers(
  value
) {
  return String(value || "")
    .replace(
      /^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gim,
      ""
    )
    .replace(
      /\f/g,
      "\n"
    );
}

function normalizeText(value) {
  return removePdfParsePageMarkers(
    value
  )
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countMeaningfulCharacters(
  value
) {
  return (
    String(value || "").match(
      /[A-Za-z0-9\u3040-\u30ff\u3400-\u9fff]/g
    ) || []
  ).length;
}

/*
 * ページ区切りだけなど、
 * 問題生成に使えない文章を除外する。
 */
function isMeaningfulDocumentText(
  value,
  minimumCharacters = 30
) {
  const text =
    normalizeText(value);

  if (
    text.length <
    minimumCharacters
  ) {
    return false;
  }

  return (
    countMeaningfulCharacters(
      text
    ) >=
    Math.min(
      20,
      minimumCharacters
    )
  );
}

function isSupportedDocument(
  fileName
) {
  return (
    SUPPORTED_DOCUMENT_EXTENSIONS
      .has(
        getExtension(
          fileName
        )
      )
  );
}

// ==================================================
// PopplerでPDF本文を抽出
// ==================================================
async function extractPdfWithPoppler(
  inputPath,
  tempDirectory
) {
  const outputPath =
    path.join(
      tempDirectory,
      "poppler-output.txt"
    );

  await execFileAsync(
    PDFTOTEXT_COMMAND,
    [
      "-layout",
      "-enc",
      "UTF-8",
      inputPath,
      outputPath
    ],
    {
      timeout:
        120000,

      maxBuffer:
        20 * 1024 * 1024
    }
  );

  const text =
    normalizeText(
      await fs.readFile(
        outputPath,
        "utf8"
      )
    );

  return {
    text,
    method:
      "pdf-poppler-text"
  };
}

// ==================================================
// pdf-parseでPDF本文を抽出
// ==================================================
async function extractPdfWithPdfParse(
  buffer
) {
  const parser =
    new PDFParse({
      data:
        buffer
    });

  try {
    const result =
      await parser.getText();

    return {
      text:
        normalizeText(
          result?.text
        ),

      method:
        "pdf-parse-text"
    };
  } finally {
    await parser.destroy();
  }
}

// ==================================================
// Google Visionで画像OCR
// ==================================================
async function requestGoogleVisionOcr(
  imageBuffer
) {
  const apiKey =
    process.env
      .GOOGLE_VISION_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GOOGLE_VISION_API_KEYが設定されていません"
    );
  }

  const response =
    await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          requests: [
            {
              image: {
                content:
                  imageBuffer
                    .toString(
                      "base64"
                    )
              },

              features: [
                {
                  type:
                    "DOCUMENT_TEXT_DETECTION"
                }
              ]
            }
          ]
        })
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    data.error
  ) {
    throw new Error(
      data.error?.message ||
      "Google Vision APIでPDF OCRに失敗しました"
    );
  }

  const result =
    data.responses?.[0];

  if (result?.error) {
    throw new Error(
      result.error.message ||
      "Google Vision APIでPDF OCRに失敗しました"
    );
  }

  return normalizeText(
    result
      ?.fullTextAnnotation
      ?.text ||

    result
      ?.textAnnotations
      ?.[0]
      ?.description ||

    ""
  );
}

function getRenderedPageNumber(
  fileName
) {
  const match =
    String(fileName).match(
      /-(\d+)\.png$/i
    );

  return match
    ? Number(match[1])
    : 0;
}

// ==================================================
// PDFを画像化してOCR
// ==================================================
async function extractPdfWithVisionOcr(
  inputPath,
  tempDirectory
) {
  const outputPrefix =
    path.join(
      tempDirectory,
      "ocr-page"
    );

  await execFileAsync(
    PDFTOPPM_COMMAND,
    [
      "-png",
      "-r",
      "180",
      "-f",
      "1",
      "-l",
      String(
        MAX_PDF_OCR_PAGES
      ),
      inputPath,
      outputPrefix
    ],
    {
      timeout:
        180000,

      maxBuffer:
        20 * 1024 * 1024
    }
  );

  const pageFiles =
    (
      await fs.readdir(
        tempDirectory
      )
    )
      .filter(fileName => {
        return (
          /^ocr-page-\d+\.png$/i
            .test(fileName)
        );
      })
      .sort((a, b) => {
        return (
          getRenderedPageNumber(a) -
          getRenderedPageNumber(b)
        );
      });

  if (
    pageFiles.length === 0
  ) {
    throw new Error(
      "PDFをOCR用画像へ変換できませんでした"
    );
  }

  const pageTexts = [];

  for (
    const pageFile
    of pageFiles
  ) {
    const pagePath =
      path.join(
        tempDirectory,
        pageFile
      );

    const pageBuffer =
      await fs.readFile(
        pagePath
      );

    const pageText =
      await requestGoogleVisionOcr(
        pageBuffer
      );

    if (pageText) {
      pageTexts.push(
        pageText
      );
    }
  }

  return {
    text:
      normalizeText(
        pageTexts.join(
          "\n\n"
        )
      ),

    method:
      "pdf-google-vision-ocr"
  };
}

// ==================================================
// PDF抽出本体
// ==================================================
async function extractPdf(
  buffer
) {
  const tempDirectory =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "revino-pdf-"
      )
    );

  const inputPath =
    path.join(
      tempDirectory,
      "input.pdf"
    );

  await fs.writeFile(
    inputPath,
    buffer
  );

  try {
    /*
     * 1. Poppler
     */
    try {
      const popplerResult =
        await extractPdfWithPoppler(
          inputPath,
          tempDirectory
        );

      if (
        isMeaningfulDocumentText(
          popplerResult.text
        )
      ) {
        return popplerResult;
      }

      console.warn(
        "pdftotextでは有効な本文を取得できませんでした",
        {
          length:
            popplerResult
              .text
              .length,

          preview:
            popplerResult
              .text
              .slice(
                0,
                200
              )
        }
      );
    } catch (error) {
      console.warn(
        "pdftotextの実行に失敗しました。pdf-parseへ切り替えます:",
        error.message
      );
    }

    /*
     * 2. pdf-parse
     */
    try {
      const pdfParseResult =
        await extractPdfWithPdfParse(
          buffer
        );

      if (
        isMeaningfulDocumentText(
          pdfParseResult.text
        )
      ) {
        return pdfParseResult;
      }

      console.warn(
        "pdf-parseでは有効な本文を取得できませんでした",
        {
          length:
            pdfParseResult
              .text
              .length,

          preview:
            pdfParseResult
              .text
              .slice(
                0,
                200
              )
        }
      );
    } catch (error) {
      console.warn(
        "pdf-parseの実行に失敗しました。OCRへ切り替えます:",
        error.message
      );
    }

    /*
     * 3. Google Vision OCR
     */
    const ocrResult =
      await extractPdfWithVisionOcr(
        inputPath,
        tempDirectory
      );

    if (
      !isMeaningfulDocumentText(
        ocrResult.text
      )
    ) {
      throw new Error(
        "PDFから問題生成に使える本文を取得できませんでした"
      );
    }

    return ocrResult;
  } finally {
    await fs.rm(
      tempDirectory,
      {
        recursive:
          true,

        force:
          true
      }
    );
  }
}

// ==================================================
// DOCX
// ==================================================
async function extractDocx(
  buffer
) {
  const result =
    await mammoth
      .extractRawText({
        buffer
      });

  const text =
    normalizeText(
      result?.value
    );

  if (
    !isMeaningfulDocumentText(
      text
    )
  ) {
    throw new Error(
      "DOCXから問題生成に使える本文を取得できませんでした"
    );
  }

  return {
    text,
    method:
      "docx-text"
  };
}

// ==================================================
// DOC
// ==================================================
async function extractDoc(
  buffer
) {
  const document =
    await wordExtractor
      .extract(buffer);

  const text =
    normalizeText(
      [
        document.getBody?.(),
        document.getHeaders?.(),
        document.getFootnotes?.(),
        document.getEndnotes?.(),
        document.getTextboxes?.()
      ]
        .filter(Boolean)
        .join("\n\n")
    );

  if (
    !isMeaningfulDocumentText(
      text
    )
  ) {
    throw new Error(
      "DOCから問題生成に使える本文を取得できませんでした"
    );
  }

  return {
    text,
    method:
      "doc-text"
  };
}

// ==================================================
// TXT・Markdown
// ==================================================
async function extractPlainText(
  buffer
) {
  const text =
    normalizeText(
      buffer.toString(
        "utf8"
      )
    );

  if (
    !isMeaningfulDocumentText(
      text
    )
  ) {
    throw new Error(
      "テキストファイルの本文が短すぎます"
    );
  }

  return {
    text,
    method:
      "plain-text"
  };
}

async function extractDocumentText(
  file
) {
  if (!file?.buffer) {
    throw new Error(
      "アップロードされたファイルがありません"
    );
  }

  const extension =
    getExtension(
      file.originalname
    );

  switch (extension) {
    case ".pdf":
      return await extractPdf(
        file.buffer
      );

    case ".docx":
      return await extractDocx(
        file.buffer
      );

    case ".doc":
      return await extractDoc(
        file.buffer
      );

    case ".txt":
    case ".md":
      return await extractPlainText(
        file.buffer
      );

    default:
      throw new Error(
        "対応していない文書形式です"
      );
  }
}

module.exports = {
  SUPPORTED_DOCUMENT_EXTENSIONS,
  getExtension,
  normalizeText,
  isMeaningfulDocumentText,
  isSupportedDocument,
  extractDocumentText
};