"use strict";
/* ============================================================
   battle.js  戦闘背景の描画 ＋ 戦闘システム
   ============================================================ */

/* ============================================================
   戦闘背景（洞窟）の描画
   ============================================================ */
// たたかいの背景を洞窟風に描く。boss=true のときは赤紫の魔王城テイストに切り替える
function drawBattleBackground(boss) {
  const cv = el.battleBg, ctx = cv.getContext("2d");
  const W = cv.width, H = cv.height;
  ctx.imageSmoothingEnabled = true; // 岩や霧はなめらかに描く
  ctx.clearRect(0, 0, W, H);

  // 通常（洞窟の青緑）／ボス（魔王城の赤紫）で配色を切り替える
  const p = boss ? {
    sky1:"#3a1030", sky2:"#1a0818", sky3:"#070204",
    rock:"#2a1122", rockHi:"#4a2440", rockLo:"#140510",
    floor:"#1c0a18", floorHi:"#3a1d33", beam:"rgba(220,120,180,0.05)",
    glow:"rgba(150,40,90,0.18)",
  } : {
    sky1:"#173a50", sky2:"#0a1d2d", sky3:"#030b13",
    rock:"#173340", rockHi:"#2b5566", rockLo:"#0a1a24",
    floor:"#0e2029", floorHi:"#245262", beam:"rgba(150,205,235,0.05)",
    glow:"rgba(60,140,180,0.16)",
  };

  // 1) 奥行きのある大気グラデーション（下の方＝奥がぼんやり明るい）
  const g = ctx.createRadialGradient(W/2, H*1.28, H*0.15, W/2, H*1.28, H*1.35);
  g.addColorStop(0, p.sky1); g.addColorStop(0.55, p.sky2); g.addColorStop(1, p.sky3);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 2) 天井のすき間から差し込む光の柱（3本）
  [0.22, 0.5, 0.76].forEach((fx) => {
    const x = W * fx;
    const lg = ctx.createLinearGradient(0, 0, 0, H * 0.82);
    lg.addColorStop(0, p.beam); lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(x - 10, 0); ctx.lineTo(x + 10, 0);
    ctx.lineTo(x + 34, H * 0.82); ctx.lineTo(x - 34, H * 0.82);
    ctx.closePath(); ctx.fill();
  });

  // 3) 左右の岩壁（内側をギザギザにした岩の柱）
  function wall(side) { // side: -1=左, 1=右
    const wd = W * 0.15;
    const outerX = side < 0 ? 0 : W;
    const dir = side < 0 ? 1 : -1;
    const grad = ctx.createLinearGradient(outerX, 0, outerX + dir * wd, 0);
    grad.addColorStop(0, p.rockLo); grad.addColorStop(1, p.rock);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(outerX, 0);
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const yy = H * i / steps;
      // sinで内側の輪郭を岩っぽく波打たせる
      const jut = wd * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + side * 2)));
      ctx.lineTo(outerX + dir * jut, yy);
    }
    ctx.lineTo(outerX, H);
    ctx.closePath(); ctx.fill();
    // 内側の縁に薄いハイライトを入れて立体感を出す
    ctx.strokeStyle = p.rockHi; ctx.lineWidth = 2; ctx.globalAlpha = 0.35;
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  wall(-1); wall(1);

  // 4) 天井の岩盤（下端をギザギザに）
  const ceilH = H * 0.14;
  ctx.fillStyle = p.rockLo;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(W, 0); ctx.lineTo(W, ceilH);
  const cseg = W / 16;
  let ct = 0;
  for (let sx = W; sx >= -cseg; sx -= cseg) {
    ctx.lineTo(sx, ceilH + (ct % 2 ? cseg * 0.45 : -cseg * 0.1));
    ct++;
  }
  ctx.lineTo(0, ceilH); ctx.closePath(); ctx.fill();

  // 5) 鍾乳石（天井から下がる三角）
  const stal = [
    {x:0.1,w:20,h:42},{x:0.22,w:13,h:26},{x:0.35,w:17,h:56},{x:0.46,w:11,h:30},
    {x:0.57,w:19,h:48},{x:0.68,w:13,h:34},{x:0.8,w:22,h:52},{x:0.9,w:15,h:36},
  ];
  stal.forEach(s => {
    const sx = W * s.x, topY = ceilH - 4;
    const grad = ctx.createLinearGradient(0, topY, 0, topY + s.h);
    grad.addColorStop(0, p.rockHi); grad.addColorStop(1, p.rockLo);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(sx - s.w/2, topY); ctx.lineTo(sx + s.w/2, topY); ctx.lineTo(sx, topY + s.h);
    ctx.closePath(); ctx.fill();
  });

  // 6) 岩の床（上端をギザギザにし、上面をやや明るく）
  const floorY = H * 0.74;
  const fg = ctx.createLinearGradient(0, floorY, 0, H);
  fg.addColorStop(0, p.floorHi); fg.addColorStop(0.14, p.floor); fg.addColorStop(1, p.sky3);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(0, H); ctx.lineTo(0, floorY);
  const fseg = W / 20;
  let ft = 0;
  for (let sx = 0; sx <= W + fseg; sx += fseg) {
    ctx.lineTo(sx, floorY + (ft % 2 ? 5 : -5));
    ft++;
  }
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

  // 7) 床に転がる小石（毎バトルで散らばりが変わる）
  for (let i = 0; i < 46; i++) {
    ctx.globalAlpha = 0.12 + Math.random() * 0.22;
    ctx.fillStyle = p.floorHi;
    ctx.fillRect(Math.random() * W, floorY + 6 + Math.random() * (H - floorY - 6), 3, 2);
  }
  ctx.globalAlpha = 1;

  // 8) 中央奥のほのかな光（被写体が浮き上がるように）
  const gl = ctx.createRadialGradient(W/2, H*0.62, 4, W/2, H*0.62, W*0.5);
  gl.addColorStop(0, p.glow); gl.addColorStop(1, "transparent");
  ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
}

/* ============================================================
   戦闘
   ============================================================ */
// 指定インデックスの敵との戦闘を開始する（マップからのエンカウント・ボスとの戦闘の両方で使う）
function startBattle(index) {
  enemyIndex = index;
  const def = ENEMIES[index]; // ENEMIESに定義された敵の基本データ
  // 戦闘中に変化するHPなどを持つ、その場限りの敵インスタンスを作る
  enemy = { def, name:def.name, hp:def.hp, max:def.hp, atk:def.atk,
            exp:def.exp, gold:def.gold, cats:def.cats, boss:def.boss };
  showView("battle");
  el.battleView.classList.toggle("boss", def.boss);
  drawBattleBackground(def.boss); // 洞窟／魔王城の戦闘背景を描く
  beginQuestionSet(); // この戦闘を「1問題セット」としてスコア集計を開始する
  el.enemyWrap.style.display = "block";
  el.heroWrap.style.display = "flex";
  el.enemyWrap.style.opacity = "1";
  // 敵ごとの表示枠サイズを反映する（未指定なら240×240。魔王など大きく見せたい敵はdataでsizeを指定）
  const size = def.size || { w: 240, h: 240 };
  el.enemyCanvas.width = size.w;
  el.enemyCanvas.height = size.h;
  def.draw(el.enemyCanvas);
  drawCharacter(el.heroCanvas, "hero", heroGrid(), heroPal());
  el.enemyName.textContent = def.name;
  updateEnemyHp();
  updateStatus();
  clearMenu();

  const intro = def.boss
    ? `<b class="gold">${def.name}</b> が たちはだかった！`
    : `<b>${def.name}</b> が あらわれた！`;
  say([intro], playerTurn);
}

// 勇者のターンを開始し、「たたかう／まほう／どうぐ／にげる」のコマンドを表示する
function playerTurn() {
  el.msgText.innerHTML = `勇者アレンの ターン！`;
  msgMode = false; el.advance.classList.remove("show");
  setPortrait(null);
  renderMenu([
    { label:"たたかう", onClick: cmdFight },
    { label:"まほう", sub:"MP3", onClick: cmdMagic },
    { label:"どうぐ", onClick: cmdItem },
    { label:"にげる", onClick: cmdRun },
  ]);
}

// 敵の対応教科(cats)から問題を1問出題し、選択肢をコマンド欄に並べる
// prefix: 問題文の前に付ける文言（「メラを となえた！」など）／onAnswer: 選んだ選択肢のインデックスを受け取るコールバック
function askQuestion(prefix, onAnswer) {
  currentQuestion = pickQuestion(enemy.cats);
  currentQuestion.removed = new Set(); // 「たくけずり」で消した選択肢のインデックス
  currentQuestion.chipUsed = false;    // たくけずりは1問につき1回まで
  currentQuestion.showExp = false;     // 「さきよみの書」で解説を表示中か
  renderQuestion(prefix, onAnswer);
}

// 出題画面（問題文＋選択肢＋スキルボタン）を描画する。スキル使用後の再描画にも使う
function renderQuestion(prefix, onAnswer) {
  const cq = currentQuestion;
  let html = `${prefix}<span class="cat">[${CAT_NAME[cq.cat]}]</span> <span class="q">${cq.q}</span>`;
  if (cq.showExp && cq.exp) {
    // さきよみの書：解説を表示（正解の単語は？？？に伏せ字）
    html += `<br><span class="cat">📖 ${maskAnswer(cq.exp, cq.c[cq.a])}</span>`;
  }
  el.msgText.innerHTML = html;
  msgMode = false; el.advance.classList.remove("show");

  const items = [];
  // 選択肢（たくけずりで消されたものは表示しない）
  cq.c.forEach((choice, i) => {
    if (cq.removed.has(i)) return;
    items.push({ label: choice, onClick: () => { clearMenu(); onAnswer(i); } });
  });
  // スキルボタンは、つかえない状態（未修得・回数切れ・この問題で使用済み）でも
  // グレーアウトして常に表示しておく（どんなスキルがあるかプレイヤーに見せるため）
  const sk = player.skills;

  // スキルボタン：たくけずり（不正解の選択肢をランダムに消す）
  const chipUsable = sk.chip && sk.chip.uses > 0 && !cq.chipUsed;
  items.push({
    label:`🔮 たくけずり`,
    sub: !sk.chip ? `みしゅうとく`
       : cq.chipUsed ? `この問題では使用ずみ`
       : sk.chip.uses <= 0 ? `のこり0回`
       : `のこり${sk.chip.uses}回`,
    cls:"skill",
    disabled: !chipUsable,
    onClick: () => {
      sk.chip.uses--;
      cq.chipUsed = true;
      const removeN = sk.chip.level >= 2 ? 2 : 1; // Lv1:1個消す(→3択) / Lv2:2個消す(→2択)
      const wrongs = cq.c.map((_, i) => i).filter(i => i !== cq.a && !cq.removed.has(i));
      for (let k = 0; k < removeN && wrongs.length > 1; k++) {
        const idx = Math.floor(Math.random() * wrongs.length);
        cq.removed.add(wrongs[idx]);
        wrongs.splice(idx, 1);
      }
      saveProgress();
      renderQuestion(prefix, onAnswer);
    },
  });

  // スキルボタン：さきよみの書（解答前に解説を見る）
  const insightUsable = sk.insight && sk.insight.uses > 0 && !cq.showExp && !!cq.exp;
  items.push({
    label:`📖 さきよみの書`,
    sub: !sk.insight ? `みしゅうとく`
       : cq.showExp ? `ひょうじちゅう`
       : sk.insight.uses <= 0 ? `のこり0回`
       : !cq.exp ? `この問題は解説なし`
       : `のこり${sk.insight.uses}回`,
    cls:"skill",
    disabled: !insightUsable,
    onClick: () => {
      sk.insight.uses--;
      cq.showExp = true;
      saveProgress();
      renderQuestion(prefix, onAnswer);
    },
  });

  renderMenu(items);
}

// 不正解時のスコア表示行を作る（スコアガード発動時はその旨も表示）
function missScoreLine(r) {
  return r.guarded
    ? `<span class="cat">🛡 スコアガードが はつどう！ スコア +${r.gain}</span>`
    : `<span class="cat">スコア +0…</span>`;
}

// たたかう：問題に正解すればダメージ（22%の確率で会心の一撃＝ダメージ倍増）、不正解なら攻撃失敗して敵のターンへ
function cmdFight() {
  askQuestion("", (i) => {
    const ok = i === currentQuestion.a;
    const r = recordAnswer(ok); // 正誤をスコアに記録する
    if (ok) {
      const crit = Math.random() < 0.22;
      let dmg = player.atk + Math.floor(Math.random()*4) + (crit ? player.atk : 0);
      hitEnemy(dmg, crit ? "critical" : "hit", r);
    } else {
      const ans = currentQuestion.c[currentQuestion.a];
      say([
        `ざんねん！ こうげきは しっぱい…`,
        `<span class="cat">正解は「${ans}」だった。</span><br>${missScoreLine(r)}`,
      ], enemyTurn);
    }
  });
}

// まほう：MPを3消費して「メラ」を唱える。正解すればたたかうより威力の高いダメージを与える
// まほうの選択欄を開く。となえられるのは「メラ」だけで、
// まほうスキル（たくけずり等）は一覧に表示するだけで選べない
// （たくけずり・さきよみの書は問題中に、スコアガードは自動で、れんぞくブーストは常時はたらく）
function cmdMagic() {
  clearMenu();
  el.msgText.innerHTML = `どの まほうを つかう？`;
  msgMode = false; el.advance.classList.remove("show");
  const s = player.skills;
  renderMenu([
    { label:"メラ", sub:"MP3", onClick: castMera },
    { label:"🔮 たくけずり",       cls:"skill", disabled:true,
      sub: s.chip    ? `もんだい中に使用（のこり${s.chip.uses}回）` : `みしゅうとく` },
    { label:"📖 さきよみの書",     cls:"skill", disabled:true,
      sub: s.insight ? `もんだい中に使用（のこり${s.insight.uses}回）` : `みしゅうとく` },
    { label:"🛡 スコアガード",     cls:"skill", disabled:true,
      sub: s.guard   ? `ミス時に自動発動（のこり${s.guard.uses}回）` : `みしゅうとく` },
    { label:"🔥 れんぞくブースト", cls:"skill", disabled:true,
      sub: s.streak  ? `${s.streak.need}連続正解で スコア+${s.streak.rate}%` : `みしゅうとく` },
    { label:"もどる", onClick: playerTurn },
  ]);
}

// メラをとなえる（MP3消費して問題に挑戦。正解なら強めのダメージ）
function castMera() {
  if (player.mp < 3) { say([`MPが たりない！`], playerTurn); return; }
  player.mp -= 3; updateStatus();
  askQuestion(`<b class="blue">メラを となえた！</b> `, (i) => {
    const ok = i === currentQuestion.a;
    const r = recordAnswer(ok); // 正誤をスコアに記録する
    if (ok) {
      let dmg = Math.floor(player.atk * 1.9) + Math.floor(Math.random()*6) + 4;
      hitEnemy(dmg, "magic", r);
    } else {
      const ans = currentQuestion.c[currentQuestion.a];
      say([`じゅもんは ふきとんだ…<br><span class="cat">正解は「${ans}」。</span><br>${missScoreLine(r)}`], enemyTurn);
    }
  });
}

// 敵にdmgのダメージを与え、演出（点滅・シェイク・ダメージ数字）を再生してからメッセージを表示する
// kind: "hit"（通常攻撃）／"critical"（会心の一撃）／"magic"（魔法）で演出とメッセージ文言を出し分ける
// score: recordAnswerの戻り値（獲得スコアをメッセージに添える）
function hitEnemy(dmg, kind, score) {
  enemy.hp -= dmg;
  updateEnemyHp();
  if (kind === "magic") {
    el.enemyWrap.classList.add("flash");
    el.hitFlash.classList.add("on");
    setTimeout(() => { el.enemyWrap.classList.remove("flash"); el.hitFlash.classList.remove("on"); }, 400);
  } else {
    el.enemyWrap.classList.add("shake");
    setTimeout(() => el.enemyWrap.classList.remove("shake"), 300);
  }
  showDamage(el.enemyWrap, dmg, false);
  let head;
  if (kind === "critical") head = `<b class="gold">せいかい！ かいしんの いちげき！！</b>`;
  else if (kind === "magic") head = `<b class="red">ほのおが ${enemy.name}を つつむ！</b>`;
  else head = `<b class="blue">せいかい！</b> こうげき！`;
  const scoreLine = score ? `<br><span class="cat">スコア +${score.gain}${score.boosted ? " 🔥ブースト！" : ""}</span>` : ``;
  say([`${head}<br>${enemy.name}に <b class="gold">${dmg}</b> のダメージ！${scoreLine}`], () => {
    // 敵のHPが0以下になったら撃破処理へ、そうでなければ敵のターンへ進む
    if (enemy.hp <= 0) enemyDefeated();
    else enemyTurn();
  });
}

// どうぐ：やくそうを使ってHPを回復する（在庫がなければ選べない）
function cmdItem() {
  const items = [
    {
      label:`やくそう`, sub:`のこり${player.potions}・HP+22`,
      disabled: player.potions <= 0,
      onClick: () => {
        if (player.hp >= player.maxHp) { say([`HPは まんたんだ！`], playerTurn); return; }
        player.potions--;
        const heal = Math.min(22, player.maxHp - player.hp);
        player.hp += heal; updateStatus();
        showDamage(el.heroWrap, "+" + heal, true);
        say([`やくそうを つかった！<br>HPが <b class="blue">${heal}</b> かいふくした！`], enemyTurn);
      },
    },
    { label:`やめる`, onClick: playerTurn },
  ];
  renderMenu(items);
  el.msgText.innerHTML = `どうぐを つかう`;
}

// にげる：ボス戦では逃げられない。それ以外は50%の確率で逃走に成功しマップへ戻る
// にげると、その戦闘（セット）でためたスコアは確定せずに消える
function cmdRun() {
  if (enemy.boss) { say([`だが まわりこまれてしまった！<br>ボスからは にげられない！`], enemyTurn); return; }
  if (Math.random() < 0.5) {
    const note = setScore > 0 ? `<br><span class="cat">とちゅうの スコアは なかったことに…</span>` : ``;
    say([`うまく にげきった！${note}`], () => enterAreaMap(enemyIndex, true));
  } else {
    say([`しかし まわりこまれた！`], enemyTurn);
  }
}

// 敵ターン：敵の攻撃力にばらつきを持たせてダメージを与える（最低1ダメージは保証）
function enemyTurn() {
  let dmg = enemy.atk + Math.floor(Math.random()*4) - 1;
  if (dmg < 1) dmg = 1;
  player.hp = Math.max(0, player.hp - dmg);
  updateStatus();
  el.heroWrap.classList.add("heroshake");
  el.hitFlash.classList.add("on");
  el.game.classList.add("shake");
  setTimeout(() => {
    el.heroWrap.classList.remove("heroshake");
    el.hitFlash.classList.remove("on");
    el.game.classList.remove("shake");
  }, 350);
  showDamage(el.heroWrap, dmg, false);
  say([`${enemy.name}の こうげき！<br>勇者に <b class="red">${dmg}</b> のダメージ！`], () => {
    // 勇者のHPが0になったらゲームオーバー、そうでなければ再び勇者のターンへ
    if (player.hp <= 0) gameOver();
    else playerTurn();
  });
}

// 撃破：経験値・ゴールドを獲得し、必要経験値を超えていればレベルアップ処理を行う
function enemyDefeated() {
  el.enemyWrap.style.opacity = "0";
  player.exp += enemy.exp;
  player.gold += enemy.gold;
  const msgs = [
    `${enemy.name}を たおした！`,
    `<b class="gold">${enemy.exp}</b> の けいけんち` + (enemy.gold>0?` と <b class="gold">${enemy.gold}</b> ゴールド`:``) + ` を えた！`,
  ];
  // 経験値が次のレベルに必要な量を超えている間、複数回のレベルアップも考慮してループする
  while (player.exp >= player.next) {
    player.exp -= player.next;
    player.lv++;
    const hpUp = 6 + Math.floor(Math.random()*4);
    const atkUp = 2 + Math.floor(Math.random()*2);
    const mpUp = 2;
    player.maxHp += hpUp; player.hp = player.maxHp; // レベルアップ時はHP/MPも全回復
    player.maxMp += mpUp; player.mp = player.maxMp;
    player.atk += atkUp;
    player.next = Math.floor(player.next * 1.6); // 次のレベルに必要な経験値を増やしていく
    msgs.push(`<b class="blue">レベルアップ！ Lv.${player.lv} に なった！</b><br>HP+${hpUp}　こうげき+${atkUp}　MP+${mpUp}`);
  }
  updateStatus();
  say(msgs, () => showBattleResult(() => {
    if (enemy.boss) {
      // 最後のボス（魔王）を倒したらゲームクリア、そうでなければ宝箱を得て次のエリアへ
      if (enemyIndex >= ENEMIES.length - 1) { gameClear(); return; }
      player.potions += 2; updateStatus();
      say([`たからばこを みつけた！<br>やくそうを 2つ てにいれた！`], () => enterAreaMap(enemyIndex + 1, false));
    } else {
      // 雑魚敵ならそのままマップに戻り、探索を再開する
      enterAreaMap(enemyIndex, true);
    }
  }));
}

/* ============================================================
   せんとうけっか（リザルト画面）
   ------------------------------------------------------------
   スコアを確定してランクを判定し、リザルト画面を表示する。
   「つづける」を押すと、ランクに応じたスキル抽選の結果を見せてから
   onDone（宝箱・つぎのエリアへ等の後続処理）へ進む。
   ============================================================ */
function showBattleResult(onDone) {
  const res = finishQuestionSet();      // スコア確定＋ランク判定（totalScoreにも加算される）
  const drop = rollSkillDrop(res.rank); // ランクに応じてスキルを抽選
  saveProgress();                       // 自己ベストを更新保存
  updateStatus();
  el.resultBody.innerHTML =
    `せいとう ${res.correct}/${res.total} <span class="cat">（${Math.round(res.acc * 100)}%）</span><br>` +
    `スコア <b class="gold">+${res.final}</b>` +
    (res.mult > 1 ? ` <span class="cat">せいとうりつボーナス ×${res.mult}</span>` : ``) + `<br>` +
    `ごうけい <b class="gold">${player.totalScore}</b>`;
  el.resultRank.textContent = res.rank;
  el.resultRank.className = "rank-letter rank-" + res.rank;
  el.resultScreen.classList.remove("hidden");
  el.resultBtn.onclick = () => {
    el.resultScreen.classList.add("hidden");
    if (drop) {
      say([grantSkill(drop)], onDone); // スキル入手メッセージを見せてから後続処理へ
    } else {
      onDone();
    }
  };
}
