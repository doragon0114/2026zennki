-- 問題のテストデータ
-- materialsのuser_idに登録してあるuser_idを入れる

SET NAMES utf8mb4;

USE Revino;

START TRANSACTION;

-- ============================================================
-- 1. カテゴリ：数学
-- 既存に「数学」があっても category_id を cat_math にそろえる
-- ============================================================

INSERT INTO categories (
  category_id,
  category_name
)
VALUES (
  'cat_math',
  '数学'
)
ON DUPLICATE KEY UPDATE
  category_id = VALUES(category_id),
  category_name = VALUES(category_name);


-- ============================================================
-- 2. 問題セット：数学のみ
-- user_id は自分の実在する user_id に書き換える
-- ============================================================

INSERT INTO materials (
  material_id,
  user_id,
  category_id,
  material_name,
  image_text,
  is_shared
)
VALUES (
  'mat_math_mock',
  'user_510d1925cb',
  'cat_math',
  '数学 基礎問題集',
  '数学の基礎計算、方程式、図形、分数に関する問題です。',
  0
)
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  category_id = VALUES(category_id),
  material_name = VALUES(material_name),
  image_text = VALUES(image_text),
  is_shared = VALUES(is_shared),
  updated_at = NOW();


-- ============================================================
-- 3. 数学の問題 5問
-- ============================================================

INSERT INTO question (
  question_id,
  material_id,
  question_text,
  explanation
)
VALUES
  (
    'q_math_001',
    'mat_math_mock',
    '23 + 17 はいくつですか？',
    '23 + 17 = 40です。'
  ),
  (
    'q_math_002',
    'mat_math_mock',
    '9 × 6 はいくつですか？',
    '9を6回足すと54になるため、答えは54です。'
  ),
  (
    'q_math_003',
    'mat_math_mock',
    '方程式 x + 5 = 12 の x はいくつですか？',
    '両辺から5を引くと、x = 7になります。'
  ),
  (
    'q_math_004',
    'mat_math_mock',
    '三角形の内角の和は何度ですか？',
    '三角形の3つの内角を足すと、常に180度になります。'
  ),
  (
    'q_math_005',
    'mat_math_mock',
    '1/2 + 1/4 はいくつですか？',
    '1/2を2/4に直すと、2/4 + 1/4 = 3/4です。'
  )
ON DUPLICATE KEY UPDATE
  material_id = VALUES(material_id),
  question_text = VALUES(question_text),
  explanation = VALUES(explanation),
  updated_at = NOW();


-- ============================================================
-- 4. 数学の選択肢
-- ============================================================

INSERT INTO question_choices (
  choice_id,
  question_id,
  choice_label,
  choice_text,
  is_correct
)
VALUES
  ('choice_math_001_A', 'q_math_001', 'A', '30', 0),
  ('choice_math_001_B', 'q_math_001', 'B', '35', 0),
  ('choice_math_001_C', 'q_math_001', 'C', '40', 1),
  ('choice_math_001_D', 'q_math_001', 'D', '45', 0),

  ('choice_math_002_A', 'q_math_002', 'A', '45', 0),
  ('choice_math_002_B', 'q_math_002', 'B', '54', 1),
  ('choice_math_002_C', 'q_math_002', 'C', '56', 0),
  ('choice_math_002_D', 'q_math_002', 'D', '63', 0),

  ('choice_math_003_A', 'q_math_003', 'A', '7', 1),
  ('choice_math_003_B', 'q_math_003', 'B', '5', 0),
  ('choice_math_003_C', 'q_math_003', 'C', '12', 0),
  ('choice_math_003_D', 'q_math_003', 'D', '17', 0),

  ('choice_math_004_A', 'q_math_004', 'A', '90度', 0),
  ('choice_math_004_B', 'q_math_004', 'B', '270度', 0),
  ('choice_math_004_C', 'q_math_004', 'C', '360度', 0),
  ('choice_math_004_D', 'q_math_004', 'D', '180度', 1),

  ('choice_math_005_A', 'q_math_005', 'A', '1/4', 0),
  ('choice_math_005_B', 'q_math_005', 'B', '1/2', 0),
  ('choice_math_005_C', 'q_math_005', 'C', '1', 0),
  ('choice_math_005_D', 'q_math_005', 'D', '3/4', 1)
ON DUPLICATE KEY UPDATE
  choice_label = VALUES(choice_label),
  choice_text = VALUES(choice_text),
  is_correct = VALUES(is_correct);

COMMIT;


-- ============================================================
-- 5. 確認用
-- ============================================================

SELECT
  category_id,
  category_name
FROM categories;

SELECT
  m.material_id,
  m.material_name,
  m.category_id,
  c.category_name,
  COUNT(q.question_id) AS question_count
FROM materials m
LEFT JOIN categories c
  ON m.category_id = c.category_id
LEFT JOIN question q
  ON m.material_id = q.material_id
WHERE m.material_id = 'mat_math_mock'
GROUP BY
  m.material_id,
  m.material_name,
  m.category_id,
  c.category_name;

SELECT
  q.question_id,
  q.question_text,
  qc.choice_label,
  qc.choice_text,
  qc.is_correct
FROM question q
LEFT JOIN question_choices qc
  ON q.question_id = qc.question_id
WHERE q.material_id = 'mat_math_mock'
ORDER BY
  q.question_id,
  qc.choice_label;