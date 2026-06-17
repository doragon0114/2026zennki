## 概要
Node.js + MySQL + Ollama のDocker環境を構築しました

## 環境
- Node.js 20
- MySQL 8.0
- Ollama (qwen2.5:3b)

## チームメンバーの起動手順
1. `.env` ファイルを作成（内容は別途共有）
2. `docker-compose up -d` を実行
3. `docker compose exec ollama ollama pull qwen2.5:3b`を実行
4. `http://localhost:3000` にアクセス

## ollama確認方法
1. 'http://localhost:3000/ollama-test.html'

## Mysqlのテストデータ
cmd /c "docker compose exec -T mysql mysql --default-character-set=utf8mb4 -u dbuser -pecc Revino < memo.sql"        




SET NAMES utf8mb4;

USE Revino;

START TRANSACTION;

-- ============================================================
-- 1. 回答・学習結果系を削除
-- ============================================================

DELETE FROM answers;

DELETE FROM results;

-- ============================================================
-- 2. 問題タグ関連を削除
-- ============================================================

DELETE FROM question_question_tags;

DELETE FROM question_tags;

-- ============================================================
-- 3. 選択肢を削除
-- ============================================================

DELETE FROM question_choices;

-- ============================================================
-- 4. 問題本体を削除
-- ============================================================

DELETE FROM question;

-- ============================================================
-- 5. 問題セットを削除
-- ============================================================

DELETE FROM materials;

COMMIT;

-- ============================================================
-- 6. 確認用
-- ============================================================

SELECT 'answers' AS table_name, COUNT(*) AS count FROM answers
UNION ALL
SELECT 'results', COUNT(*) FROM results
UNION ALL
SELECT 'question_question_tags', COUNT(*) FROM question_question_tags
UNION ALL
SELECT 'question_tags', COUNT(*) FROM question_tags
UNION ALL
SELECT 'question_choices', COUNT(*) FROM question_choices
UNION ALL
SELECT 'question', COUNT(*) FROM question
UNION ALL
SELECT 'materials', COUNT(*) FROM materials;

