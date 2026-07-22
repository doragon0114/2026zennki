"use strict";
/* ============================================================
   state.js  ゲーム全体の状態変数・DOM要素参照・ステータス表示
   （他のファイルはここで宣言した el / player などを共有して使う）
   ============================================================ */

let player, enemy, enemyIndex, currentQuestion; // player:勇者のステータス／enemy:戦闘中の敵／enemyIndex:ENEMIES配列上の現在地／currentQuestion:出題中の問題
let msgQueue = [], msgDone = null, msgMode = false; // msgQueue:表示待ちメッセージ行／msgDone:全行表示後に呼ぶコールバック／msgMode:メッセージ送り待ち状態か
let currentArea = null; // 現在いるエリア（ENEMIESの要素）
let mapPos = {x:0,y:0}, mapTarget = null, mapMoving = false, mapAnimHandle = null, stepLast = null; // マップ上の勇者座標・移動先・移動中フラグ・アニメーションID・直前フレーム時刻
let facingLeft = false, walkedDist = 0; // 勇者の向き（左右反転）・エンカウント判定用の歩行距離の積算
let lastMapPos = {}; // 戦闘やお店から戻ったときに再開する座標をエリアごとに記憶

// 勇者の初期ステータスを生成
function initPlayer() {
  return {
    lv:1, exp:0, next:10, // レベル・経験値・次のレベルアップに必要な経験値
    maxHp:18, hp:18, maxMp:8, mp:8, atk:5, // 最大HP・現在HP・最大MP・現在MP・こうげき力
    potions:3, gold:0, // やくそうの所持数・所持ゴールド
    totalScore:0, // この冒険で稼いだ合計スコア（戦闘ごとのスコアの積み上げ）
    skills: initSkills(), // 所持スキル（newGame時にセーブデータから引き継がれる）
  };
}

// HTML内の各要素をあらかじめ取得しておき、以降はこの el 経由で参照する
const el = {
  scene: document.getElementById("scene"),
  battleView: document.getElementById("battleView"),
  battleBg: document.getElementById("battleBg"),
  mapView: document.getElementById("mapView"),
  mapCanvas: document.getElementById("mapCanvas"),
  hotspotLayer: document.getElementById("hotspotLayer"),
  mapHero: document.getElementById("mapHero"),
  areaLabel: document.getElementById("areaLabel"),
  goldMap: document.getElementById("goldMap"),
  enemyCanvas: document.getElementById("enemyCanvas"),
  enemyWrap: document.getElementById("enemyWrap"),
  enemyName: document.getElementById("enemyName"),
  enemyHpFill: document.getElementById("enemyHpFill"),
  heroCanvas: document.getElementById("heroCanvas"),
  heroWrap: document.getElementById("heroWrap"),
  hitFlash: document.getElementById("hitFlash"),
  msgText: document.getElementById("msgText"),
  portrait: document.getElementById("portraitBox"),
  advance: document.getElementById("advance"),
  cmdList: document.getElementById("cmdList"),
  hpFill: document.getElementById("hpFill"),
  hpText: document.getElementById("hpText"),
  mpFill: document.getElementById("mpFill"),
  mpText: document.getElementById("mpText"),
  lvText: document.getElementById("lvText"),
  goldText: document.getElementById("goldText"),
  title: document.getElementById("titleScreen"),
  continueBtn: document.getElementById("continueBtn"),
  gameOver: document.getElementById("gameOverScreen"),
  goStats: document.getElementById("goStats"),
  clear: document.getElementById("clearScreen"),
  clearStats: document.getElementById("clearStats"),
  game: document.getElementById("game"),
  scText: document.getElementById("scText"),
  resultScreen: document.getElementById("resultScreen"),
  resultBody: document.getElementById("resultBody"),
  resultRank: document.getElementById("resultRank"),
  resultBtn: document.getElementById("resultBtn"),
  rankScreen: document.getElementById("rankScreen"),
  rankList: document.getElementById("rankList"),
  rankCloseBtn: document.getElementById("rankCloseBtn"),
};

/* ============================================================
   ステータス描画
   ============================================================ */
// 勇者のHP/MP/レベル/ゴールド表示を最新のplayerの値で更新する
function updateStatus() {
  el.lvText.textContent = "Lv " + player.lv;
  el.hpText.textContent = player.hp + "/" + player.maxHp;
  el.mpText.textContent = player.mp + "/" + player.maxMp;
  el.goldText.textContent = player.gold;
  el.goldMap.textContent = player.gold;
  const hpP = Math.max(0, player.hp / player.maxHp * 100);
  el.hpFill.style.width = hpP + "%";
  // HP残量に応じてバーの色を変える（50%超:緑／25%超:黄／それ以下:赤）
  el.hpFill.style.background = hpP > 50
    ? "linear-gradient(#7dff8f,#22aa3a)"
    : hpP > 25 ? "linear-gradient(#ffe14d,#c8a010)" : "linear-gradient(#ff8a7a,#d02010)";
  el.mpFill.style.width = Math.max(0, player.mp / player.maxMp * 100) + "%";
  el.scText.textContent = player.totalScore || 0; // 合計スコア表示
}
// 敵のHPバー表示を更新する
function updateEnemyHp() {
  el.enemyHpFill.style.width = Math.max(0, enemy.hp / enemy.max * 100) + "%";
}
