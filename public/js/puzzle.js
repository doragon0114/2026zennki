/* ============================================================
   puzzle.js — パズルルーム画面
   ─────────────────────────────────────────────────────────────
   担当: フロントエンド担当

   画面構成:
     ・パズルルーム一覧画面（renderPuzzleRoom）
         各問題セット（教科）に対応するパズル盤面をカード一覧表示
     ・パズル盤面詳細画面（renderPuzzleBoard）
         獲得済み／未獲得のピースをグリッド表示

   コンセプト（3DSすれちがい広場風）:
     ・問題セット（教科）ごとに1つのパズル盤面が対応する
     ・盤面の分割数は、そのセットの問題数に応じて自動で決まる
     ・ピースは「他のユーザーがその問題に正解する」ことで獲得される
       想定（サーバー側のトラッキングが必要）
     ・未獲得ピースはぼかし＋鍵アイコンで隠す

   TODO（DB担当者へ）:
     ・GET  /api/puzzle/boards?userId=...
         → [{ materialId, size, pieces:[{index,acquired}] }, ...] を返す想定
     ・問題に正解した際、出題者ではないユーザーが正解した場合のみ
       該当ピース（question.id に対応する index）を acquired=true にする
     ・上記APIが実装されるまでは、ここでは localStorage を使った
       モック生成（buildPuzzleBoards）でプロトタイプ動作させている
============================================================ */

/* パズル用アイコン（IC は shared.js で定義済みのオブジェクトに追加する） */
IC.puzzlePiece = `<path d="M4 7a2 2 0 0 1 2-2h3.17a1 1 0 0 1 .9.56A1.5 1.5 0 0 0 11.5 6.5a1.5 1.5 0 0 0 1.43-1.94A1 1 0 0 1 13.83 3H17a2 2 0 0 1 2 2v3.17a1 1 0 0 1-.56.9A1.5 1.5 0 0 0 17.5 10.5a1.5 1.5 0 0 0 1.94 1.43 1 1 0 0 1 1.06.9V17a2 2 0 0 1-2 2h-3.17a1 1 0 0 1-.9-.56A1.5 1.5 0 0 0 12.5 17.5a1.5 1.5 0 0 0-1.43 1.94A1 1 0 0 1 10.17 20H7a2 2 0 0 1-2-2v-3.17a1 1 0 0 1 .56-.9A1.5 1.5 0 0 0 6.5 12.5 1.5 1.5 0 0 0 4.56 11.06 1 1 0 0 1 4 10.17V7z"/>`;

let puzzleBoardsLoaded  = false;
let puzzleBoardsLoading = false;
let puzzleServerBoards  = null; // サーバーから取得できた場合はこちらを優先

/* ============================================================
   サーバーからの取得を試みる（未実装時は静かにフォールバックする）
============================================================ */
async function loadPuzzleBoardsFromServer(force = false) {
  if (puzzleBoardsLoading) return;
  if (puzzleBoardsLoaded && !force) return;

  puzzleBoardsLoading = true;

  try {
    const userId = encodeURIComponent(S.user?.userId || S.user?.id || "");
    const response = await fetch(`/api/puzzle/boards?userId=${userId}`);

    if (!response.ok) {
      throw new Error("puzzle API not available");
    }

    const data = await response.json();

    if (!data.ok || !Array.isArray(data.boards)) {
      throw new Error("invalid puzzle payload");
    }

    puzzleServerBoards = data.boards;
  } catch {
    // サーバーAPI未実装、またはエラー時はモック生成にフォールバックする
    puzzleServerBoards = null;
  } finally {
    puzzleBoardsLoaded = true;
    puzzleBoardsLoading = false;
  }
}

/* ============================================================
   ローカル獲得状況ストレージ（プロトタイプ用フォールバック）
============================================================ */
function getPuzzleStorageKey() {
  const userId = S.user?.userId || S.user?.id || "anon";
  return `revino_puzzle_progress_${userId}`;
}

function loadPuzzleProgressStore() {
  try {
    return JSON.parse(localStorage.getItem(getPuzzleStorageKey()) || "{}");
  } catch {
    return {};
  }
}

function savePuzzleProgressStore(store) {
  try {
    localStorage.setItem(getPuzzleStorageKey(), JSON.stringify(store));
  } catch {
    /* ストレージが使えない環境では黙って無視する */
  }
}

/* 問題数から盤面の分割数（1辺のピース数）を決める */
function getBoardGridSize(questionCount) {
  if (questionCount >= 16) return 4;
  if (questionCount >= 6)  return 3;
  return 2;
}

/* ============================================================
   パズル盤面データを構築する
   サーバーデータがあればそれを使い、なければモック生成する
============================================================ */
function buildPuzzleBoards() {
  if (Array.isArray(puzzleServerBoards)) {
    return puzzleServerBoards.map(serverBoard => {
      const material = S.materials.find(m => m.id === serverBoard.materialId);
      if (!material) return null;

      const acquired = serverBoard.pieces
        .slice()
        .sort((a, b) => a.index - b.index)
        .map(p => Boolean(p.acquired));

      const acquiredCount = acquired.filter(Boolean).length;

      return {
        material,
        size: serverBoard.size,
        total: acquired.length,
        acquired,
        acquiredCount,
        complete: acquiredCount === acquired.length && acquired.length > 0
      };
    }).filter(Boolean);
  }

  // ---- モック生成（フォールバック） ----
  const store = loadPuzzleProgressStore();
  let storeChanged = false;

  const boards = S.materials.map(material => {
    const questionCount = S.questions.filter(q => q.materialId === material.id).length;
    const size  = getBoardGridSize(questionCount);
    const total = size * size;

    let acquired = store[material.id];

    if (!Array.isArray(acquired) || acquired.length !== total) {
      // TODO(DB担当): 本来は「他人がこの教科の問題に正解した数」を使う。
      // API実装までは、正答率をヒントにしたランダム生成で代用する。
      const hasRate = material.correctRate !== null && material.correctRate !== undefined;
      const baseRatio = hasRate
        ? Math.max(0.15, Math.min(0.9, Number(material.correctRate) / 100))
        : 0.35;

      acquired = Array.from({ length: total }, () => Math.random() < baseRatio);

      if (!acquired.some(Boolean)) {
        acquired[0] = true; // 最低1ピースは獲得済みにしておく
      }

      store[material.id] = acquired;
      storeChanged = true;
    }

    const acquiredCount = acquired.filter(Boolean).length;

    return {
      material,
      size,
      total,
      acquired,
      acquiredCount,
      complete: acquiredCount === total
    };
  });

  if (storeChanged) {
    savePuzzleProgressStore(store);
  }

  return boards;
}

/* ============================================================
   読み込み中プレースホルダー
============================================================ */
function renderPuzzleLoading(title = "パズルルーム") {
  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('home')">←</button>
      <div class="header-title">${esc(title)}</div>
    </div>
    <div class="screen-body">
      <div style="text-align:center;padding:80px 20px;color:var(--text-3)">
        <div class="empty-icon-wrap">${svg(IC.puzzlePiece, 52)}</div>
        <div style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px">
          パズル盤面を読み込み中です
        </div>
        <div style="font-size:13px">少々お待ちください...</div>
      </div>
    </div>
  `;
}

/* ============================================================
   パズルルーム一覧画面
============================================================ */
function renderPuzzleRoom() {
  if (!materialsLoaded) {
    setTimeout(async () => {
      await loadMaterialsFromServer(true);
      navigate("puzzle-room");
    }, 0);

    return renderPuzzleLoading();
  }

  if (!puzzleBoardsLoaded) {
    setTimeout(async () => {
      await loadPuzzleBoardsFromServer(true);
      navigate("puzzle-room");
    }, 0);

    return renderPuzzleLoading();
  }

  const boards = buildPuzzleBoards();

  const totalPieces   = boards.reduce((sum, b) => sum + b.total, 0);
  const totalAcquired = boards.reduce((sum, b) => sum + b.acquiredCount, 0);
  const completeCount = boards.filter(b => b.complete).length;
  const overallPct    = totalPieces ? Math.round((totalAcquired / totalPieces) * 100) : 0;

  const listHTML = boards.length === 0
    ? `
      <div style="text-align:center;padding:60px 20px">
        <div class="empty-icon-wrap">${svg(IC.puzzlePiece, 52)}</div>
        <div style="font-size:16px;font-weight:800;color:var(--text);margin-bottom:6px">
          パズル盤面がありません
        </div>
        <div style="font-size:13px;color:var(--text-3);margin-bottom:20px">
          問題セットをアップロードすると、教科ごとにパズル盤面が作られます
        </div>
        <button class="btn btn-primary btn-sm" onclick="navigate('upload')">
          ${svg(IC.zap, 14)} 資料をアップロード
        </button>
      </div>
    `
    : boards.map((board, index) => renderPuzzleBoardCard(board, index)).join("");

  return `
    <div class="puzzle-hero">
      <button class="back-btn puzzle-hero-back" onclick="navigate('home')">←</button>

      <div class="puzzle-hero-icon">${svg(IC.puzzlePiece, 34)}</div>
      <div class="puzzle-hero-title">パズルルーム</div>
      <div class="puzzle-hero-sub">みんなで解いてピースを集めよう</div>

      <div class="puzzle-hero-stats">
        <div class="puzzle-hero-stat">
          <div class="puzzle-hero-stat-num">${totalAcquired}<span>/${totalPieces}</span></div>
          <div class="puzzle-hero-stat-lbl">獲得ピース</div>
        </div>
        <div class="puzzle-hero-stat-sep"></div>
        <div class="puzzle-hero-stat">
          <div class="puzzle-hero-stat-num">${completeCount}<span>/${boards.length}</span></div>
          <div class="puzzle-hero-stat-lbl">コンプリート盤面</div>
        </div>
        <div class="puzzle-hero-stat-sep"></div>
        <div class="puzzle-hero-stat">
          <div class="puzzle-hero-stat-num">${overallPct}<span>%</span></div>
          <div class="puzzle-hero-stat-lbl">全体進捗</div>
        </div>
      </div>
    </div>

    <div class="screen-body">
      <div class="alert alert-info">
        ${svg(IC.lightbulb, 14)}
        自分の問題セットを他の人が解くと、対応する盤面のピースが手に入るよ。
        教科ごとに1つの盤面が用意されているよ。
      </div>

      <div class="section-header">
        <div class="section-title">盤面一覧</div>
      </div>

      <div class="puzzle-board-list">
        ${listHTML}
      </div>
      <div style="height:24px"></div>
    </div>
  `;
}

/* パズル盤面カード（一覧画面用） */
function renderPuzzleBoardCard(board, index) {
  const colorClass = `puzzle-color-${index % 6}`;
  const pct = board.total ? Math.round((board.acquiredCount / board.total) * 100) : 0;

  const miniCells = board.acquired
    .map(isAcquired => `<div class="puzzle-mini-cell ${colorClass} ${isAcquired ? "filled" : ""}"></div>`)
    .join("");

  return `
    <div class="puzzle-board-card" onclick="navigate('puzzle-board',{materialId:'${esc(board.material.id)}'})">
      <div class="puzzle-mini-grid" style="grid-template-columns:repeat(${board.size},1fr)">
        ${miniCells}
      </div>

      <div class="puzzle-board-info">
        <div class="puzzle-board-title">
          ${esc(board.material.name)}
          ${board.complete ? `<span class="puzzle-complete-tag">${svg(IC.checkCircle, 12)} コンプリート</span>` : ""}
        </div>
        <div class="puzzle-board-progress-bar-bg">
          <div class="puzzle-board-progress-bar-fill ${colorClass}" style="width:${pct}%"></div>
        </div>
        <div class="puzzle-board-meta">${board.acquiredCount} / ${board.total} ピース獲得</div>
      </div>

      <div class="puzzle-board-arrow">›</div>
    </div>
  `;
}

/* ============================================================
   パズル盤面詳細画面
============================================================ */
function renderPuzzleBoard(params = {}) {
  const { materialId } = params;

  if (!materialId) {
    return `
      <div class="screen-header blue-bg">
        <button class="back-btn" onclick="navigate('puzzle-room')">←</button>
        <div class="header-title">パズル盤面</div>
      </div>
      <div class="screen-body">
        <div style="text-align:center;padding:60px 20px;color:var(--text-3)">
          <div class="empty-icon-wrap">${svg(IC.help, 40)}</div>
          <div style="font-weight:800;color:var(--text);margin-bottom:6px">盤面が選択されていません</div>
          <button class="btn btn-primary mt16" onclick="navigate('puzzle-room')">パズルルームへ戻る</button>
        </div>
      </div>
    `;
  }

  if (!materialsLoaded) {
    setTimeout(async () => {
      await loadMaterialsFromServer(true);
      navigate("puzzle-board", { materialId });
    }, 0);

    return renderPuzzleLoading("パズル盤面");
  }

  if (!puzzleBoardsLoaded) {
    setTimeout(async () => {
      await loadPuzzleBoardsFromServer(true);
      navigate("puzzle-board", { materialId });
    }, 0);

    return renderPuzzleLoading("パズル盤面");
  }

  const material = S.materials.find(m => m.id === materialId);

  if (!material) {
    return `
      <div class="screen-header blue-bg">
        <button class="back-btn" onclick="navigate('puzzle-room')">←</button>
        <div class="header-title">パズル盤面</div>
      </div>
      <div class="screen-body">
        <div style="text-align:center;padding:60px 20px;color:var(--text-3)">
          <div class="empty-icon-wrap">${svg(IC.help, 40)}</div>
          <div style="font-weight:800;color:var(--text);margin-bottom:6px">盤面が見つかりません</div>
          <button class="btn btn-primary mt16" onclick="navigate('puzzle-room')">パズルルームへ戻る</button>
        </div>
      </div>
    `;
  }

  const boards = buildPuzzleBoards();
  const boardIndex = boards.findIndex(b => b.material.id === materialId);
  const board = boards[boardIndex];
  const colorClass = `puzzle-color-${Math.max(0, boardIndex) % 6}`;

  const pieces = board.acquired
    .map((isAcquired, i) => `
      <div class="puzzle-piece ${colorClass} ${isAcquired ? "acquired" : "locked"}">
        ${isAcquired
          ? `<span class="puzzle-piece-num">${i + 1}</span>`
          : `
            <div class="puzzle-piece-blur"></div>
            <div class="puzzle-piece-lock">${svg(IC.lock, 16)}</div>
          `}
      </div>
    `)
    .join("");

  const pct = board.total ? Math.round((board.acquiredCount / board.total) * 100) : 0;
  const remaining = board.total - board.acquiredCount;

  return `
    <div class="screen-header blue-bg">
      <button class="back-btn" onclick="navigate('puzzle-room')">←</button>
      <div class="header-title">${esc(material.name)}</div>
    </div>

    <div class="screen-body">
      ${board.complete ? `
        <div class="puzzle-complete-banner">
          ${svg(IC.trophy, 24)}
          <div>
            <div class="puzzle-complete-banner-title">盤面コンプリート！</div>
            <div class="puzzle-complete-banner-sub">すべてのピースを集めました</div>
          </div>
        </div>
      ` : ""}

      <div class="puzzle-grid-wrap">
        <div class="puzzle-grid" style="grid-template-columns:repeat(${board.size},1fr)">
          ${pieces}
        </div>
      </div>

      <div class="puzzle-stats-row">
        <div class="puzzle-stat">
          <div class="puzzle-stat-num" style="color:var(--primary)">${board.acquiredCount}</div>
          <div class="puzzle-stat-lbl">獲得ピース</div>
        </div>
        <div class="puzzle-stat">
          <div class="puzzle-stat-num" style="color:var(--text-3)">${remaining}</div>
          <div class="puzzle-stat-lbl">残りピース</div>
        </div>
        <div class="puzzle-stat">
          <div class="puzzle-stat-num" style="color:var(--gold)">${pct}%</div>
          <div class="puzzle-stat-lbl">達成率</div>
        </div>
      </div>

      <div class="alert alert-info">
        ${svg(IC.lightbulb, 14)}
        「${esc(material.name)}」の問題を他の人が解くと、この盤面のピースが手に入るよ。
        自分でも復習してどんどん問題を増やそう！
      </div>

      <button class="btn btn-outline" style="width:100%" onclick="navigate('question-edit',{materialId:'${esc(materialId)}'})">
        ${svg(IC.folder, 14)} この教科の問題を見る
      </button>
    </div>
  `;
}