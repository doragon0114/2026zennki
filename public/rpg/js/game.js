"use strict";
/* ============================================================
   game.js  オープニング・終了処理・ゲーム開始/リトライ・初期描画
   （このファイルが読み込み順のいちばん最後。全体をまとめる役目）
   ============================================================ */

/* ---- オープニング（王様の導入） ---- */
function opening() {
  showView("battle"); // 背景として暗い城内風でもよいが、ここは玉座イメージのメッセージ主体
  el.battleView.classList.add("boss");
  drawBattleBackground(true); // 導入シーンも魔王城テイストの背景を描く
  el.enemyWrap.style.display = "none";
  el.heroWrap.style.display = "none";
  setPortrait("king");
  clearMenu();
  say([
    `王「よくぞ まいった、勇者アレンよ。`,
    `王「むかし 魔王を 封じた<br>　　勇者の ちからを もつ者よ。`,
    `王「いま ふたたび 魔王が めざめ<br>　　世界は 闇に つつまれた。`,
    `王「学びの ちからで 魔王を たおし<br>　　世界を 救ってくれ。`,
    `<span class="cat">…勇者は うなずいた。</span>`,
  ], () => {
    setPortrait(null);
    el.heroWrap.style.display = "flex";
    el.enemyWrap.style.display = "block";
    enterAreaMap(0, false);
  });
}

/* ---- 終了処理 ---- */
// ゲームオーバー画面を表示する（メッセージ演出が終わるのを少し待ってから表示）
function gameOver() {
  el.goStats.innerHTML = `とうたつ Lv.${player.lv}　／　${enemy.name} に やぶれた`;
  setTimeout(() => el.gameOver.classList.remove("hidden"), 650);
}
// ゲームクリア画面を表示する（魔王を倒したとき）
function gameClear() {
  el.clearStats.innerHTML = `さいしゅうレベル Lv.${player.lv}　／　${player.gold}G<br>勇者に えいこう あれ！`;
  setTimeout(() => el.clear.classList.remove("hidden"), 650);
}

/* ---- 開始・リトライ ---- */
// 新規ゲームを開始する（タイトル／ゲームオーバー／クリア画面のどのボタンからも呼ばれる）
function newGame() {
  player = initPlayer();
  // 前回までの冒険で覚えたスキルはセーブデータから引き継ぐ（スコアは0から）
  const sv = loadSave();
  if (sv.skills) player.skills = sv.skills;
  lastMapPos = {};
  el.title.classList.add("hidden");
  el.gameOver.classList.add("hidden");
  el.clear.classList.add("hidden");
  updateStatus();
  opening();
}
document.getElementById("startBtn").addEventListener("click", newGame);
document.getElementById("retryBtn").addEventListener("click", newGame);
document.getElementById("clearRetryBtn").addEventListener("click", newGame);

/* タイトル用エンブレム（魔王の顔）／マップ上の勇者スプライトを初期描画 */
(function initTitle() {
  drawCharacter(document.getElementById("titleCanvas"), "maou", maouGrid(), maouPal());
  drawCharacter(el.mapHero, "hero", heroGrid(), heroPal());
})();

// images/のキャラ画像は非同期に読み込まれるため、読み込み完了時に
// すでに表示済みの絵（タイトルの魔王・マップの勇者）を画像で描き直す
function onCharImageLoaded(key) {
  if (key === "maou") drawCharacter(document.getElementById("titleCanvas"), "maou", maouGrid(), maouPal());
  if (key === "hero") drawCharacter(el.mapHero, "hero", heroGrid(), heroPal());
}
