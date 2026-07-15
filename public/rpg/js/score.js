"use strict";
/* ============================================================
   score.js  スコアシステム・ランク判定・セーブ・王国ランキング
   ------------------------------------------------------------
   「1戦闘 = 1問題セット」として、戦闘中の解答をここで集計する。
     正解        … +100点（連続正解で 2問目+20, 3問目+40…とボーナス）
     れんぞくブースト所持 … 必要連続数に達すると獲得スコアが+◯%
     不正解      … 0点（スコアガード所持なら自動発動で+40点）
   戦闘勝利時に正答率ボーナス（100%:×1.5 / 80%以上:×1.2）をかけて
   スコア確定 → S/A/B/C ランク判定 → ランクに応じてスキル抽選。
   ============================================================ */

/* ---- 現在の問題セット（戦闘）の集計変数 ---- */
let setScore = 0;   // このセットで稼いだスコア（ボーナス前）
let setCorrect = 0; // 正解数
let setTotal = 0;   // 解答数
let setStreak = 0;  // 現在の連続正解数

// 戦闘開始時に呼び、セットの集計をリセットする
function beginQuestionSet() {
  setScore = 0; setCorrect = 0; setTotal = 0; setStreak = 0;
}

// 1問答えるたびに呼ぶ。correct: 正解したかどうか
// 戻り値 {gain:このスコア, boosted:ブースト発動したか, guarded:スコアガード発動したか}
function recordAnswer(correct) {
  setTotal++;
  if (correct) {
    setStreak++;
    setCorrect++;
    let gain = 100 + 20 * (setStreak - 1); // 連続するほどボーナスが増える
    let boosted = false;
    const st = player.skills.streak;
    if (st && setStreak >= st.need) { // れんぞくブースト発動
      gain = Math.floor(gain * (1 + st.rate / 100));
      boosted = true;
    }
    setScore += gain;
    return { gain, boosted, guarded: false };
  } else {
    setStreak = 0; // 連続正解が途切れる
    const g = player.skills.guard;
    if (g && g.uses > 0) { // スコアガードが自動発動して最低限のスコアを守る
      g.uses--;
      setScore += 40;
      saveProgress();
      return { gain: 40, boosted: false, guarded: true };
    }
    return { gain: 0, boosted: false, guarded: false };
  }
}

// 戦闘勝利時に呼ぶ。正答率ボーナスをかけてスコアを確定し、ランクを判定する
function finishQuestionSet() {
  const acc = setTotal > 0 ? setCorrect / setTotal : 0;
  const mult = acc === 1 ? 1.5 : acc >= 0.8 ? 1.2 : 1.0; // 正答率ボーナス
  const final = Math.round(setScore * mult);
  // ランク判定（正答率ベース）: S=全問正解 / A=75%以上 / B=50%以上 / C=それ未満
  const rank = acc === 1 ? "S" : acc >= 0.75 ? "A" : acc >= 0.5 ? "B" : "C";
  player.totalScore += final;
  return { correct: setCorrect, total: setTotal, acc, final, mult, rank };
}

/* ============================================================
   セーブ（localStorage）
   ------------------------------------------------------------
   保存する内容: 自己ベストスコア（1回の冒険の合計スコアの最高）と所持スキル。
   スキルは次の冒険にも引き継がれる。
   ============================================================ */
const SAVE_KEY = "dq_gakushu_save_v1";

// 保存データを読み込む（無ければ空オブジェクト）
function loadSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch (e) { return {}; }
}
// 自己ベストと所持スキルを保存する（ベストは今までの最高値を残す）
function saveProgress() {
  const prev = loadSave();
  const best = Math.max(prev.best || 0, player ? (player.totalScore || 0) : 0);
  localStorage.setItem(SAVE_KEY, JSON.stringify({ best, skills: player ? player.skills : prev.skills }));
}

/* ============================================================
   王国ランキング（擬似ランキング）
   ------------------------------------------------------------
   NPCの固定スコアに、プレイヤーの自己ベストと今の冒険のスコアを
   混ぜて順位表示する。サーバー不要のローカル完結。
   ============================================================ */
const NPC_RANKING = [
  { name:"けんじゃ オルドス",   score: 6400 },
  { name:"おうじょ セシリア",   score: 5200 },
  { name:"きし ガレオン",       score: 4300 },
  { name:"まどうし ミラ",       score: 3500 },
  { name:"しょうにん ゴルド",   score: 2800 },
  { name:"そうりょ リナ",       score: 2100 },
  { name:"りょうし ハンク",     score: 1500 },
  { name:"のうふ タロ",         score: 900 },
  { name:"たびびと ノア",       score: 500 },
  { name:"スライムずき ぷに",   score: 150 },
];

// ランキング画面を開く（マップの🏆ホットスポットから呼ばれる）
function openRankingScreen() {
  const sv = loadSave();
  const best = Math.max(sv.best || 0, player ? (player.totalScore || 0) : 0);
  const entries = NPC_RANKING.map(n => ({ ...n }));
  entries.push({ name:"ゆうしゃ アレン（ベスト）", score: best, me:true });
  // 今の冒険のスコアがベストと違うときは、現在値も別枠で表示する
  if (player && player.totalScore > 0 && player.totalScore !== best) {
    entries.push({ name:"ゆうしゃ アレン（いまの冒険）", score: player.totalScore, me:true });
  }
  entries.sort((a, b) => b.score - a.score);
  el.rankList.innerHTML = entries.map((e, i) =>
    `<li class="${e.me ? "me" : ""}"><span class="rno">${i + 1}い</span><span class="rname">${e.name}</span><span>${e.score}</span></li>`
  ).join("");
  el.rankScreen.classList.remove("hidden");
}
// とじるボタンでランキング画面を閉じてマップ探索に戻る
el.rankCloseBtn.addEventListener("click", () => {
  el.rankScreen.classList.add("hidden");
  if (currentArea) resumeRoam();
});

/* ============================================================
   解説の伏せ字化
   ------------------------------------------------------------
   「さきよみの書」で解答前に解説を見せるとき、解説文の中に
   正解の単語がそのまま出ていたら「？？？」に置き換える。
   ============================================================ */
function maskAnswer(exp, answer) {
  return exp.split(answer).join("？？？");
}
