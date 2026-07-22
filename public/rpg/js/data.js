"use strict";
/* ============================================================
   data.js  問題セットデータ（JSON形式）＋ 敵・エリアデータ
   ------------------------------------------------------------
   問題セットは将来、学習アプリで作ったものと差し替えられるように
   次のJSON形式で統一している:
     { id: "セットID", title: "表示名",
       questions: [ { q:"問題文", c:["選択肢×4"], a:正解のindex, exp:"解説文" } ] }
   解説(exp)は「さきよみの書」スキルで解答前に表示される。
   表示時に正解の単語は「？？？」に伏せ字化されるので、
   解説文に答えの単語が入っていても問題ない。
   ============================================================ */

const DEFAULT_QUESTION_SETS = [
  {
    id: "math", title: "数学",
    questions: [
      { q:"-3 + 8 = ?", c:["5","-5","11","-11"], a:0,
        exp:"符号がちがう2つの数のたし算は、絶対値の差を計算して、絶対値が大きいほうの符号をつける。8−3を計算しよう。" },
      { q:"7 × (-4) = ?", c:["-28","28","-11","11"], a:0,
        exp:"正の数×負の数は、答えが負の数になる。まず7×4を計算して、マイナスの符号をつける。" },
      { q:"2x = 10 のとき x = ?", c:["5","8","20","12"], a:0,
        exp:"両辺を2でわると x だけが残る。10÷2 を計算しよう。" },
      { q:"3(x+2) を展開すると？", c:["3x+6","3x+2","x+6","3x+5"], a:0,
        exp:"分配法則を使う。かっこの外の3を、x と 2 の両方にかけてからたす。" },
      { q:"√16 = ?", c:["4","8","256","2"], a:0,
        exp:"ルートは「2乗するとその数になる正の数」。同じ数を2回かけて16になる数を探そう。" },
      { q:"(-2)² = ?", c:["4","-4","2","-2"], a:0,
        exp:"2乗は同じ数を2回かけること。(−2)×(−2) で、負×負は正になる。" },
      { q:"12 と 18 の最大公約数は？", c:["6","3","36","2"], a:0,
        exp:"12=2×2×3、18=2×3×3。両方に共通する 2×3 が最大公約数になる。" },
      { q:"x + 5 = 2 のとき x = ?", c:["-3","3","7","-7"], a:0,
        exp:"両辺から5をひくと x だけが残る。2−5 を計算しよう。答えが負の数になることに注意。" },
      { q:"半径3の円の面積は？", c:["9π","6π","3π","12π"], a:0,
        exp:"円の面積は 半径×半径×π で求める。3×3 にπをつけよう。" },
      { q:"1/2 + 1/3 = ?", c:["5/6","2/5","1/6","2/6"], a:0,
        exp:"分母がちがう分数は通分してからたす。分母を6にそろえると 3/6+2/6 になる。" },
      { q:"y=2x の傾きは？", c:["2","0","1","-2"], a:0,
        exp:"y=ax の形の式では、x の前についている数 a が傾きを表す。" },
      { q:"8 ÷ (-2) = ?", c:["-4","4","-6","16"], a:0,
        exp:"正の数÷負の数は、答えが負の数になる。まず8÷2を計算して、マイナスの符号をつける。" },
    ],
  },
  {
    id: "english", title: "英語",
    questions: [
      { q:"「本」を英語で？", c:["book","desk","pen","cup"], a:0,
        exp:"deskは「机」、penは「ペン」、cupは「コップ」。「本」を表す単語を選ぼう。" },
      { q:"I ___ a student.", c:["am","is","are","be"], a:0,
        exp:"be動詞は主語によって形が変わる。主語が I のときに使えるbe動詞は1つだけ。" },
      { q:"「月曜日」は？", c:["Monday","Sunday","Friday","March"], a:0,
        exp:"Sundayは日曜日、Fridayは金曜日。Marchは「3月」で曜日ではなく月の名前。" },
      { q:"go の過去形は？", c:["went","goed","gone","going"], a:0,
        exp:"go は不規則動詞なので、過去形は -ed をつけない特別な形になる。goneは過去分詞。" },
      { q:"「速い」は？", c:["fast","slow","long","tall"], a:0,
        exp:"slowは「おそい」、longは「長い」、tallは「背が高い」。「速い」はどれ？" },
      { q:"She ___ tennis.", c:["plays","play","playing","played"], a:0,
        exp:"主語が she（三人称単数）で現在の文なので、動詞の最後に s がつく形を選ぶ。" },
      { q:"「9月」は？", c:["September","November","October","August"], a:0,
        exp:"7月はJuly、8月はAugust。その次にくる9月を表す単語を選ぼう。" },
      { q:"___ you like it?", c:["Do","Does","Is","Are"], a:0,
        exp:"like は一般動詞なので、疑問文は Do か Does で始める。主語が you のときに使うのはどっち？" },
      { q:"「美しい」は？", c:["beautiful","ugly","small","heavy"], a:0,
        exp:"uglyは「みにくい」、smallは「小さい」、heavyは「重い」。「美しい」はどれ？" },
      { q:"big の比較級は？", c:["bigger","biger","more big","biggest"], a:0,
        exp:"big のような短い形容詞の比較級は -er をつける。big は最後の g を重ねるのがポイント。" },
      { q:"「ありがとう」は？", c:["Thank you","Sorry","Hello","Bye"], a:0,
        exp:"Sorryは「ごめんなさい」、Helloは「こんにちは」、Byeは「さようなら」。" },
    ],
  },
  {
    id: "science", title: "理科",
    questions: [
      { q:"水の化学式は？", c:["H₂O","CO₂","O₂","NaCl"], a:0,
        exp:"水は水素原子2個と酸素原子1個からできている。Hが水素、Oが酸素を表す。" },
      { q:"植物が光で栄養を作る働きは？", c:["光合成","呼吸","蒸散","発酵"], a:0,
        exp:"植物が光のエネルギーを使って、水と二酸化炭素からデンプン（栄養分）を作るはたらきのこと。" },
      { q:"地球の衛星は？", c:["月","太陽","火星","金星"], a:0,
        exp:"惑星のまわりを回る天体を衛星という。地球のまわりを回っている天体は1つだけ。" },
      { q:"酸性・アルカリ性の指標は？", c:["pH","kg","℃","V"], a:0,
        exp:"酸性・中性・アルカリ性の強さを0〜14の数値で表すものさし。7がちょうど中性。" },
      { q:"電流の単位は？", c:["アンペア","ボルト","ワット","オーム"], a:0,
        exp:"電流の単位は記号Aで表す。ボルトは電圧、ワットは電力、オームは抵抗の単位。" },
      { q:"二酸化炭素の化学式は？", c:["CO₂","H₂O","O₂","CO"], a:0,
        exp:"二酸化炭素は炭素原子1個と酸素原子2個からできている。Cが炭素、Oが酸素。" },
      { q:"音を伝えないのは？", c:["真空","空気","水","金属"], a:0,
        exp:"音はものの振動として伝わる。振動を伝えるものが何もない場所では、音は伝わらない。" },
      { q:"呼吸で取り込む気体は？", c:["酸素","窒素","水素","二酸化炭素"], a:0,
        exp:"生き物は呼吸で空気中からこの気体を取り込み、二酸化炭素をはき出している。" },
      { q:"磁石が引きつけるのは？", c:["鉄","金","アルミ","銅"], a:0,
        exp:"磁石につくのは一部の金属だけ。金・アルミニウム・銅は磁石につかない。" },
      { q:"地震の揺れの大きさは？", c:["震度","湿度","気圧","経度"], a:0,
        exp:"地震のゆれの大きさは10段階の階級で表す。地震そのものの規模はマグニチュード。" },
    ],
  },
  {
    id: "social", title: "社会",
    questions: [
      { q:"日本の首都は？", c:["東京","大阪","京都","名古屋"], a:0,
        exp:"日本の国会や中央省庁が集まっている都市。" },
      { q:"鎌倉幕府を開いたのは？", c:["源頼朝","織田信長","徳川家康","豊臣秀吉"], a:0,
        exp:"1185年ごろ、武士として初めて幕府を鎌倉に開いた人物。「いいはこ作ろう」で覚える。" },
      { q:"三権に入らないのは？", c:["報道権","立法権","行政権","司法権"], a:0,
        exp:"三権分立の三権は、法律を作る立法権・政治を行う行政権・裁判をする司法権。" },
      { q:"世界一長い川は？", c:["ナイル川","アマゾン川","長江","利根川"], a:0,
        exp:"アフリカ大陸を流れる全長約6700kmの川。アマゾン川は流域面積が世界一。" },
      { q:"1868年の改革は？", c:["明治維新","大化の改新","文明開化","産業革命"], a:0,
        exp:"江戸幕府がたおれ、新政府による近代化の改革が始まった出来事。" },
      { q:"国会が作るのは？", c:["法律","条約","判決","命令"], a:0,
        exp:"国会は「国の唯一の立法機関」。立法とは何を作ることかを考えよう。" },
      { q:"アメリカの首都は？", c:["ワシントンD.C.","ニューヨーク","ロス","シカゴ"], a:0,
        exp:"ニューヨークはアメリカ最大の都市だが、首都ではないことに注意。" },
      { q:"太平洋戦争が終わった年は？", c:["1945年","1939年","1868年","1953年"], a:0,
        exp:"8月15日に日本が降伏を発表して太平洋戦争が終わった。昭和20年のこと。" },
      { q:"憲法の三大原則でないのは？", c:["軍国主義","国民主権","人権の尊重","平和主義"], a:0,
        exp:"日本国憲法の三大原則は、国民主権・基本的人権の尊重・平和主義の3つ。" },
      { q:"赤道が通る大陸は？", c:["アフリカ","南極","ヨーロッパ","北アメリカ"], a:0,
        exp:"赤道は緯度0度の線で、南アメリカ大陸とこの大陸などを通っている。" },
    ],
  },
];

/* ============================================================
   Revinoの問題セット読み込み
   ------------------------------------------------------------
   Revino本体がlocalStorageへ保存した以下のデータを使用する。

   pz_materials
     問題セット一覧

   pz_questions
     問題一覧
============================================================ */

/*
 * localStorageのJSONを安全に読み込む。
 */
function readRevinoStorage(key, fallbackValue) {
  try {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallbackValue;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    console.error(
      `${key}の読み込みに失敗しました:`,
      error
    );

    return fallbackValue;
  }
}

/*
 * 問題の選択肢を配列へ変換する。
 *
 * 以下の形式に対応する。
 *
 * ["選択肢1", "選択肢2"]
 *
 * [
 *   { choiceText: "選択肢1" },
 *   { choice_text: "選択肢2" }
 * ]
 */
function normalizeRevinoChoices(rawChoices) {
  let choices = rawChoices;

  /*
   * choicesがJSON文字列として保存されている場合にも対応する。
   */
  if (typeof choices === "string") {
    try {
      choices = JSON.parse(choices);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(choices)) {
    return [];
  }

  return choices
    .map(choice => {
      if (typeof choice === "string") {
        return choice.trim();
      }

      if (!choice || typeof choice !== "object") {
        return "";
      }

      return String(
        choice.choiceText ??
        choice.choice_text ??
        choice.text ??
        choice.label ??
        ""
      ).trim();
    })
    .filter(Boolean);
}

/*
 * choicesの中に正解フラグがある場合、
 * 正解位置を取得する。
 */
function findCorrectChoiceFromObjects(rawChoices) {
  let choices = rawChoices;

  if (typeof choices === "string") {
    try {
      choices = JSON.parse(choices);
    } catch {
      return -1;
    }
  }

  if (!Array.isArray(choices)) {
    return -1;
  }

  return choices.findIndex(choice => {
    if (!choice || typeof choice !== "object") {
      return false;
    }

    return (
      choice.isCorrect === true ||
      choice.is_correct === true ||
      Number(choice.isCorrect) === 1 ||
      Number(choice.is_correct) === 1
    );
  });
}

/*
 * 問題の正解位置を取得する。
 */
function getRevinoCorrectIndex(question, choices) {
  const directIndex = Number(
    question.correct ??
    question.correctIndex ??
    question.correct_index ??
    question.answerIndex ??
    question.answer_index
  );

  if (
    Number.isInteger(directIndex) &&
    directIndex >= 0 &&
    directIndex < choices.length
  ) {
    return directIndex;
  }

  /*
   * 選択肢オブジェクトにisCorrectが付いている形式。
   */
  const objectIndex = findCorrectChoiceFromObjects(
    question.choices
  );

  if (
    objectIndex >= 0 &&
    objectIndex < choices.length
  ) {
    return objectIndex;
  }

  /*
   * answerがA～Dの場合。
   */
  const answerValue = String(
    question.answer ??
    question.correctAnswer ??
    question.correct_answer ??
    ""
  ).trim();

  if (/^[A-Da-d]$/.test(answerValue)) {
    const letterIndex =
      answerValue.toUpperCase().charCodeAt(0) -
      "A".charCodeAt(0);

    if (letterIndex < choices.length) {
      return letterIndex;
    }
  }

  /*
   * answerに正解文字列が入っている場合。
   */
  if (answerValue) {
    const textIndex = choices.findIndex(choice => {
      return choice === answerValue;
    });

    if (textIndex >= 0) {
      return textIndex;
    }
  }

  return -1;
}

/*
 * Revinoの1問をRPG形式に変換する。
 *
 * Revino形式
 * {
 *   text,
 *   choices,
 *   correct,
 *   explanation
 * }
 *
 * RPG形式
 * {
 *   q,
 *   c,
 *   a,
 *   exp
 * }
 */
function convertRevinoQuestion(question) {
  const choices = normalizeRevinoChoices(
    question.choices
  );

  /*
   * RPGでは最低2択以上必要。
   */
  if (choices.length < 2) {
    return null;
  }

  const correctIndex = getRevinoCorrectIndex(
    question,
    choices
  );

  if (
    correctIndex < 0 ||
    correctIndex >= choices.length
  ) {
    return null;
  }

  const questionText = String(
    question.text ??
    question.questionText ??
    question.question_text ??
    ""
  ).trim();

  if (!questionText) {
    return null;
  }

  return {
    q: questionText,
    c: choices,
    a: correctIndex,

    exp: String(
      question.explanation ??
      question.exp ??
      ""
    ).trim()
  };
}

/*
 * Revinoの教材IDを取得する。
 */
function getRevinoMaterialId(material) {
  return String(
    material.id ??
    material.materialId ??
    material.material_id ??
    ""
  );
}

/*
 * Revinoの問題が所属する教材IDを取得する。
 */
function getRevinoQuestionMaterialId(question) {
  return String(
    question.materialId ??
    question.material_id ??
    question.material?.id ??
    ""
  );
}

/*
 * Revinoの問題セットをRPG形式へ変換する。
 */
function buildRevinoQuestionSets() {
  const materials = readRevinoStorage(
    "pz_materials",
    []
  );

  const questions = readRevinoStorage(
    "pz_questions",
    []
  );

  if (
    !Array.isArray(materials) ||
    !Array.isArray(questions)
  ) {
    return [];
  }

  return materials
    .map((material, materialIndex) => {
      const materialId =
        getRevinoMaterialId(material);

      if (!materialId) {
        return null;
      }

      const convertedQuestions = questions
        .filter(question => {
          return (
            getRevinoQuestionMaterialId(question) ===
            materialId
          );
        })
        .map(convertRevinoQuestion)
        .filter(Boolean);

      /*
       * RPGで使用できる問題がないセットは除外する。
       */
      if (convertedQuestions.length === 0) {
        return null;
      }

      return {
        id: materialId,

        title: String(
          material.name ??
          material.materialName ??
          material.material_name ??
          `問題セット${materialIndex + 1}`
        ),

        questions: convertedQuestions
      };
    })
    .filter(Boolean);
}

/*
 * RPGで実際に使用する問題セット。
 *
 * 固定問題ではなく、Revinoのユーザー所持セットのみを使用する。
 */
const QUESTION_SETS = buildRevinoQuestionSets();

/*
 * 読み込み確認用。
 */
console.log(
  "RPGで読み込んだ問題セット:",
  QUESTION_SETS.map(set => ({
    id: set.id,
    title: set.title,
    questionCount: set.questions.length
  }))
);

// セットIDから問題セット本体を引けるようにした対応表
const QUESTION_SET_MAP = Object.fromEntries(QUESTION_SETS.map(s => [s.id, s]));
// セットIDから表示名（数学・英語など）への対応表
const CAT_NAME = Object.fromEntries(QUESTION_SETS.map(s => [s.id, s.title]));

// 出題カテゴリの中からランダムに1問選び、選択肢の順番をシャッフルして返す
/* ============================================================
   ユーザー所持セットからランダムに問題を選ぶ
============================================================ */

function pickQuestion(categories = []) {
  /*
   * 敵側に指定されたセットIDと一致するものがあれば、
   * そのセットを優先する。
   */
  const requestedIds = Array.isArray(categories)
    ? categories.map(String)
    : [];

  let availableSets = requestedIds
    .map(id => QUESTION_SET_MAP[id])
    .filter(set => {
      return (
        set &&
        Array.isArray(set.questions) &&
        set.questions.length > 0
      );
    });

  /*
   * 敵側のcatsは元の数学・英語などのIDなので、
   * ユーザーの教材IDと一致しない場合は
   * ユーザーが持っている全セットから選ぶ。
   */
  if (availableSets.length === 0) {
    availableSets = QUESTION_SETS.filter(set => {
      return (
        Array.isArray(set.questions) &&
        set.questions.length > 0
      );
    });
  }

  if (availableSets.length === 0) {
    return null;
  }

  /*
   * 問題セットをランダムに選択。
   */
  const selectedSet =
    availableSets[
      Math.floor(
        Math.random() *
        availableSets.length
      )
    ];

  /*
   * 選択したセットから1問選ぶ。
   */
  const baseQuestion =
    selectedSet.questions[
      Math.floor(
        Math.random() *
        selectedSet.questions.length
      )
    ];

  const correctChoice =
    baseQuestion.c[baseQuestion.a];

  const shuffledChoices =
    baseQuestion.c.slice();

  /*
   * 選択肢をシャッフルする。
   */
  for (
    let i = shuffledChoices.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [
      shuffledChoices[i],
      shuffledChoices[j]
    ] = [
      shuffledChoices[j],
      shuffledChoices[i]
    ];
  }

  return {
    q: baseQuestion.q,
    c: shuffledChoices,
    a: shuffledChoices.indexOf(correctChoice),
    cat: selectedSet.id,
    exp: baseQuestion.exp || ""
  };
}

/* ============================================================
   敵・エリアデータ
   （1エリア＝1つの敵定義。walkはマップ上の移動・出口・お店の設定）
   ============================================================ */
const ENEMIES = [
  { id:"slimeA", name:"スライム",         hp:14,  atk:3,  exp:6,   gold:8,
    cats:["math","english"], boss:false,
    draw:c=>drawCharacter(c, "slimeA", slimeGrid(), slimePal("#37c24a","#a8ffb8")),
    area:"はじまりの草原", mapTheme:"grass",
    walk: {
      bounds:{x0:26,y0:36,x1:334,y1:194}, start:{x:40,y:130},
      encounterEnemy:0, encounterRate:0.30,
      hotspots:[
        { x:326,y:118, icon:"➜", label:"港町へ", action:()=>goExit(1) },
        { x:150,y:180, icon:"🏆", label:"ランキング", action:()=>openRankingScreen() },
      ],
    } },
  { id:"slimeB", name:"ぶるぷるん",       hp:24,  atk:5,  exp:11,  gold:14,
    cats:["math","science"], boss:false,
    draw:c=>drawCharacter(c, "slimeB", slimeGrid(), slimePal("#3aa0ff","#bfe3ff")),
    area:"港町ポルト", mapTheme:"port",
    walk: {
      bounds:{x0:26,y0:36,x1:334,y1:194}, start:{x:34,y:140},
      encounterEnemy:1, encounterRate:0.22,
      hotspots:[
        { x:120,y:150, icon:"🧪", label:"どうぐ屋", action:()=>openItemShopDialog() },
        { x:230,y:105, icon:"🏠", label:"やどや", action:()=>openInnDialog() },
        { x:60,y:95,   icon:"🏆", label:"ランキング", action:()=>openRankingScreen() },
        { x:326,y:120, icon:"➜", label:"つぎの村へ", action:()=>goExit(2) },
      ],
    } },
  { id:"slimeC", name:"デビルスライム",   hp:36,  atk:8,  exp:18,  gold:24,
    cats:["english","social"], boss:false,
    draw:c=>drawCharacter(c, "slimeC", slimeGrid(), slimePal("#e8434f","#ffb0a8")),
    area:"国境の村", mapTheme:"village",
    walk: {
      bounds:{x0:26,y0:36,x1:334,y1:194}, start:{x:34,y:140},
      encounterEnemy:2, encounterRate:0.28,
      hotspots:[
        { x:150,y:150, icon:"🧪", label:"どうぐ屋", action:()=>openItemShopDialog() },
        { x:250,y:100, icon:"🏠", label:"やどや", action:()=>openInnDialog() },
        { x:60,y:90,   icon:"🏆", label:"ランキング", action:()=>openRankingScreen() },
        { x:326,y:118, icon:"➜", label:"ほら穴へ", action:()=>goExit(3) },
      ],
    } },
  { id:"demon",  name:"だてんしデーモン", hp:62,  atk:12, exp:44,  gold:60,
    cats:["math","science","social"], boss:true,
    draw:c=>drawCharacter(c, "demon", demonGrid(), demonPal()),
    area:"封印のほら穴", mapTheme:"cave",
    walk: {
      bounds:{x0:26,y0:40,x1:334,y1:190}, start:{x:34,y:150},
      encounterEnemy:null, encounterRate:0,
      hotspots:[ { x:300,y:110, icon:"👹", label:"デーモン", action:()=>startBattle(3) } ],
    } },
  { id:"maou",   name:"まおう ダークロード", hp:100, atk:16, exp:120, gold:0,
    cats:["math","english","science","social"], boss:true,
    draw:c=>drawCharacter(c, "maou", maouGrid(), maouPal()),
    size:{w:440,h:210}, // 表示枠のサイズ（横長のドラゴン画像を大きく見せる。未指定の敵は240×240）
    area:"まおうの城", mapTheme:"castle",
    walk: {
      bounds:{x0:60,y0:60,x1:300,y1:196}, start:{x:180,y:190},
      encounterEnemy:null, encounterRate:0,
      hotspots:[ { x:180,y:70, icon:"👑", label:"まおう", action:()=>startBattle(4) } ],
    } },
];
