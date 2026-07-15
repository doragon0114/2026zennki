"use strict";
/* ============================================================
   skills.js  スキルシステム
   ------------------------------------------------------------
   戦闘（=1問題セット）終了時のスコアランクに応じてスキルを抽選し、
   良いランクほど「良いスキル」「良い乱数（回数・倍率）」が出る。
   同じスキルを再入手すると強化される（回数追加・レベルアップなど）。

   スキル一覧:
     chip    たくけずり       … 出題中に選択肢を減らす（Lv1:4択→3択 / Lv2:4択→2択）回数制
     insight さきよみの書     … 解答前に解説を見る（正解の単語は伏せ字）回数制
     guard   スコアガード     … まちがえてもスコアの一部を守る（自動発動）回数制
     streak  れんぞくブースト … n問連続正解でスコア上昇率アップ（パッシブ）
   ============================================================ */

// スキルの表示名とアイコン
const SKILL_DEFS = {
  chip:    { name:"たくけずり",       icon:"🔮" },
  insight: { name:"さきよみの書",     icon:"📖" },
  guard:   { name:"スコアガード",     icon:"🛡" },
  streak:  { name:"れんぞくブースト", icon:"🔥" },
};

// 何も持っていない状態のスキル所持データを作る
function initSkills() {
  return { chip:null, insight:null, guard:null, streak:null };
  // chip:{level,uses} insight:{uses} guard:{uses} streak:{rate,need} の形で埋まっていく
}

/* ============================================================
   ランク別のドロップ設定
   ------------------------------------------------------------
   chance: スキルが出る確率／lv2: たくけずりがLv2で出る確率
   uses: 使用回数の乱数範囲／rate: ブースト倍率(%)の乱数範囲／need: 必要連続正解数の乱数範囲
   高ランクほど「出やすい」「乱数の下限が高い」ようにしてある
   ============================================================ */
const RANK_DROP = {
  S: { chance:1.0, lv2:0.6,  uses:[3,5], rate:[30,50], need:[2,2] },
  A: { chance:0.9, lv2:0.3,  uses:[2,4], rate:[20,40], need:[2,3] },
  B: { chance:0.7, lv2:0,    uses:[1,3], rate:[15,30], need:[3,4] },
  C: { chance:0.4, lv2:0,    uses:[1,2], rate:[10,20], need:[4,5] },
};

// min〜maxの整数をランダムに返す
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

// ランクに応じてスキルを1つ抽選する。ハズレなら null を返す
function rollSkillDrop(rank) {
  const conf = RANK_DROP[rank];
  if (Math.random() >= conf.chance) return null; // 今回はドロップなし
  const kinds = ["chip", "insight", "guard", "streak"];
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  if (kind === "chip") {
    return { kind, level: Math.random() < conf.lv2 ? 2 : 1, uses: randInt(...conf.uses) };
  }
  if (kind === "insight" || kind === "guard") {
    return { kind, uses: randInt(...conf.uses) };
  }
  // streak（パッシブ）: 倍率と必要連続数が乱数で決まる
  return { kind, rate: randInt(...conf.rate), need: randInt(...conf.need) };
}

/* ============================================================
   スキルの入手・強化
   ------------------------------------------------------------
   すでに同じスキルを持っている場合は強化として扱う:
     chip    … 回数を加算。より高いレベルを引いたらレベルも上がる
     insight/guard … 回数を加算
     streak  … 倍率は高いほう、必要連続数は低いほうを採用
   ============================================================ */
// ドロップしたスキルをプレイヤーに反映し、表示用メッセージを返す
function grantSkill(drop) {
  const s = player.skills;
  const def = SKILL_DEFS[drop.kind];
  let msg;
  if (drop.kind === "chip") {
    if (!s.chip) {
      s.chip = { level: drop.level, uses: drop.uses };
      msg = `${def.icon} <b class="gold">${def.name} Lv${drop.level}</b> を おぼえた！<br><span class="cat">4択が${drop.level >= 2 ? 2 : 3}択になる（${drop.uses}回つかえる）</span>`;
    } else {
      s.chip.uses += drop.uses;
      if (drop.level > s.chip.level) {
        s.chip.level = drop.level;
        msg = `${def.icon} <b class="gold">${def.name}が Lv2 に 強化された！</b><br><span class="cat">4択→2択になった！（回数も+${drop.uses}、のこり${s.chip.uses}回）</span>`;
      } else {
        msg = `${def.icon} ${def.name}の 回数が <b class="gold">+${drop.uses}</b> ふえた！<br><span class="cat">のこり${s.chip.uses}回</span>`;
      }
    }
  } else if (drop.kind === "insight" || drop.kind === "guard") {
    if (!s[drop.kind]) {
      s[drop.kind] = { uses: drop.uses };
      msg = `${def.icon} <b class="gold">${def.name}</b> を てにいれた！<br><span class="cat">${drop.uses}回つかえる</span>`;
    } else {
      s[drop.kind].uses += drop.uses;
      msg = `${def.icon} ${def.name}の 回数が <b class="gold">+${drop.uses}</b> ふえた！<br><span class="cat">のこり${s[drop.kind].uses}回</span>`;
    }
  } else { // streak
    if (!s.streak) {
      s.streak = { rate: drop.rate, need: drop.need };
      msg = `${def.icon} <b class="gold">${def.name}</b> を おぼえた！<br><span class="cat">${drop.need}問連続で正解すると スコア+${drop.rate}%</span>`;
    } else {
      // 倍率は高いほう・必要連続数は低いほうを残す（悪くはならない）
      const better = drop.rate > s.streak.rate || drop.need < s.streak.need;
      s.streak.rate = Math.max(s.streak.rate, drop.rate);
      s.streak.need = Math.min(s.streak.need, drop.need);
      msg = better
        ? `${def.icon} <b class="gold">${def.name}が 強化された！</b><br><span class="cat">${s.streak.need}問連続で スコア+${s.streak.rate}%</span>`
        : `${def.icon} ${def.name}は これいじょう 強化されなかった…<br><span class="cat">（いまは ${s.streak.need}連続で+${s.streak.rate}%）</span>`;
    }
  }
  saveProgress(); // 入手したスキルはすぐブラウザに保存する
  return msg;
}

/* ============================================================
   所持スキルの一覧表示（マップの「スキルを かくにん」から呼ばれる）
   ============================================================ */
function showSkillList() {
  const s = player.skills;
  const parts = [];
  if (s.chip)    parts.push(`🔮 たくけずり Lv${s.chip.level}<span class="cat">（4択→${s.chip.level >= 2 ? 2 : 3}択・のこり${s.chip.uses}回）</span>`);
  if (s.insight) parts.push(`📖 さきよみの書<span class="cat">（のこり${s.insight.uses}回）</span>`);
  if (s.guard)   parts.push(`🛡 スコアガード<span class="cat">（のこり${s.guard.uses}回・自動発動）</span>`);
  if (s.streak)  parts.push(`🔥 れんぞくブースト<span class="cat">（${s.streak.need}連続正解で スコア+${s.streak.rate}%）</span>`);
  if (parts.length === 0) {
    say([`まだ スキルを もっていない。<br><span class="cat">たたかいで 良いランクを とると 手にはいる！</span>`], resumeRoam);
  } else {
    say([parts.join("<br>")], resumeRoam);
  }
}
