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

## docker内のMyssql入り方
docker compose exec mysql bash