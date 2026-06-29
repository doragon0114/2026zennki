/* ============================================================
   upload.js — 資料アップロード・AI解析画面
============================================================ */

function renderUpload() {
  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('home')"></button>
      <div class="header-title">資料アップロード</div>
      <div style="width:40px;flex-shrink:0"></div>
    </div>
    <div class="screen-body">
      <div class="upload-section-label">アップロード方法を選択</div>
      <div class="upload-methods">
        <button class="upload-method-btn selected" id="method-camera" onclick="selectMethod('camera')">
          <div class="upload-method-icon-tile blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h2L9 4h6l1.5 2h2A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div class="upload-method-label">カメラ撮影</div>
          <div class="upload-method-sub">ノートを撮影</div>
        </button>
        <button class="upload-method-btn" id="method-file" onclick="selectMethod('file')">
          <div class="upload-method-icon-tile purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="8" y1="13" x2="16" y2="13"/>
              <line x1="8" y1="17" x2="13" y2="17"/>
            </svg>
          </div>
          <div class="upload-method-label">ファイル選択</div>
          <div class="upload-method-sub">PDF・Word等</div>
        </button>
      </div>
      <div class="upload-area" onclick="triggerFileSelect()">
        <div class="upload-area-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="upload-area-title">タップしてファイルを選択</div>
        <div class="upload-area-sub">PDF・Word・画像ファイルに対応</div>
      </div>
      <div class="file-chosen hidden" id="file-chosen-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        <span id="file-chosen-name"></span>
      </div>
      <input
        type="file"
        id="file-input"
        accept=".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg"
        style="display:none"
        onchange="onFileChosen(event)"
      >
      <div class="form-group">
        <label class="form-label">資料名</label>
        <input class="form-input" id="material-name" type="text" placeholder="例：数学ノート 第3章">
      </div>
      <div class="form-group">
        <label class="form-label">カテゴリ</label>
        <select class="form-input" id="material-cat">
          <option value="国語">国語</option>
          <option value="数学">数学</option>
          <option value="英語">英語</option>
          <option value="理科">理科</option>
          <option value="社会">社会</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="startUpload()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
        AIで解析・問題生成
      </button>
    </div>`;
}

function onFileChosen(e) {
  console.log('onFileChosen called', e.target.files);
  const f = e.target.files[0]; if(!f) return;
  selectedFile = f;
  console.log('selectedFile set:', selectedFile);
  document.getElementById('file-chosen-bar').classList.remove('hidden');
  document.getElementById('file-chosen-name').textContent = f.name;
  if (!document.getElementById('material-name').value)
    document.getElementById('material-name').value = f.name.replace(/\.[^.]+$/,'');
}

function selectMethod(m) {
  uploadMethod = m;
  document.getElementById('method-camera').classList.toggle('selected', m==='camera');
  document.getElementById('method-file').classList.toggle('selected', m==='file');
}

function triggerFileSelect() { document.getElementById('file-input').click(); }

function isImageFile(file) {
  return Boolean(
    file?.type?.startsWith(
      "image/"
    )
  );
}

function isDocumentFile(file) {
  const extension =
    String(file?.name || "")
      .toLowerCase()
      .match(/\.[^.]+$/)?.[0];

  return [
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".md"
  ].includes(extension);
}

async function startUpload() {
  const name =
    document
      .getElementById(
        "material-name"
      )
      .value
      .trim() ||
    "無題の資料";

  const cat =
    document
      .getElementById(
        "material-cat"
      )
      .value;

  if (!selectedFile) {
    alert(
      "ファイルを選択してください"
    );

    return;
  }

  let base64Image = null;
  let documentFile = false;

  /*
   * 画像だけ既存のBase64 OCR処理を使う。
   */
  if (isImageFile(selectedFile)) {
    base64Image =
      await new Promise(
        (resolve, reject) => {
          const reader =
            new FileReader();

          reader.onload = event => {
            resolve(
              event.target.result
                .split(",")[1]
            );
          };

          reader.onerror =
            reject;

          reader.readAsDataURL(
            selectedFile
          );
        }
      );
  } else if (
    isDocumentFile(selectedFile)
  ) {
    /*
     * PDF・WordはBase64にせず、
     * documentRoutesへmultipart送信する。
     */
    documentFile = true;
  } else {
    alert(
      "対応していないファイル形式です"
    );

    return;
  }

  navigate(
    "analyzing",
    {
      materialId:
        uid(),

      name,

      category:
        cat,

      base64Image,

      documentFile
    }
  );
}

/* ============================================================
   AI解析中画面
============================================================ */
function renderAnalyzing(params) {
  return `
    <div class="screen-header blue-bg">
      <div class="header-title">AI解析中</div>
    </div>
    <div class="analyzing-screen">
      <div class="analyzing-icon">${svg(IC.bot,48)}</div>
      <div class="analyzing-title">AIが資料を解析しています</div>
      <div class="analyzing-sub">しばらくお待ちください…</div>
      <div class="analyzing-steps" id="analysis-steps">
        <div class="step-item active" id="step1"><div class="step-dot"></div>データを読み込み中</div>
        <div class="step-item" id="step2"><div class="step-dot"></div>テキストを抽出中</div>
        <div class="step-item" id="step3"><div class="step-dot"></div>問題を自動生成中</div>
        <div class="step-item" id="step4"><div class="step-dot"></div>問題セットを作成中</div>
      </div>
    </div>`;
}

async function waitDocumentGenerationJob(
  jobId,
  onUpdate
) {
  const intervalMs =
    5000;

  const maxWaitMs =
    60 * 60 * 1000;

  const startedAt =
    Date.now();

  while (true) {
    if (
      Date.now() - startedAt >
      maxWaitMs
    ) {
      throw new Error(
        "AI問題生成の待機時間が長すぎます。時間をおいて再度確認してください。"
      );
    }

    const response =
      await fetch(
        `/api/documents/jobs/${encodeURIComponent(jobId)}`
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.ok
    ) {
      throw new Error(
        data.message ||
        "問題生成ジョブの確認に失敗しました"
      );
    }

    const job =
      data.job;

    if (
      typeof onUpdate === "function"
    ) {
      onUpdate(job);
    }

    if (
      job.status === "completed"
    ) {
      if (
        !job.result ||
        !job.result.ok
      ) {
        throw new Error(
          "問題生成結果を取得できませんでした"
        );
      }

      return job.result;
    }

    if (
      job.status === "failed"
    ) {
      throw new Error(
        job.error ||
        "問題生成に失敗しました"
      );
    }

    await new Promise(resolve => {
      setTimeout(
        resolve,
        intervalMs
      );
    });
  }
}

async function runAIAnalysis(
  params
) {
  const completeStep = id => {
    const element =
      document.getElementById(id);

    if (!element) {
      return;
    }

    element.classList.remove(
      "active"
    );

    element.classList.add(
      "done"
    );

    const dot =
      element.querySelector(
        ".step-dot"
      );

    if (dot) {
      dot.style.background =
        "var(--green)";
    }
  };

  const activateStep = id => {
    const element =
      document.getElementById(id);

    if (element) {
      element.classList.add(
        "active"
      );
    }
  };

  const setAnalyzingMessage = message => {
    const sub =
      document.querySelector(
        ".analyzing-sub"
      );

    if (sub) {
      sub.textContent =
        message;
    }
  };

  const delay = ms => {
    return new Promise(
      resolve => {
        setTimeout(
          resolve,
          ms
        );
      }
    );
  };

  try {
    if (!selectedFile) {
      throw new Error(
        "解析対象のファイルが見つかりません"
      );
    }

    const userId =
      S.user?.userId ||
      S.user?.user_id ||
      S.user?.id ||
      "";

    if (!userId) {
      throw new Error(
        "ログインユーザーが確認できません"
      );
    }

    activateStep("step1");

    await delay(300);

    completeStep("step1");

    let generateData;

    // ==================================================
    // PDF・Word・TXT・MD
    // 複数人利用前提:
    // /api/documents/generate は jobId を返す。
    // その後 /api/documents/jobs/:jobId をポーリングする。
    // ==================================================
    if (
      isDocumentFile(
        selectedFile
      )
    ) {
      activateStep("step2");

      setAnalyzingMessage(
        "文書から本文を抽出しています..."
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile,
        selectedFile.name
      );

      formData.append(
        "userId",
        userId
      );

      formData.append(
        "materialName",
        params.name ||
        "生成された問題セット"
      );

      formData.append(
        "categoryName",
        params.category ||
        "一般"
      );

      const response =
        await fetch(
          "/api/documents/generate",
          {
            method: "POST",
            body:
              formData
          }
        );

      const responseText =
        await response.text();

      let queueData;

      try {
        queueData =
          JSON.parse(
            responseText
          );
      } catch {
        throw new Error(
          "PDF・Word問題生成APIの応答を解析できませんでした: " +
          responseText
        );
      }

      if (
        !response.ok ||
        !queueData.ok
      ) {
        throw new Error(
          queueData.message ||
          queueData.error ||
          "PDF・Wordから問題生成ジョブを作成できませんでした"
        );
      }

      completeStep("step2");
      activateStep("step3");

      if (!queueData.jobId) {
        throw new Error(
          "問題生成ジョブIDを取得できませんでした"
        );
      }

      setAnalyzingMessage(
        queueData.queuePosition > 1
          ? `AI生成の順番待ちです（${queueData.queuePosition}番目）...`
          : "AIが問題を生成しています..."
      );

      generateData =
        await waitDocumentGenerationJob(
          queueData.jobId,
          job => {
            if (!job) {
              return;
            }

            if (
              job.status === "queued"
            ) {
              setAnalyzingMessage(
                job.queuePosition > 1
                  ? `AI生成の順番待ちです（${job.queuePosition}番目）...`
                  : "AI生成の順番待ちです..."
              );
            } else if (
              job.status === "running"
            ) {
              setAnalyzingMessage(
                "AIが問題を生成しています。時間がかかる場合があります..."
              );
            }
          }
        );

      completeStep("step3");

      console.log(
        "PDF・WordからAIへ渡された文章:",
        {
          fileName:
            generateData
              .document
              ?.fileName,

          method:
            generateData
              .document
              ?.method,

          originalLength:
            generateData
              .document
              ?.originalLength,

          sentLength:
            generateData
              .document
              ?.sentLength,

          preview:
            generateData
              .document
              ?.preview,

          materialId:
            generateData.materialId
        }
      );

    // ==================================================
    // 画像
    // 画像は既存処理をそのまま使用。
    // ==================================================
    } else if (
      isImageFile(
        selectedFile
      )
    ) {
      activateStep("step2");

      let base64Image =
        params.base64Image ||
        "";

      if (!base64Image) {
        base64Image =
          await new Promise(
            (
              resolve,
              reject
            ) => {
              const reader =
                new FileReader();

              reader.onload =
                event => {
                  resolve(
                    event.target
                      .result
                      .split(",")[1]
                  );
                };

              reader.onerror =
                reject;

              reader.readAsDataURL(
                selectedFile
              );
            }
          );
      }

      const ocrResponse =
        await fetch(
          "/api/AI/ocr",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                image:
                  base64Image
              })
          }
        );

      const ocrText =
        await ocrResponse.text();

      let ocrData;

      try {
        ocrData =
          JSON.parse(
            ocrText
          );
      } catch {
        throw new Error(
          "画像OCRの応答を解析できませんでした: " +
          ocrText
        );
      }

      if (
        !ocrResponse.ok ||
        !ocrData.ok
      ) {
        throw new Error(
          ocrData.error ||
          "画像OCRに失敗しました"
        );
      }

      const extractedText =
        String(
          ocrData.text || ""
        ).trim();

      if (
        extractedText.length < 20
      ) {
        throw new Error(
          "画像から十分な文章を読み取れませんでした"
        );
      }

      completeStep("step2");
      activateStep("step3");

      setAnalyzingMessage(
        "AIが問題を生成しています..."
      );

      const generateResponse =
        await fetch(
          "/api/AI/generate",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                text:
                  extractedText,

                userId,

                materialName:
                  params.name ||
                  "生成された問題セット",

                categoryName:
                  params.category ||
                  "一般"
              })
          }
        );

      const generateText =
        await generateResponse.text();

      try {
        generateData =
          JSON.parse(
            generateText
          );
      } catch {
        throw new Error(
          "問題生成APIの応答を解析できませんでした: " +
          generateText
        );
      }

      if (
        !generateResponse.ok ||
        !generateData.ok
      ) {
        throw new Error(
          generateData.error ||
          "画像から問題を生成できませんでした"
        );
      }

      completeStep("step3");
    } else {
      throw new Error(
        "対応していないファイル形式です"
      );
    }

    activateStep("step4");

    await finishAnalysis(
      params,
      generateData
    );

    completeStep("step4");
  } catch (error) {
    console.error(
      "AI解析エラー:",
      error
    );

    const sub =
      document.querySelector(
        ".analyzing-sub"
      );

    if (sub) {
      sub.textContent =
        `エラー: ${error.message}`;

      sub.style.color =
        "var(--red, #e53e3e)";
    }
  }
}

async function finishAnalysis(
  params,
  generateData
) {
  /*
   * aiRoutes.jsがDBへ保存した
   * 正式なmaterialIdを使う。
   */
  const materialId =
    generateData?.materialId;

  if (!materialId) {
    throw new Error(
      "生成された問題セットIDを取得できませんでした"
    );
  }

  /*
   * サーバー側ですでにDBへ保存されているため、
   * 基本的にはDBから再取得する。
   */
  if (
    typeof materialsLoaded !==
    "undefined"
  ) {
    materialsLoaded = false;
  }

  if (
    typeof studyLoaded !==
    "undefined"
  ) {
    studyLoaded = false;
  }

  if (
    typeof loadMaterialsFromServer ===
    "function"
  ) {
    await loadMaterialsFromServer(
      true
    );
  } else {
    /*
     * DB再取得関数がない場合のみ、
     * 画面表示用のデータを追加する。
     *
     * 仮IDではなく、DBの正式IDを使用する。
     */
    const exists =
      S.materials.some(
        material =>
          material.id ===
          materialId
      );

    if (!exists) {
      S.materials.push({
        id:
          materialId,

        name:
          params.name ||
          "無題の資料",

        type:
          uploadMethod,

        filename:
          selectedFile?.name ||
          params.name,

        createdAt:
          new Date()
            .toISOString(),

        questionCount:
          generateData
            .questions
            ?.length ||
          0,

        shared:
          false
      });
    }

    const newQuestions =
      Array.isArray(
        generateData.questions
      )
        ? generateData.questions
        : [];

    for (
      let index = 0;
      index <
      newQuestions.length;
      index++
    ) {
      const question =
        newQuestions[index];

      S.questions.push({
        id:
          `${materialId}_${index}`,

        materialId,

        category:
          params.category ||
          "一般",

        tags:
          question.tags ||
          [],

        text:
          question.text,

        choices:
          Array.isArray(
            question.choices
          )
            ? question.choices
            : [],

        correct:
          question.correct ??
          0,

        explanation:
          question.explanation ||
          "",

        createdAt:
          new Date()
            .toISOString()
      });
    }
  }

  selectedFile = null;

  save();

  setTimeout(() => {
    navigate(
      "materials",
      {
        materialId
      }
    );
  }, 300);
}