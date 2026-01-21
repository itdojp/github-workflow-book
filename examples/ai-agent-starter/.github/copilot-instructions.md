# Copilot instructions（サンプル）

このファイルは、Copilot（chat / code review / agent）に対するリポジトリ共通の指示です。プロジェクト固有の情報に合わせて編集してください。

## Repository rules（must follow）

- 変更は小さく、意図が分かる単位でPRを作る
- 既存の規約（命名、ディレクトリ構成、lint）を優先する
- 既存のコードスタイルに合わせ、無関係な整形は避ける
- 秘密情報・個人情報を出力しない（Issue/PR本文にも含めない）
- 不明点は推測で断定せず、Issue/PRで「要確認」として質問する

## Build/Test

- 可能なら既存のテスト/リントを実行し、結果をPRに記載する
- 実行コマンドが不明な場合は、リポジトリ内の手順（README/CONTRIBUTING等）を探し、見つからなければ質問する

## Review focus

- 仕様/受入条件との整合
- セキュリティ（`security-checklist.md` を参照）
- 破壊的変更の有無とロールバック手順
