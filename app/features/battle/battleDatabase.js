const BATTLE_SUBJECTS = {
  japanese: "国語",
  math: "数学",
  english: "英語",
  science: "理科",
  social: "社会"
};

const battleQuestions = [
  // 国語
  {
    id: "jp_001",
    subject: "japanese",
    text: "「山」の音読みはどれですか？",
    choices: ["やま", "サン", "かわ", "リン"],
    correct: 1,
    explanation: "「山」の音読みは「サン」です。"
  },
  {
    id: "jp_002",
    subject: "japanese",
    text: "「走る」の品詞はどれですか？",
    choices: ["名詞", "動詞", "形容詞", "副詞"],
    correct: 1,
    explanation: "「走る」は動作を表すので動詞です。"
  },
  {
    id: "jp_003",
    subject: "japanese",
    text: "「美しい」の品詞はどれですか？",
    choices: ["動詞", "名詞", "形容詞", "接続詞"],
    correct: 2,
    explanation: "「美しい」は様子を表す形容詞です。"
  },
  {
    id: "jp_004",
    subject: "japanese",
    text: "「川」の訓読みはどれですか？",
    choices: ["セン", "かわ", "やま", "うみ"],
    correct: 1,
    explanation: "「川」の訓読みは「かわ」です。"
  },
  {
    id: "jp_005",
    subject: "japanese",
    text: "文の終わりにつける記号として正しいものはどれですか？",
    choices: ["、", "。", "・", "「"],
    correct: 1,
    explanation: "日本語の文の終わりには句点「。」を使います。"
  },

  // 数学
  {
    id: "math_001",
    subject: "math",
    text: "7 × 8 はいくつですか？",
    choices: ["54", "56", "58", "64"],
    correct: 1,
    explanation: "7 × 8 = 56 です。"
  },
  {
    id: "math_002",
    subject: "math",
    text: "12 + 35 はいくつですか？",
    choices: ["37", "45", "47", "57"],
    correct: 2,
    explanation: "12 + 35 = 47 です。"
  },
  {
    id: "math_003",
    subject: "math",
    text: "半径3cmの円の直径は何cmですか？",
    choices: ["3cm", "6cm", "9cm", "12cm"],
    correct: 1,
    explanation: "直径は半径の2倍なので、3 × 2 = 6cmです。"
  },
  {
    id: "math_004",
    subject: "math",
    text: "100 - 37 はいくつですか？",
    choices: ["53", "63", "67", "73"],
    correct: 1,
    explanation: "100 - 37 = 63 です。"
  },
  {
    id: "math_005",
    subject: "math",
    text: "三角形の内角の和は何度ですか？",
    choices: ["90度", "120度", "180度", "360度"],
    correct: 2,
    explanation: "三角形の内角の和は180度です。"
  },

  // 英語
  {
    id: "en_001",
    subject: "english",
    text: "「りんご」を英語で表すとどれですか？",
    choices: ["apple", "orange", "banana", "grape"],
    correct: 0,
    explanation: "「りんご」は英語で apple です。"
  },
  {
    id: "en_002",
    subject: "english",
    text: "「走る」を英語で表すとどれですか？",
    choices: ["walk", "run", "read", "sleep"],
    correct: 1,
    explanation: "「走る」は英語で run です。"
  },
  {
    id: "en_003",
    subject: "english",
    text: "“I am a student.” の意味はどれですか？",
    choices: ["私は先生です", "私は学生です", "あなたは学生です", "彼は学生です"],
    correct: 1,
    explanation: "I は「私」、student は「学生」です。"
  },
  {
    id: "en_004",
    subject: "english",
    text: "「犬」を英語で表すとどれですか？",
    choices: ["cat", "dog", "bird", "fish"],
    correct: 1,
    explanation: "「犬」は英語で dog です。"
  },
  {
    id: "en_005",
    subject: "english",
    text: "“Good morning.” の意味はどれですか？",
    choices: ["こんばんは", "おはよう", "さようなら", "ありがとう"],
    correct: 1,
    explanation: "Good morning. は「おはよう」です。"
  },

  // 理科
  {
    id: "sci_001",
    subject: "science",
    text: "水が氷になることを何といいますか？",
    choices: ["蒸発", "凝固", "融解", "沸騰"],
    correct: 1,
    explanation: "液体が固体になることを凝固といいます。"
  },
  {
    id: "sci_002",
    subject: "science",
    text: "植物が光を使って養分を作るはたらきはどれですか？",
    choices: ["呼吸", "光合成", "蒸発", "分解"],
    correct: 1,
    explanation: "植物が光を使って養分を作るはたらきは光合成です。"
  },
  {
    id: "sci_003",
    subject: "science",
    text: "地球のまわりを回っている自然の衛星はどれですか？",
    choices: ["太陽", "月", "火星", "金星"],
    correct: 1,
    explanation: "地球の自然の衛星は月です。"
  },
  {
    id: "sci_004",
    subject: "science",
    text: "空気中に一番多く含まれている気体はどれですか？",
    choices: ["酸素", "窒素", "二酸化炭素", "水素"],
    correct: 1,
    explanation: "空気中に最も多い気体は窒素です。"
  },
  {
    id: "sci_005",
    subject: "science",
    text: "磁石に強く引きつけられるものはどれですか？",
    choices: ["木", "鉄", "紙", "ガラス"],
    correct: 1,
    explanation: "鉄は磁石に強く引きつけられます。"
  },

  // 社会
  {
    id: "soc_001",
    subject: "social",
    text: "日本の首都はどこですか？",
    choices: ["大阪", "京都", "東京", "札幌"],
    correct: 2,
    explanation: "日本の首都は東京です。"
  },
  {
    id: "soc_002",
    subject: "social",
    text: "日本で一番高い山はどれですか？",
    choices: ["富士山", "阿蘇山", "筑波山", "高尾山"],
    correct: 0,
    explanation: "日本で一番高い山は富士山です。"
  },
  {
    id: "soc_003",
    subject: "social",
    text: "昔の日本で、武士の政治が行われた政府を何といいますか？",
    choices: ["朝廷", "幕府", "国会", "役所"],
    correct: 1,
    explanation: "武士による政治の政府を幕府といいます。"
  },
  {
    id: "soc_004",
    subject: "social",
    text: "日本の国会は何をするところですか？",
    choices: ["法律を作る", "天気を決める", "道路を掃除する", "学校を建てるだけ"],
    correct: 0,
    explanation: "国会は法律を作る国の機関です。"
  },
  {
    id: "soc_005",
    subject: "social",
    text: "都道府県の数はいくつですか？",
    choices: ["37", "43", "47", "50"],
    correct: 2,
    explanation: "日本の都道府県は47です。"
  }
];

module.exports = {
  BATTLE_SUBJECTS,
  battleQuestions
};