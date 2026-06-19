-- ==================================================
-- データベース作成
-- ==================================================
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS Revino
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE Revino;

-- ==================================================
-- ユーザー
-- ==================================================
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(80) PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  profile TEXT,
  avater VARCHAR(1),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE users
  ADD COLUMN point INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN battle_win_count INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN study_count INT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN question_count INT UNSIGNED NOT NULL DEFAULT 0;

-- ==================================================
-- ユーザータグ
-- 中間テーブルなし。
-- user_tags に user_id を直接保存する。
-- ==================================================
CREATE TABLE IF NOT EXISTS user_tags (
  user_tag_id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL,
  user_tag_name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user_tags_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  UNIQUE KEY uq_user_tag_name_per_user (user_id, user_tag_name),
  INDEX idx_user_tags_user_id (user_id)
);

-- ============================================================
-- 1. カテゴリ
-- 数学・国語・英語・理科・社会・基本情報など
-- category_id は数字で自動生成
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  category_id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (category_id),
  UNIQUE KEY uq_categories_category_name (category_name)
);


-- ============================================================
-- 2. 問題セット
-- 各ユーザーが自分の問題セットを持つ
-- category_id は categories.category_id を参照
-- ============================================================

CREATE TABLE IF NOT EXISTS materials (
  material_id VARCHAR(80) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL,
  category_id INT UNSIGNED NULL,
  material_name VARCHAR(255) NOT NULL,
  image_text TEXT,
  is_shared TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_materials_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_materials_category
    FOREIGN KEY (category_id)
    REFERENCES categories(category_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  INDEX idx_materials_user_id (user_id),
  INDEX idx_materials_category_id (category_id),
  INDEX idx_materials_shared (is_shared)
);


-- ============================================================
-- 3. 問題
-- 問題文と解説を保存
-- 選択肢は question_choices に保存
-- ============================================================

CREATE TABLE IF NOT EXISTS question (
  question_id VARCHAR(80) PRIMARY KEY,
  material_id VARCHAR(80) NOT NULL,
  question_text TEXT NOT NULL,
  explanation TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_questions_material
    FOREIGN KEY (material_id)
    REFERENCES materials(material_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  INDEX idx_questions_material_id (material_id)
);


-- ============================================================
-- 4. 問題の選択肢
-- A・B・C・Dを1行ずつ保存
-- is_correct = 1 が正解
-- ============================================================

CREATE TABLE IF NOT EXISTS question_choices (
  choice_id VARCHAR(100) PRIMARY KEY,
  question_id VARCHAR(80) NOT NULL,
  choice_label CHAR(1) NOT NULL,
  choice_text TEXT NOT NULL,
  is_correct TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_question_choices_question
    FOREIGN KEY (question_id)
    REFERENCES question(question_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT chk_question_choices_label
    CHECK (choice_label IN ('A', 'B', 'C', 'D')),

  UNIQUE KEY uq_question_choice_label (
    question_id,
    choice_label
  ),

  INDEX idx_question_choices_question_id (
    question_id
  )
);


-- ============================================================
-- 5. 問題タグ
-- 例：基礎、計算、足し算
-- ============================================================

CREATE TABLE IF NOT EXISTS question_tags (
  question_tag_id VARCHAR(80) PRIMARY KEY,
  question_tag_name VARCHAR(100) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- 6. 問題と問題タグの関連
-- 1問に複数のタグを付けられる
-- ============================================================

CREATE TABLE IF NOT EXISTS question_question_tags (
  question_id VARCHAR(80) NOT NULL,
  question_tag_id VARCHAR(80) NOT NULL,

  PRIMARY KEY (
    question_id,
    question_tag_id
  ),

  CONSTRAINT fk_question_question_tags_question
    FOREIGN KEY (question_id)
    REFERENCES question(question_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_question_question_tags_tag
    FOREIGN KEY (question_tag_id)
    REFERENCES question_tags(question_tag_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
);


-- ============================================================
-- 7. 演習結果
-- 1回の演習全体の結果
-- ============================================================

CREATE TABLE IF NOT EXISTS results (
  result_id VARCHAR(100) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL,
  material_id VARCHAR(80),
  correct_count INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  correct_rate INT NOT NULL DEFAULT 0,
  gained_points INT NOT NULL DEFAULT 0,
  started_at DATETIME NULL,
  finished_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_results_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_results_material
    FOREIGN KEY (material_id)
    REFERENCES materials(material_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  INDEX idx_results_user_id (user_id),
  INDEX idx_results_material_id (material_id),
  INDEX idx_results_created_at (created_at)
);


-- ============================================================
-- 8. 回答
-- ユーザーが各問題で選んだ選択肢
-- ============================================================

CREATE TABLE IF NOT EXISTS answers (
  answer_id VARCHAR(120) PRIMARY KEY,
  result_id VARCHAR(100) NOT NULL,
  question_id VARCHAR(80) NOT NULL,
  selected_choice_id VARCHAR(100),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_answers_result
    FOREIGN KEY (result_id)
    REFERENCES results(result_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_answers_question
    FOREIGN KEY (question_id)
    REFERENCES question(question_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  CONSTRAINT fk_answers_selected_choice
    FOREIGN KEY (selected_choice_id)
    REFERENCES question_choices(choice_id)
    ON UPDATE CASCADE
    ON DELETE SET NULL,

  INDEX idx_answers_result_id (result_id),
  INDEX idx_answers_question_id (question_id),
  INDEX idx_answers_selected_choice_id (selected_choice_id)
);

-- ============================================================
-- 9. 対戦履歴
-- 対戦終了後、プレイヤーごとに1行ずつ保存する
-- ============================================================

CREATE TABLE IF NOT EXISTS battle_history (
  battle_history_id VARCHAR(120) PRIMARY KEY,
  room_id VARCHAR(80) NOT NULL,

  user_id VARCHAR(80) NOT NULL,
  player_name VARCHAR(100) NOT NULL,

  opponent_user_id VARCHAR(80),
  opponent_name VARCHAR(100) NOT NULL,
  opponent_avatar VARCHAR(10) DEFAULT '🤖',

  result ENUM('win', 'lose', 'draw') NOT NULL,
  my_score INT NOT NULL DEFAULT 0,
  opp_score INT NOT NULL DEFAULT 0,
  pts INT NOT NULL DEFAULT 0,

  subject VARCHAR(50) NOT NULL,
  age INT NOT NULL DEFAULT 0,

  battle_date VARCHAR(20),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_battle_history_user_id (user_id),
  INDEX idx_battle_history_room_id (room_id),
  INDEX idx_battle_history_created_at (created_at)
);

-- ============================================================
-- 学習カレンダー
-- ユーザーごと・日付ごとに学習した日を管理する
-- ============================================================

CREATE TABLE IF NOT EXISTS `calendar` (
  calendar_id VARCHAR(120) PRIMARY KEY,
  user_id VARCHAR(80) NOT NULL,
  activity_date DATE NOT NULL,

  study_count INT UNSIGNED NOT NULL DEFAULT 0,
  battle_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_points INT UNSIGNED NOT NULL DEFAULT 0,

  last_type VARCHAR(30),
  last_source_id VARCHAR(120),

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL
    DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_calendar_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,

  UNIQUE KEY uq_calendar_user_date (user_id, activity_date),
  INDEX idx_calendar_user_id (user_id),
  INDEX idx_calendar_activity_date (activity_date)
);

