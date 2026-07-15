function toGrowthCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function getUserGrowthCounts() {
  return {
    study: toGrowthCount(S.user?.study_count ?? S.user?.studyCount ?? 0),
    battle: toGrowthCount(S.user?.battle_win_count ?? S.user?.battleWinCount ?? S.user?.wins ?? 0),
    question: toGrowthCount(S.user?.question_count ?? S.user?.questionCount ?? S.user?.problem_count ?? S.user?.problemCount ?? 0)
  };
}

function getGrowthCharacters() {
  return [
    {
      key: "study",
      label: "学習ドラゴン",
      countLabel: "学習回数",
      unit: "回",
      actionLabel: "学習する",
      actionScreen: "question-set",
      colorClass: "theme-study",
      thresholds: [0, 100, 500, 1000, 5000, 10000],
      stageTexts: {
        egg: "学習の熱で、少しずつ殻があたたまっています。",
        hatch: "学びの気配に反応して、小さな竜が目を覚ましました。",
        child: "復習のリズムを覚えて、知識を追いかけています。",
        adult: "積み重ねた学習で、堂々とした守護竜になりました。",
        evolved: "長く学び続けた証として、叡智の力をまとっています。",
        complete: "膨大な学習記録を力に変えた、Revinoの完全竜です。"
      },
      traitTexts: {
        egg: "可能性",
        hatch: "好奇心",
        child: "集中力",
        adult: "継続力",
        evolved: "応用力",
        complete: "到達者の知識"
      }
    },
    {
      key: "battle",
      label: "勝利ドラゴン",
      countLabel: "対戦勝利数",
      unit: "勝",
      actionLabel: "対戦する",
      actionScreen: "battle-start",
      colorClass: "theme-battle",
      thresholds: [0, 10, 50, 100, 500, 1000],
      stageTexts: {
        egg: "勝利の火種が、まだ小さく眠っています。",
        hatch: "初めての勝利を覚えた小竜が、牙を見せ始めました。",
        child: "勝ち方を覚え、相手の動きを読む力が育っています。",
        adult: "数々の勝負を越えて、戦う姿に風格が出てきました。",
        evolved: "勝利の記録が力になり、闘気をまとっています。",
        complete: "対戦の頂に近づいた、誇り高い完全竜です。"
      },
      traitTexts: {
        egg: "闘志",
        hatch: "挑戦心",
        child: "反応力",
        adult: "勝負勘",
        evolved: "闘気",
        complete: "王者の風格"
      }
    },
    {
      key: "question",
      label: "創造ドラゴン",
      countLabel: "問題生成数",
      unit: "問",
      actionLabel: "問題を作る",
      actionScreen: "upload",
      colorClass: "theme-question",
      thresholds: [0, 100, 500, 1000, 5000, 10000],
      stageTexts: {
        egg: "新しい問題のかけらを、卵の中で集めています。",
        hatch: "問題を作る力に反応して、小さな創造竜が生まれました。",
        child: "作った問題を糧にして、知識を形にする力が育っています。",
        adult: "たくさんの問題を生み出し、教材を支える竜になりました。",
        evolved: "問題生成の記録が結晶化し、創造の翼が広がっています。",
        complete: "膨大な問題を生み出した、教材創造の完全竜です。"
      },
      traitTexts: {
        egg: "ひらめき",
        hatch: "発想力",
        child: "構成力",
        adult: "教材力",
        evolved: "創造力",
        complete: "知識創造"
      }
    }
  ];
}

function getDragonStageNames() {
  return [
    { key: "egg", name: "卵", title: "竜卵" },
    { key: "hatch", name: "ドラゴン孵化", title: "はじまりの小竜" },
    { key: "child", name: "幼体", title: "育ち始めた幼竜" },
    { key: "adult", name: "成体", title: "力を得た成竜" },
    { key: "evolved", name: "進化体", title: "力をまとう進化竜" },
    { key: "complete", name: "完全体", title: "Revino完全竜" }
  ];
}

function getDragonExpressions() {
  return [
    { key: "normal", label: "通常" },
    { key: "happy", label: "よろこび" },
    { key: "focus", label: "集中" },
    { key: "sleepy", label: "ねむい" },
    { key: "serious", label: "本気" },
    { key: "proud", label: "勝利" }
  ];
}

function getRandomDragonExpression() {
  const expressions = getDragonExpressions();
  return expressions[Math.floor(Math.random() * expressions.length)];
}

function getRandomDragonExpressionExcept(currentExpressionKey = "") {
  const expressions = getDragonExpressions();

  const candidates = expressions.filter(expression => {
    return expression.key !== currentExpressionKey;
  });

  const targetExpressions =
    candidates.length > 0
      ? candidates
      : expressions;

  return targetExpressions[
    Math.floor(Math.random() * targetExpressions.length)
  ];
}

function getDragonInteractionMessage(character, stage, expression) {
  const characterMessages = {
    study: {
      normal: "静かにこちらを見ています。",
      happy: "なでられて、とてもうれしそうです。",
      focus: "気持ちが引き締まり、学習への集中力が高まっています。",
      sleepy: "安心したのか、少し眠そうにしています。",
      serious: "次の学習に向けて、本気の顔になりました。",
      proud: "今までの学習成果を誇らしげに見せています。"
    },

    battle: {
      normal: "落ち着いて次の勝負を待っています。",
      happy: "なでられて、勝負前とは思えないほどご機嫌です。",
      focus: "次の対戦相手を見据えて集中しています。",
      sleepy: "戦いの合間に少し休憩したいようです。",
      serious: "勝利を目指して闘志を燃やしています。",
      proud: "これまでの勝利を自慢したそうにしています。"
    },

    question: {
      normal: "次に作る問題を静かに考えています。",
      happy: "新しい問題のアイデアを思いついたようです。",
      focus: "問題の構成を真剣に考えています。",
      sleepy: "アイデアを考えすぎて、少し眠そうです。",
      serious: "良い問題を作るために、本気になっています。",
      proud: "これまで作った問題を誇らしげに眺めています。"
    }
  };

  const stageMessages = {
    egg: "卵の中から、小さく反応する音が聞こえました。",
    hatch: "小さな体を近づけて、もっと触ってほしそうです。",
    child: "元気よく動き回り、こちらを見上げています。",
    adult: "堂々とした姿ですが、なでられるのは好きなようです。",
    evolved: "体からあふれる力が、少しだけ強くなりました。",
    complete: "完全体になっても、触れ合えることがうれしいようです。"
  };

  const characterMessage =
    characterMessages[character.key]?.[expression.key] ??
    "こちらを見つめています。";

  const stageMessage =
    stageMessages[stage.key] ??
    "";

  return `${characterMessage} ${stageMessage}`;
}

function getDragonExpressionMessage(character, stage, expression) {
  const stageMessages = {
    egg: `${character.label}はまだ卵の中。小さな力をためています。`,
    hatch: `${character.label}は生まれたばかり。新しい記録に敏感に反応しています。`,
    child: `${character.label}は幼体になり、少しずつ自分の役目を覚え始めています。`,
    adult: `${character.label}は成体になり、これまでの積み重ねを力に変えています。`,
    evolved: `${character.label}は進化体。記録の力が体からあふれています。`,
    complete: `${character.label}は完全体。ここまで育てた証が輝いています。`
  };

  const expressionMessages = {
    normal: "今日は落ち着いた様子です。いつものペースで進めましょう。",
    happy: "かなり機嫌がよさそうです。次の行動を楽しみにしています。",
    focus: "目つきが真剣です。今なら一気に伸びそうです。",
    sleepy: "少し眠そうです。軽めに進めて起こしてあげるとよさそうです。",
    serious: "本気の表情です。次の成長に向けて力をためています。",
    proud: "自信たっぷりです。これまでの積み重ねを誇っています。"
  };

  return `${stageMessages[stage.key]} ${expressionMessages[expression.key]}`;
}

function buildDragonStagesForCharacter(character) {
  const baseStages = getDragonStageNames();

  return baseStages.map((stage, index) => ({
    ...stage,
    min: character.thresholds[index],
    title: `${character.label}・${stage.title}`,
    trait: character.traitTexts[stage.key],
    text: character.stageTexts[stage.key]
  }));
}

function getDragonGrowthInfo(character, count) {
  const stages = buildDragonStagesForCharacter(character);
  let index = 0;

  for (let i = 0; i < stages.length; i++) {
    if (count >= stages[i].min) {
      index = i;
    }
  }

  const current = stages[index];
  const previous = stages.slice(0, index);
  const next = stages[index + 1] || null;

  const progress = next
    ? Math.round(((count - current.min) / (next.min - current.min)) * 100)
    : 100;

  const expression = getRandomDragonExpression();

  return {
    character,
    count,
    current,
    previous,
    next,
    remaining: next ? Math.max(0, next.min - count) : 0,
    progress: Math.min(100, Math.max(0, progress)),
    expression,
    expressionMessage: getDragonExpressionMessage(character, current, expression)
  };
}

function interactWithDragon(characterKey) {
  const character = getGrowthCharacters().find(item => {
    return item.key === characterKey;
  });

  if (!character) {
    return;
  }

  const counts = getUserGrowthCounts();
  const count = counts[characterKey] || 0;
  const info = getDragonGrowthInfo(character, count);

  const card = document.querySelector(
    `[data-growth-card="${characterKey}"]`
  );

  if (!card) {
    return;
  }

  const avatar = card.querySelector(
    ".growth-current-avatar .dragon-avatar"
  );

  const message = card.querySelector(
    ".dragon-message"
  );

  const effect = card.querySelector(
    ".growth-touch-effect"
  );

  const button = card.querySelector(
    ".growth-touch-button"
  );

  if (!avatar || !message) {
    return;
  }

  const expressions = getDragonExpressions();

  const currentExpression = expressions.find(expression => {
    return avatar.classList.contains(
      `face-${expression.key}`
    );
  });

  const nextExpression = getRandomDragonExpressionExcept(
    currentExpression?.key || ""
  );

  expressions.forEach(expression => {
    avatar.classList.remove(
      `face-${expression.key}`
    );
  });

  avatar.classList.add(
    `face-${nextExpression.key}`
  );

  message.textContent = getDragonInteractionMessage(
    character,
    info.current,
    nextExpression
  );

  /*
   * キャラクターのリアクションを再生
   */
  avatar.classList.remove(
    "dragon-touch-reaction"
  );

  void avatar.offsetWidth;

  avatar.classList.add(
    "dragon-touch-reaction"
  );

  /*
   * ハート演出
   */
  if (effect) {
    effect.classList.remove("show");
    effect.innerHTML = `
      <span>♥</span>
      <span>♥</span>
      <span>♥</span>
      <span>♥</span>
      <span>♥</span>
    `;

    void effect.offsetWidth;

    effect.classList.add("show");

    window.setTimeout(() => {
      effect.classList.remove("show");
      effect.innerHTML = "";
    }, 900);
  }

  /*
   * 連打防止
   */
  if (button) {
    button.disabled = true;
    button.textContent = "よろこんでいる！";

    window.setTimeout(() => {
      button.disabled = false;
      button.textContent = "♡ なでる";
    }, 700);
  }
}

function renderDragonAvatar(stage, expression, extraClass = "", characterKey = "study") {
  return `
    <div class="dragon-avatar dragon-${stage.key} face-${expression} kind-${characterKey} ${extraClass}">
      <div class="dragon-shadow"></div>
      <div class="dragon-tail"></div>
      <div class="dragon-wing left"></div>
      <div class="dragon-wing right"></div>
      <div class="dragon-body">
        <div class="dragon-crack"></div>
        <div class="dragon-horn left"></div>
        <div class="dragon-horn right"></div>
        <div class="dragon-eye left"></div>
        <div class="dragon-eye right"></div>
        <div class="dragon-brow left"></div>
        <div class="dragon-brow right"></div>
        <div class="dragon-mouth"></div>
        <div class="dragon-cheek left"></div>
        <div class="dragon-cheek right"></div>
        <div class="dragon-shine"></div>
      </div>
    </div>
  `;
}

function renderPreviousForms(info) {
  if (info.previous.length === 0) {
    return `<div class="growth-empty">まだ過去の姿はありません。最初の記録で物語が動き始めます。</div>`;
  }

  return info.previous.map(stage => `
    <div class="history-item">
      ${renderDragonAvatar(stage, "normal", "small", info.character.key)}
      <div>
        <div class="history-name">${esc(stage.name)}</div>
        <div class="history-title">${esc(stage.title)}</div>
        <div class="history-count">${stage.min}${esc(info.character.unit)}で到達</div>
      </div>
    </div>
  `).join("");
}

function renderGrowthCard(info) {
  const progressText = info.next
    ? `次の「${info.next.name}」まであと${info.remaining}${info.character.unit}`
    : "すべての変化を記録済み";

  return `
    <div
      class="hero ${info.character.colorClass}"
      data-growth-card="${esc(info.character.key)}"
    >
      <div class="current">
        <div class="growth-current-avatar">
          ${renderDragonAvatar(
            info.current,
            info.expression.key,
            "",
            info.character.key
          )}

          <div
            class="growth-touch-effect"
            aria-hidden="true"
          ></div>
        </div>

        <div class="growth-current-info">
          <div class="kicker">
            ${esc(info.character.label)}
          </div>

          <div class="name">
            ${esc(info.current.name)}
          </div>

          <div class="sub">
            ${esc(info.current.title)}<br>
            ${esc(info.current.text)}
          </div>

          <div
            class="dragon-message"
            aria-live="polite"
          >
            ${esc(info.expressionMessage)}
          </div>
        </div>
      </div>

      <div class="bar">
        <div
          class="bar-fill"
          style="width:${info.progress}%"
        ></div>
      </div>

      <div
        class="sub"
        style="margin-top:8px"
      >
        ${esc(progressText)}
      </div>

      <div class="stats hero-stats">
        <div class="stat dark">
          <div class="stat-label">
            ${esc(info.character.countLabel)}
          </div>

          <div class="stat-value">
            ${info.count}${esc(info.character.unit)}
          </div>
        </div>

        <div class="stat dark">
          <div class="stat-label">
            現在の力
          </div>

          <div class="stat-value">
            ${esc(info.current.trait)}
          </div>
        </div>
      </div>

      <div class="history-box">
        <div class="panel-title light">
          これまでの姿
        </div>

        <div class="history-list">
          ${renderPreviousForms(info)}
        </div>
      </div>

      <div class="growth-card-actions">
        <button
          class="growth-touch-button"
          type="button"
          onclick="interactWithDragon('${info.character.key}')"
        >
          ♡ なでる
        </button>

        <button
          class="btn btn-primary growth-action"
          type="button"
          onclick="navigate('${info.character.actionScreen}')"
        >
          ${esc(info.character.actionLabel)}
        </button>
      </div>
    </div>
  `;
}

function renderExpressionGallery(info) {
  return info.expressions.map(exp => `
    <div class="expression-card">
      ${renderDragonAvatar(info.current, exp.key, "tiny")}
      <div class="expression-label">${esc(exp.label)}</div>
    </div>
  `).join("");
}

function renderCharacterGrowth() {
  const counts = getUserGrowthCounts();

  const infos = getGrowthCharacters().map(character => {
    return getDragonGrowthInfo(
      character,
      counts[character.key] || 0
    );
  });

  return `
    <div class="growth-page">
      <div class="growth-head">
        <button
          class="growth-back"
          type="button"
          onclick="navigate('home')"
          aria-label="ホームへ戻る"
        >
          ‹
        </button>

        <div class="growth-title">
          成長モード
        </div>

        <div class="growth-head-space"></div>
      </div>

      <div class="growth-lead">
        学習・対戦勝利・問題生成の記録で、
        3体のドラゴンがそれぞれ成長します。
      </div>

      <div class="growth-card-list">
        ${infos.map(info => renderGrowthCard(info)).join("")}
      </div>
    </div>
  `;
}