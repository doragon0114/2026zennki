"use strict";
/* ============================================================
   sprites.js  スプライト描画ユーティリティ ＋ ドット絵データ
   （敵・勇者・王様などのピクセルアートをここで定義する）
   ============================================================ */

/* ============================================================
   キャラクター画像（images/フォルダのPNG）の読み込み
   ------------------------------------------------------------
   images/ フォルダに以下の名前でPNGを置くと、ドット絵の代わりに
   その画像が自動で使われる（無ければ従来のドット絵で表示）:
     hero.png   … 勇者（戦闘画面・マップ・タイトル）
     king.png   … 王様の顔（メッセージ横のポートレート）
     slimeA.png … スライム（はじまりの草原の敵）
     slimeB.png … ぶるぷるん（港町の敵）
     slimeC.png … デビルスライム（国境の村の敵）
     demon.png  … だてんしデーモン（中ボス）
     maou.png   … まおう ダークロード（ラスボス・タイトル画面）
   背景が透明なPNGを推奨。サイズは自動で枠に合わせて縮小される。
   ============================================================ */
const IMG = {}; // 読み込みに成功した画像を key → Image で保持する
const CHAR_IMAGE_KEYS = ["hero", "king", "slimeA", "slimeB", "slimeC", "demon", "maou"];
(function preloadCharImages() {
  CHAR_IMAGE_KEYS.forEach(key => {
    const img = new Image();
    img.onload = () => {
      IMG[key] = img;
      // すでに画面に描かれているもの（タイトルの魔王・マップの勇者など）を描き直す
      if (typeof onCharImageLoaded === "function") onCharImageLoaded(key);
    };
    img.onerror = () => {}; // 画像が無ければ何もしない（ドット絵のまま）
    img.src = "images/" + key + ".png";
  });
})();

// キャラクターを描く：images/ に画像があればそれを、無ければドット絵を描く
// key: 上のCHAR_IMAGE_KEYSの名前／grid・palette: ドット絵のフォールバック用データ
function drawCharacter(canvas, key, grid, palette) {
  const img = IMG[key];
  if (!img) { drawSprite(canvas, grid, palette); return; }
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 小さいドット絵画像はくっきり拡大、大きめのイラストはなめらかに縮小する
  ctx.imageSmoothingEnabled = img.width > 96;
  // 縦横比を保ったままCanvasに収まる最大サイズで中央に描く
  const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
  const w = img.width * scale, h = img.height * scale;
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}

// グリッド(文字の2次元配列)とパレット(文字→色)を使ってCanvasにドット絵を描く
function drawSprite(canvas, grid, palette, scale) {
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rows = grid.length, cols = grid[0].length;
  // 1マスあたりのピクセルサイズ（scale未指定ならCanvasに収まる最大値を自動計算）
  const px = scale || Math.floor(Math.min(canvas.width / cols, canvas.height / rows));
  const ox = Math.floor((canvas.width - cols * px) / 2);
  const oy = Math.floor((canvas.height - rows * px) / 2);
  for (let y = 0; y < rows; y++) {
    const row = grid[y];
    for (let x = 0; x < cols; x++) {
      const c = row[x];
      if (c === "." || c === " ") continue; // 「.」「空白」は透明として飛ばす
      const color = palette[c];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }
  }
}
// 左半分の文字列から、左右対称のグリッドを生成する（各行を反転して連結）
function mir(half) {
  return half.map(r => r + r.split("").reverse().join(""));
}

/* ============================================================
   ドット絵データ
   ============================================================ */
// --- スライム（色替え） ---
function slimeGrid() {
  return mir([
    "........",
    "........",
    ".....xxx",
    "....xxxx",
    "...xxxxx",
    "...xhxxx",
    "..xxxxxx",
    "..xxoxxx",
    "..xxooxx",
    "..xxoxxx",
    "..xxxxxx",
    "...xxxxx",
    "..xxxxxx",
    "xxxxxxxx",
    "xxxxxxxx",
    "........",
  ]);
}
function slimePal(body, hi) { return { x: body, h: hi, o: "#0a1020" }; }

// --- 中ボス：堕天使デーモン（紫・翼・角） ---
function demonGrid() {
  return mir([
    "..........",
    ".......h..",
    "......hb..",
    ".....bbbb.",
    "....bbbbbb",
    ".w..bbbbbb",
    "ww..bbebbb",
    "www.bbbbbb",
    "wwwWbbmmbb",
    "wwwW.bbbbb",
    ".wwW.bbbbb",
    "..c..bkbbb",
    "...c.bbbbb",
    ".....bb.bb",
    "....cc..cc",
    "...cc...cc",
  ]);
}
function demonPal() {
  return {
    w:"#8e46c8", W:"#4d1f7e", b:"#a85fd6", k:"#6f2fa6",
    h:"#f0e2b4", e:"#ffd21e", m:"#2a0a2a", c:"#f0e2b4",
  };
}

// --- 魔王：ダークドラゴン（黒赤・大きい角・赤い目） ---
function maouGrid() {
  return mir([
    "....h.....",
    "...hh...h.",
    "..hbb..hb.",
    "..hbbbbbb.",
    ".dbbbbbbbb",
    "w.dbbbebbb",
    "ww.dbbbbbb",
    "www.bbbbbb",
    "wwwWbbmmbb",
    "wwwWbfmfbb",
    ".wwWbbbbbb",
    "..cWbkbbbb",
    "...cbbbbbb",
    "...cbb..bb",
    "...cc...cc",
    "..ccc...cc",
  ]);
}
function maouPal() {
  return {
    w:"#7a2340", W:"#3a0d1e", b:"#8a2038", d:"#5a1526", k:"#3a0d1a",
    h:"#e8c66a", e:"#ff3020", m:"#160208", f:"#ffffff", c:"#e8c66a",
  };
}

// --- 勇者（正面・剣） ---
function heroGrid() {
  return [
    "...hhhhhh...",
    "..hhhhhhhh..",
    "..hssssssh..",
    "..ssessess..",
    "..ssssssss..",
    "...ssssss...",
    "..gtttttt...",
    ".Gatttttta..",
    ".Ma tttt a..",
    ".m.tttttt...",
    "...tttttt...",
    "...pp..pp...",
    "...pp..pp...",
    "...pp..pp...",
    "..bb....bb..",
    "..bb....bb..",
  ];
}
function heroPal() {
  return {
    h:"#7a4b22", s:"#f4cfa2", e:"#20120a", t:"#2f74d8",
    a:"#f4cfa2", p:"#39406e", b:"#5a3210",
    g:"#d8a828", G:"#e8c840", M:"#d8dae8", m:"#b8bad0",
  };
}
// 仲間（マップ用・色替え）：チュニックと髪の色だけ差し替えたパレットを返す
function heroPalAlt(tunic, hair) {
  const p = heroPal(); p.t = tunic; p.h = hair; return p;
}

// --- 王様の顔（ポートレート） ---
function kingGrid() {
  return [
    "...g.g.g....",
    "..gggggggg..",
    "..gjgjgjgg..",
    "...ssssss...",
    "..ssssssss..",
    "..ssessess..",
    "..ssssssss..",
    "..swwwwwws..",
    "..wwwwwwww..",
    "..wwwwwwww..",
    "...wwwwww...",
    "..rrrrrrrr..",
  ];
}
function kingPal() {
  return { g:"#f2c22a", j:"#e03050", s:"#f4cfa2", e:"#20120a", w:"#eef0f5", r:"#b02f2f" };
}
