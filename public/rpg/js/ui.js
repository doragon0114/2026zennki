"use strict";
/* ============================================================
   ui.js  メッセージ送り・顔グラ・コマンドメニュー・ビュー切替・ダメージ表示
   （画面下のウィンドウまわりの共通UIを担当）
   ============================================================ */

/* ---- メッセージ（クリックで送り） ---- */
// メッセージ（複数行可）を1行ずつ表示するキューにセットし、最初の1行を表示する
// lines: 1行の文字列 or 複数行の配列／done: 全行を表示し終えたあとに呼ばれるコールバック
function say(lines, done) {
  msgQueue = Array.isArray(lines) ? lines.slice() : [lines];
  msgDone = done || null;
  msgMode = true;
  showCommands(false);
  nextLine();
}
// キューの先頭から1行取り出して表示する。キューが空なら送り待ちを解除しdoneを呼ぶ
function nextLine() {
  if (msgQueue.length === 0) {
    msgMode = false;
    el.advance.classList.remove("show");
    const d = msgDone; msgDone = null;
    if (d) d();
    return;
  }
  el.msgText.innerHTML = msgQueue.shift();
  el.advance.classList.add("show");
}
// クリックでメッセージ送り（オーバーレイのボタン上のクリックは除外する）
el.game.addEventListener("click", (e) => {
  if (!msgMode) return;
  if (e.target.closest(".overlay")) return;
  nextLine();
});

// メッセージウィンドウ左の顔グラフィックを切り替える（"king"=王様の顔／それ以外=非表示）
function setPortrait(kind) {
  if (kind === "king") {
    el.portrait.classList.add("show");
    drawCharacter(el.portrait, "king", kingGrid(), kingPal());
  } else {
    el.portrait.classList.remove("show");
  }
}

/* ---- コマンド／選択肢 ---- */
function showCommands(on) { /* コマンドの有効/無効はリスト再構築で制御 */ }

// コマンドウィンドウにメニュー項目を並べて描画する
function renderMenu(items) {
  // items: [{label, sub, cls, onClick, disabled}]
  el.cmdList.innerHTML = "";
  items.forEach(it => {
    const d = document.createElement("div");
    d.className = "item" + (it.cls ? " " + it.cls : "");
    d.innerHTML = it.label + (it.sub ? ` <span class="sub">${it.sub}</span>` : "");
    if (!it.disabled) {
      // クリックしても親要素（マップのクリック移動など）に伝播しないようにする
      d.addEventListener("click", (e) => { e.stopPropagation(); it.onClick(); });
    } else {
      d.classList.add("disabled");
    }
    el.cmdList.appendChild(d);
  });
}
// コマンドウィンドウの中身を空にする
function clearMenu() { el.cmdList.innerHTML = ""; }

/* ---- ビュー切替（戦闘 / マップ） ---- */
function showView(name) {
  el.battleView.classList.toggle("active", name === "battle");
  el.mapView.classList.toggle("active", name === "map");
}

/* ---- ダメージ／回復のポップアップ ---- */
// anchorEl（敵 or 勇者の表示位置）の近くにダメージ／回復量の数字をポップアップ表示し、1秒後に消す
// heal: trueなら回復量として緑色で表示する
function showDamage(anchorEl, text, heal) {
  const pop = document.createElement("div");
  pop.className = "damage-pop" + (heal ? " heal" : "");
  pop.textContent = text;
  const sceneRect = el.scene.getBoundingClientRect();
  const aRect = anchorEl.getBoundingClientRect();
  // シーン内での相対座標に変換し、横方向に少しランダムなブレを加える
  pop.style.left = (aRect.left - sceneRect.left + aRect.width/2 - 16 + (Math.random()*20-10)) + "px";
  pop.style.top = (aRect.top - sceneRect.top + aRect.height/3) + "px";
  el.scene.appendChild(pop);
  setTimeout(() => pop.remove(), 1000);
}
