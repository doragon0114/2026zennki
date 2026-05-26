const categories = [
  {
    categoryId: "cat_japanese",
    categoryName: "国語",
  },
  {
    categoryId: "cat_math",
    categoryName: "数学",
  },
  {
    categoryId: "cat_english",
    categoryName: "英語",
  },
  {
    categoryId: "cat_science",
    categoryName: "理科",
  },
  {
    categoryId: "cat_social",
    categoryName: "社会",
  },
];

const questionLists = [
  {
    questionListId: "ql_japanese_basic",
    categoryId: "cat_japanese",
  },
  {
    questionListId: "ql_math_basic",
    categoryId: "cat_math",
  },
  {
    questionListId: "ql_english_basic",
    categoryId: "cat_english",
  },
  {
    questionListId: "ql_science_basic",
    categoryId: "cat_science",
  },
  {
    questionListId: "ql_social_basic",
    categoryId: "cat_social",
  },
];

const questions = [
  {
    questionId: "q_jp_001",
    questionListId: "ql_japanese_basic",
    questionText: "「山」の音読みを答えてください。",
    answer: "サン",
  },
  {
    questionId: "q_jp_002",
    questionListId: "ql_japanese_basic",
    questionText: "「走る」の品詞を答えてください。",
    answer: "動詞",
  },
  {
    questionId: "q_jp_003",
    questionListId: "ql_japanese_basic",
    questionText: "「美しい」の品詞を答えてください。",
    answer: "形容詞",
  },

  {
    questionId: "q_math_001",
    questionListId: "ql_math_basic",
    questionText: "7 × 8 はいくつですか？",
    answer: "56",
  },
  {
    questionId: "q_math_002",
    questionListId: "ql_math_basic",
    questionText: "12 + 35 はいくつですか？",
    answer: "47",
  },
  {
    questionId: "q_math_003",
    questionListId: "ql_math_basic",
    questionText: "半径3cmの円の直径は何cmですか？",
    answer: "6",
  },

  {
    questionId: "q_en_001",
    questionListId: "ql_english_basic",
    questionText: "「りんご」を英語で答えてください。",
    answer: "apple",
  },
  {
    questionId: "q_en_002",
    questionListId: "ql_english_basic",
    questionText: "「走る」を英語で答えてください。",
    answer: "run",
  },
  {
    questionId: "q_en_003",
    questionListId: "ql_english_basic",
    questionText: "“I am a student.” の意味を答えてください。",
    answer: "私は学生です",
  },

  {
    questionId: "q_sci_001",
    questionListId: "ql_science_basic",
    questionText: "水が氷になることを何といいますか？",
    answer: "凝固",
  },
  {
    questionId: "q_sci_002",
    questionListId: "ql_science_basic",
    questionText: "植物が光を使って養分を作るはたらきを何といいますか？",
    answer: "光合成",
  },
  {
    questionId: "q_sci_003",
    questionListId: "ql_science_basic",
    questionText: "地球のまわりを回っている自然の衛星は何ですか？",
    answer: "月",
  },

  {
    questionId: "q_soc_001",
    questionListId: "ql_social_basic",
    questionText: "日本の首都はどこですか？",
    answer: "東京",
  },
  {
    questionId: "q_soc_002",
    questionListId: "ql_social_basic",
    questionText: "日本で一番高い山は何ですか？",
    answer: "富士山",
  },
  {
    questionId: "q_soc_003",
    questionListId: "ql_social_basic",
    questionText: "昔の日本で、武士の政治が行われた政府を何といいますか？",
    answer: "幕府",
  },
];

const answerLists = [];

const correctIds = [];

module.exports = {
  categories,
  questionLists,
  questions,
  answerLists,
  correctIds,
};