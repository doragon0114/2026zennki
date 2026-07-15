"use strict";

/* ============================================================
   game.js
   オープニング・開始・中断・再開・終了処理
============================================================ */

/* ============================================================
   オープニング
============================================================ */

function opening() {
  showView("battle");

  el.battleView.classList.add("boss");

  drawBattleBackground(true);

  el.enemyWrap.style.display = "none";
  el.heroWrap.style.display = "none";

  setPortrait("king");
  clearMenu();

  say([
    `王「よくぞ まいった、勇者アレンよ。`,
    `王「むかし 魔王を 封じた<br>
      　　勇者の ちからを もつ者よ。`,
    `王「いま ふたたび 魔王が めざめ<br>
      　　世界は 闇に つつまれた。`,
    `王「学びの ちからで 魔王を たおし<br>
      　　世界を 救ってくれ。`,
    `<span class="cat">
      …勇者は うなずいた。
    </span>`
  ], () => {
    setPortrait(null);

    el.heroWrap.style.display = "flex";
    el.enemyWrap.style.display = "block";

    enterAreaMap(0, false);
  });
}

/* ============================================================
   共通処理
============================================================ */

/*
 * RPGで使える問題があるか確認する。
 */
function canStartRpg() {
  if (
    Array.isArray(QUESTION_SETS) &&
    QUESTION_SETS.length > 0
  ) {
    return true;
  }

  alert(
    "RPGで使用できる問題セットがありません。\n\n" +
    "Revinoで選択肢付きの問題セットを作成してから、" +
    "もう一度RPGモードを開いてください。"
  );

  window.location.href = "/";

  return false;
}

/*
 * ゲーム画面上のオーバーレイを閉じる。
 */
function hideGameOverlays() {
  el.title.classList.add("hidden");
  el.gameOver.classList.add("hidden");
  el.clear.classList.add("hidden");
  el.resultScreen.classList.add("hidden");
  el.rankScreen.classList.add("hidden");
}

/*
 * 中断データの有無によって
 * 「つづきから」ボタンを表示・非表示にする。
 */
function refreshContinueButton() {
  if (!el.continueBtn) {
    return;
  }

  el.continueBtn.classList.toggle(
    "hidden",
    !hasAdventureSave()
  );
}

/* ============================================================
   中断
============================================================ */

function suspendAdventure() {
  if (!player || !currentArea) {
    alert(
      "現在は冒険を中断できません。"
    );

    return;
  }

  const shouldSuspend = window.confirm(
    "現在の冒険を保存して、Revinoのホームへ戻りますか？\n\n" +
    "次回はタイトル画面の「つづきから」で再開できます。"
  );

  if (!shouldSuspend) {
    return;
  }

  const saved = saveAdventureCheckpoint();

  if (!saved) {
    alert(
      "冒険の保存に失敗しました。\n" +
      "ブラウザの保存設定を確認してください。"
    );

    return;
  }

  window.location.href = "/";
}

/* ============================================================
   つづきから
============================================================ */

function continueGame() {
  if (!canStartRpg()) {
    return;
  }

  const savedData = loadAdventureSave();

  if (!savedData) {
    alert(
      "中断した冒険データが見つかりませんでした。"
    );

    refreshContinueButton();

    return;
  }

  const defaultPlayer = initPlayer();
  const savedPlayer = savedData.player || {};

  /*
   * 今後playerへ項目を追加しても、
   * 初期値が不足しないように統合する。
   */
  player = {
    ...defaultPlayer,
    ...savedPlayer,

    skills: {
      ...initSkills(),
      ...(savedPlayer.skills || {})
    }
  };

  /*
   * 保存されているエリア番号を
   * 現在のENEMIES範囲に収める。
   */
  const areaIndex = Math.max(
    0,
    Math.min(
      ENEMIES.length - 1,
      Number(savedData.areaIndex) || 0
    )
  );

  const areaStart =
    ENEMIES[areaIndex]?.walk?.start || {
      x: 0,
      y: 0
    };

  const savedX = Number(
    savedData.mapPos?.x
  );

  const savedY = Number(
    savedData.mapPos?.y
  );

  const resumePosition = {
    x: Number.isFinite(savedX)
      ? savedX
      : areaStart.x,

    y: Number.isFinite(savedY)
      ? savedY
      : areaStart.y
  };

  lastMapPos =
    savedData.lastMapPos &&
    typeof savedData.lastMapPos === "object"
      ? savedData.lastMapPos
      : {};

  /*
   * enterAreaMap(index, true)が現在位置を復元できるよう、
   * 対象エリアへ保存位置を入れる。
   */
  lastMapPos[areaIndex] = resumePosition;

  currentQuestion = null;
  enemy = null;

  msgQueue = [];
  msgDone = null;
  msgMode = false;

  hideGameOverlays();

  updateStatus();

  enterAreaMap(
    areaIndex,
    true
  );

  el.msgText.innerHTML = `
    <span class="cat">
      ${currentArea.area}
    </span><br>
    中断したところから ぼうけんを再開した。
  `;
}

/* ============================================================
   新しいゲーム
============================================================ */

function newGame() {
  if (!canStartRpg()) {
    return;
  }

  /*
   * 中断データがある状態で「はじめから」を押した場合、
   * 誤って消さないよう確認する。
   */
  if (hasAdventureSave()) {
    const shouldRestart = window.confirm(
      "中断中の冒険があります。\n\n" +
      "保存データを消して、はじめから遊びますか？"
    );

    if (!shouldRestart) {
      return;
    }
  }

  clearAdventureSave();

  player = initPlayer();

  /*
   * 自己ベスト保存側のスキルは引き継ぐ。
   */
  const savedData = loadSave();

  if (savedData.skills) {
    player.skills = savedData.skills;
  }

  lastMapPos = {};
  currentQuestion = null;
  enemy = null;

  hideGameOverlays();

  refreshContinueButton();
  updateStatus();

  opening();
}

/* ============================================================
   終了処理
============================================================ */

function gameOver() {
  /*
   * ゲームオーバーになった冒険は再開不可にする。
   */
  clearAdventureSave();
  refreshContinueButton();

  el.goStats.innerHTML =
    `とうたつ Lv.${player.lv}　／　` +
    `${enemy.name} に やぶれた`;

  window.setTimeout(() => {
    el.gameOver.classList.remove("hidden");
  }, 650);
}

function gameClear() {
  /*
   * クリア済みの冒険も中断データを削除する。
   */
  clearAdventureSave();
  refreshContinueButton();

  el.clearStats.innerHTML =
    `さいしゅうレベル Lv.${player.lv}　／　` +
    `${player.gold}G<br>` +
    `勇者に えいこう あれ！`;

  window.setTimeout(() => {
    el.clear.classList.remove("hidden");
  }, 650);
}

/* ============================================================
   ボタンイベント
============================================================ */

document
  .getElementById("startBtn")
  .addEventListener(
    "click",
    newGame
  );

document
  .getElementById("continueBtn")
  .addEventListener(
    "click",
    continueGame
  );

document
  .getElementById("retryBtn")
  .addEventListener(
    "click",
    newGame
  );

document
  .getElementById("clearRetryBtn")
  .addEventListener(
    "click",
    newGame
  );

/* ============================================================
   初期描画
============================================================ */

(function initTitle() {
  drawCharacter(
    document.getElementById("titleCanvas"),
    "maou",
    maouGrid(),
    maouPal()
  );

  drawCharacter(
    el.mapHero,
    "hero",
    heroGrid(),
    heroPal()
  );

  refreshContinueButton();
})();

/*
 * imagesフォルダの画像読み込み完了時に再描画する。
 */
function onCharImageLoaded(key) {
  if (key === "maou") {
    drawCharacter(
      document.getElementById("titleCanvas"),
      "maou",
      maouGrid(),
      maouPal()
    );
  }

  if (key === "hero") {
    drawCharacter(
      el.mapHero,
      "hero",
      heroGrid(),
      heroPal()
    );
  }
}