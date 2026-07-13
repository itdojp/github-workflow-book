---
layout: book
title: "独立チェックリスト集"
---

# 独立チェックリスト集

この付録は、章内に点在する確認事項を実運用の目的別に再編したものです。各項目は未実施の確認作業として扱います。章内のコードブロックや設定例は、実施済みを示すものではありません。

## 準備

- [ ] 対象リポジトリ、責任者、利用するGitHubアカウントまたは組織を確認した。根拠: [第1章](../../chapters/chapter01/)、[第5章](../../chapters/chapter05/)
- [ ] Gitのユーザー設定、認証方法、必要な開発環境をプロジェクトのルールに合わせた。根拠: [第3章](../../chapters/chapter03/)
- [ ] 機密情報、学習データ、ライセンスの扱いを公開前に確認した。根拠: [第5章](../../chapters/chapter05/)、[第17章](../../chapters/chapter17/)、[付録G](../appendix-g/)

## Issue と計画

- [ ] Issueに目的、受入基準、制約、変更禁止領域を記録した。根拠: [第2章](../../chapters/chapter02/)、[第4章](../../chapters/chapter04/)
- [ ] 影響範囲、検証方法、ロールバック方針を作業開始前に合意した。根拠: [第2章](../../chapters/chapter02/)、[第11章](../../chapters/chapter11/)
- [ ] AI支援を使う場合は、入力可能な情報と人間の確認責任を明確にした。根拠: [第2章](../../chapters/chapter02/)、[第6章](../../chapters/chapter06/)

## ブランチとコミット

- [ ] 変更目的に対応する短命ブランチを作成し、mainへの直接変更を避けた。根拠: [第1章](../../chapters/chapter01/)、[第12章](../../chapters/chapter12/)
- [ ] コミットをレビュー可能な単位に分け、意図と検証結果を説明できる状態にした。根拠: [第1章](../../chapters/chapter01/)、[第3章](../../chapters/chapter03/)
- [ ] 実験、release、不要になったブランチの扱いをチームで定義した。根拠: [第12章](../../chapters/chapter12/)

## Pull Request とレビュー

- [ ] PRに変更内容、影響範囲、検証、ロールバック、AI利用の有無を記載した。根拠: [第2章](../../chapters/chapter02/)、[第7章](../../chapters/chapter07/)
- [ ] 人間が仕様、リスク、セキュリティ上の判断を確認し、AIレビューだけで承認しない。根拠: [第7章](../../chapters/chapter07/)
- [ ] CODEOWNERS、必須レビュアー、承認条件が対象変更に適用されることを確認した。根拠: [第9章](../../chapters/chapter09/)

## CI/CD

- [ ] 必須テスト、静的解析、依存関係確認をPRの品質ゲートとして実行した。根拠: [第7章](../../chapters/chapter07/)、[第13章](../../chapters/chapter13/)
- [ ] デプロイ対象環境、承認者、Secretsの参照範囲を確認した。根拠: [第11章](../../chapters/chapter11/)、[第13章](../../chapters/chapter13/)
- [ ] 失敗時の停止、再実行、ロールバックの手順を検証可能な形で残した。根拠: [第11章](../../chapters/chapter11/)、[付録B](../appendix-b/)

## セキュリティ

- [ ] トークン、パスワード、個人情報、機密データをコード、ログ、Issue、PRへ含めていない。根拠: [第8章](../../chapters/chapter08/)、[第11章](../../chapters/chapter11/)
- [ ] 入力検証、認証・認可、依存関係更新、破壊的変更のリスクを確認した。根拠: [第7章](../../chapters/chapter07/)、[第8章](../../chapters/chapter08/)
- [ ] Secret scanning、code scanning、dependency reviewの結果を確認し、例外があれば記録した。根拠: [第8章](../../chapters/chapter08/)

## 組織・大規模運用

- [ ] 組織、チーム、リポジトリの権限継承と直接付与を監査した。根拠: [第9章](../../chapters/chapter09/)、[第10章](../../chapters/chapter10/)
- [ ] Outside Collaborator、SAML SSO、監査ログの運用を組織ポリシーと照合した。根拠: [第10章](../../chapters/chapter10/)
- [ ] 大規模データ、モデル、外部協力者、コンプライアンスの責任分界を確認した。根拠: [第14章](../../chapters/chapter14/)、[第16章](../../chapters/chapter16/)、[第17章](../../chapters/chapter17/)

## 関連資料

次の資料はリポジトリ内の導入例であり、この公開チェックリストの実施済み項目ではありません。対象リポジトリの公開範囲と運用文脈を確認したうえで参照してください。

- <https://github.com/itdojp/github-workflow-book/blob/main/examples/ai-agent-starter/security-checklist.md> — AIエージェント向けSecurity checklist: AIレビューの見落としを前提に人間が確認する最小例。
- <https://github.com/itdojp/github-workflow-book/blob/main/examples/self-hosted-runner-ops-checklist/README.md> — self-hosted runner運用チェックリスト: trusted input、runner分離、ephemeral運用を扱う導入例。
