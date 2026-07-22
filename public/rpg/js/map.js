"use strict";
/* ============================================================
   map.js  マップ（フィールド）の描画・勇者の移動・お店
   ============================================================ */

/* ============================================================
   マップ背景の描画
   ============================================================ */
// エリアのテーマ（草原・港・村・洞窟・城）に応じてマップ背景をCanvasに描く
function drawMapBackground(theme) {
  const cv = el.mapCanvas, ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height, T = 10; // タイル1マスのサイズ(px)
  const cols = Math.ceil(W / T), rows = Math.ceil(H / T);
  // テーマ配色（base/base2:地面のまだら模様、tuft:草地の穂先や鉱石のきらめき、coast:水際の渚、water:水の色、floor:地面の描き方）
  const themes = {
    grass:  { base:"#43923a", base2:"#317029", tuft:"#74c85a", coast:"#e0cd8a", water:"#2b64bf", floor:"grass" },
    port:   { base:"#43923a", base2:"#317029", tuft:"#74c85a", coast:"#e0cd8a", water:"#2b64bf", floor:"grass" },
    village:{ base:"#4f9a40", base2:"#3a7530", tuft:"#82cf68", coast:"#e0cd8a", water:"#2b64bf", floor:"grass" },
    cave:   { base:"#241f34", base2:"#171225", tuft:"#5a4a8a", coast:null,      water:null,        floor:"rock" },
    castle: { base:"#5a4a62", base2:"#463a4e", tuft:"#7a6a82", coast:null,      water:null,        floor:"stone" },
  };
  const th = themes[theme] || themes.grass;

  if (th.floor === "stone") {
    // 石畳：大きめの正方形タイルを交互の色でならべ、目地の線を引く
    const tile = 24;
    for (let y = 0; y < H; y += tile) {
      for (let x = 0; x < W; x += tile) {
        ctx.fillStyle = ((Math.floor(x/tile) + Math.floor(y/tile)) % 2 === 0) ? th.base : th.base2;
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += tile) { ctx.beginPath(); ctx.moveTo(x+.5,0); ctx.lineTo(x+.5,H); ctx.stroke(); }
    for (let y = 0; y <= H; y += tile) { ctx.beginPath(); ctx.moveTo(0,y+.5); ctx.lineTo(W,y+.5); ctx.stroke(); }
    // 石のかすれた光沢を少しだけ乗せる
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = "rgba(255,255,255,.05)";
      ctx.fillRect(Math.random()*W, Math.random()*H, 6, 2);
    }
  } else {
    // 草地・岩場：低い周波数のsin波を重ねた疑似ノイズで、数タイルにまたがる大きめの「まだら」模様を作る
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const n = Math.sin(x*0.10 + y*0.22) + Math.sin(x*0.16 - y*0.07)*0.8 + Math.sin(x*0.05 + y*0.13 + 2)*0.6;
        ctx.fillStyle = n > 0.55 ? th.base2 : th.base;
        ctx.fillRect(x*T, y*T, T, T);
      }
    }
    // 草の穂先・鉱石のきらめきを小さな点でランダムに散らす
    const tuftCount = Math.floor(cols * rows * 0.5);
    for (let i = 0; i < tuftCount; i++) {
      ctx.globalAlpha = 0.35 + Math.random()*0.4;
      ctx.fillStyle = th.tuft;
      ctx.fillRect(Math.random()*W, Math.random()*H, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // 水辺（草地系のみ）：波打ち際に渚の縁を挟んで、上下に川・海を配置する
  if (th.water) {
    const waterH = 16;
    const drawShore = (top) => {
      for (let x = 0; x < cols; x++) {
        const bump = (Math.sin(x*0.7 + (top?0:2)) + 1) / 2 * 4; // 0〜4pxで縁を波打たせる
        const wy = top ? 0 : H - waterH - bump;
        ctx.fillStyle = th.water;
        ctx.fillRect(x*T, wy, T, waterH + bump);
        ctx.fillStyle = th.coast;
        ctx.fillRect(x*T, top ? waterH + bump : wy - 3, T, 3);
      }
    };
    drawShore(true); drawShore(false);
    // 波のハイライト線
    ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 6) {
      const y = 6 + Math.sin(x*0.2)*2;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  /* ---- 装飾オブジェクトの描画関数（px,pyは基準点の座標） ---- */
  // 1本の木（丸い樹冠＋陰影＋幹）
  function tree(px, py, scale) {
    const s = scale || 1;
    ctx.fillStyle = "#3a2410"; ctx.fillRect(px+6*s, py+12*s, 4*s, 7*s); // 幹
    ctx.fillStyle = "#16471a"; ctx.beginPath(); ctx.arc(px+8*s, py+8*s, 9*s, 0, Math.PI*2); ctx.fill(); // 影側の葉
    ctx.fillStyle = "#256b26"; ctx.beginPath(); ctx.arc(px+6*s, py+6*s, 7*s, 0, Math.PI*2); ctx.fill(); // 本体の葉
    ctx.fillStyle = "#4fa048"; ctx.beginPath(); ctx.arc(px+4*s, py+4*s, 3.4*s, 0, Math.PI*2); ctx.fill(); // 陽の当たるハイライト
  }
  // 木を密集させた「森」（参考画像のような大きな緑のかたまりにする）
  function forest(px, py, w, h) {
    const step = 11;
    // まず全体にやや暗い緑の下地を敷いて、まとまりのある森に見せる
    ctx.fillStyle = "rgba(14,58,20,0.55)";
    ctx.fillRect(px - 2, py - 2, w + 8, h + 10);
    // 奥→手前の順に木を少しずつずらして重ね描きする
    for (let ry = 0; ry < h; ry += step) {
      for (let rx = 0; rx < w; rx += step) {
        const jx = (Math.sin(rx*1.7 + ry) * 2);
        const jy = (Math.cos(rx + ry*1.3) * 2);
        tree(px + rx + jx, py + ry + jy, 0.9);
      }
    }
  }
  // 雪をかぶった1つの山
  function mountain(px, py, w, h) {
    w = w || 22; h = h || 20;
    const grad = ctx.createLinearGradient(px, py, px, py+h);
    grad.addColorStop(0, "#9a9aa6"); grad.addColorStop(1, "#565663");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(px+w/2, py); ctx.lineTo(px+w, py+h); ctx.lineTo(px, py+h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.22)"; // 影になる右斜面
    ctx.beginPath(); ctx.moveTo(px+w/2, py); ctx.lineTo(px+w, py+h); ctx.lineTo(px+w/2, py+h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#eef2fb"; // 雪をかぶった頂上
    ctx.beginPath(); ctx.moveTo(px+w/2, py); ctx.lineTo(px+w/2+5, py+h*0.4); ctx.lineTo(px+w/2-5, py+h*0.4); ctx.closePath(); ctx.fill();
  }
  // 山脈（大きさ違いの山を重ねて連なりに見せる）
  function mountainRange(px, py) {
    mountain(px+24, py+6, 26, 22);
    mountain(px+50, py+3, 30, 26);
    mountain(px, py+10, 22, 18);
    mountain(px+78, py+8, 24, 20);
  }
  // 城（塔・旗・門つき）
  function castle(px, py) {
    const grad = ctx.createLinearGradient(px, py, px, py+22);
    grad.addColorStop(0, "#9c9ca8"); grad.addColorStop(1, "#68687a");
    ctx.fillStyle = grad;
    ctx.fillRect(px, py+6, 26, 16);
    ctx.fillRect(px+2, py, 4, 8); ctx.fillRect(px+11, py, 4, 10); ctx.fillRect(px+20, py, 4, 8);
    ctx.fillStyle = "#2e2038"; ctx.fillRect(px+10, py+12, 6, 10); // 入り口
    ctx.fillStyle = "#f2d030"; ctx.fillRect(px+12, py+2, 2, 3); // 灯りのともる窓
    ctx.fillStyle = "#d8394a"; // 旗
    ctx.fillRect(px+12, py-5, 1, 6);
    ctx.beginPath(); ctx.moveTo(px+13, py-5); ctx.lineTo(px+19, py-2); ctx.lineTo(px+13, py+1); ctx.closePath(); ctx.fill();
  }
  // 民家（壁・三角屋根・扉・灯りの窓）
  function house(px, py) {
    ctx.fillStyle = "#b06a3a"; ctx.fillRect(px, py+6, 18, 12); // 壁
    ctx.fillStyle = "#8a2a2a"; ctx.beginPath(); ctx.moveTo(px-1, py+7); ctx.lineTo(px+9, py); ctx.lineTo(px+19, py+7); ctx.closePath(); ctx.fill(); // 屋根
    ctx.fillStyle = "#3a2a1a"; ctx.fillRect(px+7, py+11, 4, 7); // 扉
    ctx.fillStyle = "#ffe07a"; ctx.fillRect(px+2, py+9, 3, 3); ctx.fillRect(px+13, py+9, 3, 3); // 灯りのともる窓
  }
  // 桟橋（港の木の橋）
  function dock(px, py) {
    ctx.fillStyle = "#7a5a30"; ctx.fillRect(px, py, 22, 6);
    for (let i = 0; i < 5; i++) { ctx.fillRect(px+i*5, py, 2, 10); }
  }

  // テーマごとに配置する装飾オブジェクトを切り替える
  if (theme === "cave") {
    mountain(40,60); mountain(250,50); mountain(150,150); mountain(300,150);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0,0,W,H); // 洞窟らしい暗さを全体に重ねる
    ctx.fillStyle = "#f2c744"; // たいまつの灯り
    ctx.fillRect(70,120,2,8); ctx.fillRect(290,120,2,8);
    ctx.fillStyle = "rgba(242,199,68,.25)";
    ctx.beginPath(); ctx.arc(71,120,10,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(291,120,10,0,Math.PI*2); ctx.fill();
  } else if (theme === "castle") {
    castle(160, 40);
    mountain(30,150); mountain(300,150);
  } else if (theme === "port") {
    forest(20, 50, 40, 34);
    house(60,60); house(250,70); house(300,120);
    dock(150,170);
    ctx.fillStyle = th.water; ctx.fillRect(120,150,120,80); // 港の水
    ctx.fillStyle = th.coast; ctx.fillRect(118,148,124,3);
  } else if (theme === "village") {
    house(70,70); house(140,55); house(220,80); house(90,140); house(260,130);
    forest(290, 30, 34, 30);
    mountain(300,150);
  } else {
    // 草原（はじまりの草原）：森のかたまり＋山脈＋遠くの城で参考画像の世界地図に寄せる
    forest(40, 46, 46, 40);
    forest(96, 120, 40, 34);
    mountainRange(150, 30);
    tree(300, 70); tree(316, 96);
    castle(290, 150);
  }
}

/* ============================================================
   勇者マーカー（マップ上を実際に動く）
   ============================================================ */
// 現在のmapPos座標にあわせて、マップ上の勇者マーカーの表示位置と向きを更新する
function placeHeroMarker() {
  el.mapHero.style.left = (mapPos.x / 360 * 100) + "%";
  el.mapHero.style.top = (mapPos.y / 230 * 100) + "%";
  // facingLeftがtrueなら左向きに反転表示する
  el.mapHero.style.transform = `translate(-50%,-88%) scaleX(${facingLeft ? -1 : 1})`;
}

/* ============================================================
   ホットスポット（出口・お店・ボス）
   ============================================================ */
// エリアのホットスポット（出口・お店・ボスなど）をマップ上にアイコンとして並べる
function renderHotspots(list) {
  el.hotspotLayer.innerHTML = "";
  list.forEach(hs => {
    const d = document.createElement("div");
    d.className = "hotspot";
    d.style.left = (hs.x / 360 * 100) + "%";
    d.style.top = (hs.y / 230 * 100) + "%";
    d.innerHTML = `<span class="icon">${hs.icon}</span><span class="label">${hs.label}</span>`;
    // ホットスポットをクリックすると、そこまで歩いて移動し、到着後にhs.actionを実行する
    d.addEventListener("click", (e) => {
      if (msgMode) return;
      e.stopPropagation();
      setMapTarget(hs.x, hs.y, hs.action);
    });
    el.hotspotLayer.appendChild(d);
  });
}

/* ============================================================
   移動エンジン
   ============================================================ */
// 移動先座標(x,y)をセットし、まだ移動アニメーションが動いていなければ開始する
// onArrive: 目的地に到着したときに呼ぶコールバック（お店を開く・戦闘開始など）
function setMapTarget(x, y, onArrive) {
  mapTarget = { x, y, onArrive: onArrive || null };
  if (!mapMoving) {
    mapMoving = true;
    mapAnimHandle = requestAnimationFrame(stepMove);
  }
}
// requestAnimationFrameで毎フレーム呼ばれ、勇者を目的地に向かって少しずつ移動させる
function stepMove(ts) {
  if (!mapMoving || !mapTarget) { mapAnimHandle = null; stepLast = null; return; }
  if (stepLast == null) stepLast = ts;
  const dt = Math.min(0.05, (ts - stepLast) / 1000); // 前フレームからの経過秒数（上限0.05秒でタブ切替時の飛びを防ぐ）
  stepLast = ts;
  const dx = mapTarget.x - mapPos.x, dy = mapTarget.y - mapPos.y;
  const dist = Math.hypot(dx, dy); // 目的地までの直線距離
  const speed = 130; // 移動速度（px/秒）
  if (dist < 2.5) {
    // 目的地にほぼ到着したのでピタリと座標を合わせて移動を終了する
    mapPos.x = mapTarget.x; mapPos.y = mapTarget.y;
    placeHeroMarker();
    const arrive = mapTarget.onArrive;
    mapMoving = false; mapTarget = null; mapAnimHandle = null; stepLast = null;
    if (arrive) arrive();
    return;
  }
  // 今回のフレームで進む距離を計算し、目的地方向へ按分して座標を更新する
  const travel = speed * dt;
  const ratio = Math.min(1, travel / dist);
  mapPos.x += dx * ratio; mapPos.y += dy * ratio;
  if (dx < -0.5) facingLeft = true; else if (dx > 0.5) facingLeft = false; // 左右移動の向きに合わせて勇者の画像を反転
  placeHeroMarker();
  walkedDist += travel;
  // エンカウントのある場所（草むらなど）では、一定距離ごとにランダムで敵と遭遇するか判定する
  if (currentArea.walk.encounterEnemy != null && walkedDist > 34) {
    walkedDist = 0;
    if (Math.random() < currentArea.walk.encounterRate) {
      lastMapPos[enemyIndex] = { ...mapPos }; // 戦闘後に同じ場所へ戻れるよう座標を保存
      mapMoving = false; mapTarget = null; mapAnimHandle = null; stepLast = null;
      startBattle(currentArea.walk.encounterEnemy);
      return;
    }
  }
  mapAnimHandle = requestAnimationFrame(stepMove); // まだ到着していないので次のフレームも継続
}
// 地面クリックで移動（クリック位置をCanvas内の座標系に変換し、エリア境界内に収めてから移動先にする）
el.mapCanvas.addEventListener("click", (e) => {
  if (msgMode || !currentArea) return;
  const rect = el.mapCanvas.getBoundingClientRect();
  let x = (e.clientX - rect.left) / rect.width * 360;
  let y = (e.clientY - rect.top) / rect.height * 230;
  const b = currentArea.walk.bounds;
  x = Math.min(Math.max(x, b.x0), b.x1);
  y = Math.min(Math.max(y, b.y0), b.y1);
  setMapTarget(x, y, null);
});

/* ============================================================
   エリア突入・移動再開
   ============================================================ */
// 指定したインデックスのエリアのマップ画面に切り替える
// keepPos: trueなら戦闘/お店から戻ったときの座標を復元し、falseなら開始位置からスタートする
function enterAreaMap(index, keepPos) {
  enemyIndex = index;
  currentArea = ENEMIES[index];
  showView("map");
  el.battleView.classList.remove("boss");
  drawMapBackground(currentArea.mapTheme);
  el.areaLabel.textContent = currentArea.area;
  el.goldMap.textContent = player.gold;
  mapPos = (keepPos && lastMapPos[index]) ? { ...lastMapPos[index] } : { ...currentArea.walk.start };
  facingLeft = false;
  placeHeroMarker();
  renderHotspots(currentArea.walk.hotspots);
  mapMoving = false; mapTarget = null; walkedDist = 0; stepLast = null;
  setPortrait(null);
  resumeRoam();
}
// マップ探索中のガイドメッセージとコマンド欄を表示する（お店を出た後や戦闘勝利後などに呼ばれる）
function resumeRoam() {
  clearMenu();

  renderMenu([
    {
      label: "地図を クリックして すすもう",
      disabled: true
    },

    {
      label: "スキルを かくにん",
      onClick: showSkillList
    },

    {
      label: "💾 ぼうけんを 中断する",
      cls: "suspend",
      onClick: suspendAdventure
    }
  ]);

  msgMode = false;
  el.advance.classList.remove("show");

  el.msgText.innerHTML = currentArea.boss
    ? `
      <span class="cat">
        ${currentArea.area}
      </span><br>
      不気味な 気配が する…
    `
    : `
      <span class="cat">
        ${currentArea.area}
      </span><br>
      どこへ いく？
    `;
}

// つぎのエリアへ移動するメッセージを表示してからマップを切り替える
function goExit(nextIndex) {
  say([`つぎの まちへ 出発した…`], () => enterAreaMap(nextIndex, false));
}

/* ============================================================
   お店（やどや／どうぐ屋）
   ============================================================ */
// やどやのダイアログ（20Gでとまり全回復する）
function openInnDialog() {
  clearMenu();
  el.msgText.innerHTML = `やどやに とまりますか？<span class="cat">(20G・全回復)</span>`;
  renderMenu([
    { label:"とまる", sub:"20G", onClick: () => {
        if (player.gold < 20) { say([`ゴールドが たりない…`], resumeRoam); return; }
        player.gold -= 20; player.hp = player.maxHp; player.mp = player.maxMp;
        updateStatus();
        say([`やどやに とまった。<br>HPとMPが 全回復した！`], resumeRoam);
      } },
    { label:"やめる", onClick: resumeRoam },
  ]);
}
// どうぐ屋のダイアログ（15Gでやくそうを購入できる）
function openItemShopDialog() {
  clearMenu();
  el.msgText.innerHTML = `どうぐ屋へ ようこそ！`;
  renderMenu([
    { label:"やくそうを かう", sub:"15G", onClick: () => {
        if (player.gold < 15) { say([`ゴールドが たりない…`], resumeRoam); return; }
        player.gold -= 15; player.potions++;
        updateStatus();
        say([`やくそうを かった！<br>のこり ${player.potions}こ`], resumeRoam);
      } },
    { label:"やめる", onClick: resumeRoam },
  ]);
}
