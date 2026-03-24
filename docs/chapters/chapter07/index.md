---
layout: book
title: "第7章：AI支援によるコードレビュー実践"
---

# 第7章：AI支援によるコードレビュー実践

## 7.1 第2章のPRテンプレートを使った実装

### この章で扱う「AIレビュー」の前提
この章では、GitHub Copilotの **code review（PRレビュー支援）** を中心に扱います。AIレビューは有効ですが、誤検知/見落としがあり得るため、最終判断と責任は人間側に残します。

### この章の例の読み方
本章では、例を次の2種類に分けて示します。

- **実運用例（このまま使える）**：`examples/` 配下にあるファイル（Issue/PRテンプレート、`copilot-instructions.md` 等）。必要に応じて自分のリポジトリ事情に合わせて調整して使います。
- **概念例（擬似）**：考え方を説明するための例。GitHubの実設定や実行環境と一致しない場合があるため、コピペ前提では扱いません。

### 再現性を上げるために、先に揃えるもの
AIレビューを「運用」に落とすには、レビューの前提を成果物として固定するのが効果的です。

- **PRテンプレート**：目的・影響範囲・テスト・ロールバック・AI利用開示・受入条件
- **カスタム指示**：リポジトリの規約・禁止事項・レビュー観点を`copilot-instructions.md`に集約
- **チェックリスト**：セキュリティ/運用/互換性など、AIが見落としやすい観点を人間の確認項目として明文化

以下のサンプルは `examples/ai-agent-starter/` に同梱しています（そのままコピーして使える形）。

### PRテンプレート例（抜粋）
```markdown
## 目的
- 何を直す/追加するか：
- 期待するユーザー影響：

## 変更内容（概要）
- 

## 影響範囲
- 影響する：
- 影響しない：

## 検証
- 自動テスト：
- 手動確認：

## ロールバック
- 失敗時の戻し方：

## AI利用の開示（必須）
- AI利用：有 / 無
- 利用範囲：下書き/実装/レビュー補助 など
- 人間が最終確認した観点：

## 受入条件（Issue）
- Closes #<issue-number>
```

### `.github/copilot-instructions.md` 例（抜粋）
```markdown
## Repository rules (must follow)
- 変更は小さく、意図が分かる単位でPRを作る
- 既存の規約（命名、ディレクトリ構成、lint）を優先する
- 秘密情報・個人情報を出力しない

## Review focus
- 仕様/受入条件との整合
- セキュリティ（`security-checklist.md` を参照）
- 破壊的変更の有無とロールバック手順
```

### 有効化・設定（公式手順への参照）
Copilotのcode reviewは、プランや組織設定によって利用可否が変わります。設定手順は変更され得るため、公式ドキュメントを参照してください。

- [Copilot code review](https://docs.github.com/en/copilot/concepts/agents/code-review)
- [Using Copilot code review](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review)
- [Custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)

## 7.2 自動レビューコメントの活用

### 重要：誤検知/見落としを前提に扱う
AIレビューは「気づきの補助」です。次の2点を前提に、運用として扱います。

- **誤検知（false positive）**：問題に見えるが問題ではない指摘が混ざる → 受入条件/仕様/一次情報に戻って判断する
- **見落とし（false negative）**：問題があるのに指摘されないことがある → テスト/静的解析/人間レビューの責務で担保する

### レビューコメントの種類
以下は、Copilotが出し得るコメントの「イメージ」を示す概念例です。実際の指摘内容や文言は環境や更新によって変わり得ます。

#### 1. セキュリティ指摘
````python
# PR内のコード
def connect_to_database(password):
    conn_string = f"postgresql://user:{password}@localhost/db"
    return psycopg2.connect(conn_string)

# Copilotのコメント
"""
🔒 Security Issue: SQL接続文字列にパスワードを直接埋め込むのは
セキュリティリスクがあります。環境変数や設定ファイルの使用を検討してください。

Suggested fix:
```python
def connect_to_database():
    password = os.environ.get('DB_PASSWORD')
    conn_string = f"postgresql://user:{password}@localhost/db"
    return psycopg2.connect(conn_string)
```
"""
````

#### 2. パフォーマンス改善
````python
# PR内のコード
def process_images(image_list):
    results = []
    for img in image_list:
        processed = cv2.resize(img, (224, 224))
        results.append(processed)
    return results

# Copilotのコメント
"""
⚡ Performance: リスト内包表記またはNumPy配列の事前割り当てを使用すると
パフォーマンスが向上する可能性があります。

Suggested optimization:
```python
def process_images(image_list):
    return [cv2.resize(img, (224, 224)) for img in image_list]
    
# または大量の画像の場合:
def process_images_batch(image_list):
    results = np.empty((len(image_list), 224, 224, 3), dtype=np.uint8)
    for i, img in enumerate(image_list):
        results[i] = cv2.resize(img, (224, 224))
    return results
```
"""
````

#### 3. コードスタイル
````python
# PR内のコード
def calculate_metrics(y_true,y_pred,threshold = 0.5):
    tp=np.sum((y_true==1)&(y_pred>=threshold))
    return tp

# Copilotのコメント
"""
📝 Style: PEP 8準拠のためのフォーマット改善を推奨します。

Suggested style improvements:
```python
def calculate_metrics(y_true, y_pred, threshold=0.5):
    """Calculate true positives for binary classification."""
    tp = np.sum((y_true == 1) & (y_pred >= threshold))
    return tp
```
- スペースの追加
- docstringの追加
- 意味のある変数名の使用を検討
"""
````

### コメントへの対応方法

#### インライン返信
```markdown
# 開発者の返信例

ご指摘ありがとうございます。セキュリティの観点は重要なので、環境変数を使用するように修正しました（commit: abc123）。

また、設定ファイルのサンプルも追加しました。
```

#### 一括対応
```text
# Copilotの複数の指摘に対して
"""
## 対応内容
1. ✅ セキュリティ: 環境変数に変更 (commit: abc123)
2. ✅ パフォーマンス: バッチ処理実装 (commit: def456)
3. ⏸️ スタイル: 次のPRで対応予定 (issue #123)
"""
```

#### レビューコメント対応テンプレ（最小）

レビュー対応の要点がコメント欄に残ると、再レビューと引き継ぎが速くなります。

```markdown
## レビューコメント対応（まとめ）

- 対応内容: <何を変えたか>
- 対応コミット: <commit: <hash> または PR の差分リンク>
- 影響/リスク: <互換性/運用影響。なければ「なし」>
- 追加検証: <実施したテスト/手動確認>
- 未対応: <理由> / <追跡Issue: #...> / <再確認タイミング>
- 要確認: <レビュアーに確認したい点>
```

## 7.3 人間のレビューとAIレビューの使い分け

### レビューの役割分担

#### AIレビューが得意な領域
1. **構文とスタイル**
   - PEP 8, ESLint準拠
   - 命名規則
   - インデント、空白

2. **一般的なパターン**
   - よくあるバグパターン
   - セキュリティのアンチパターン
   - パフォーマンスの問題

3. **定量的な分析**
   - 複雑度の計算
   - テストカバレッジ
   - 依存関係の分析

#### 人間のレビューが必要な領域
1. **ビジネスロジック**
   - 要件との整合性
   - ドメイン知識
   - エッジケースの考慮

2. **アーキテクチャ**
   - 設計の妥当性
   - 将来の拡張性
   - 技術選定

3. **コンテキスト**
   - プロジェクトの経緯
   - チームの慣習
   - 技術的負債

### ハイブリッドレビューワークフロー

```mermaid
graph LR
    A[PR作成] --> B[（任意）Copilot code review]
    B --> C[人間レビュー（仕様/リスク判断）]
    C --> D[CI（テスト/静的解析）]
    D --> E{要修正?}
    E -->|Yes| F[修正→再レビュー]
    E -->|No| G[承認→マージ]
```

### レビュー優先順位の設定

以下は「考え方」を示す**概念例**です。実際に強制する場合は、rulesets/branch protection とCODEOWNERS（必要な承認者/必要なチェック）で表現します。

```yaml
# .github/review-priority.yml
priority_rules:
  critical:
    - path: "src/security/**"
    - path: "src/payment/**"
    - keyword: ["password", "token", "secret"]
    requires:
      - human_review: 2  # 2人の人間レビュー必須
      - ai_review: "detailed"
      
  standard:
    - path: "src/**"
    requires:
      - human_review: 1
      - ai_review: "standard"
      
  low:
    - path: "tests/**"
    - path: "docs/**"
    requires:
      - human_review: 0  # 任意
      - ai_review: "basic"
```

## 7.4 セキュリティは「AIレビュー + 静的解析 + ルール」で担保する

Copilotのレビューは、セキュリティ観点の気づきに役立つことがありますが、**セキュリティ検査の代替ではありません**。止めたいリスクは、CI（静的解析/テスト）と運用ルールで担保します。

### 静的解析（CodeQL等）との役割分担（概要）
- **Copilot code review**：差分の読みやすさ、一般的なアンチパターン、レビュー観点の補助
- **CI（テスト/静的解析）**：規約違反・既知パターンの検出、ブロッキング（必須チェック）
- **人間レビュー**：仕様/受入条件、トレードオフ、リスク許容、ロールバック判断

静的解析の詳細は、第8章（GitHub Advanced Security）を参照してください。

### セキュリティのレビュー観点（例）
以下は「見落としやすい典型例」です。AIが指摘しない場合もあるため、チェックリスト化して人間の責務として残します。

#### 1. インジェクション（例）
```python
# 脆弱になり得る例（文字列連結）
def search_users(query):
    sql = f"SELECT * FROM users WHERE name = '{query}'"
    return db.execute(sql)

# 対応例（パラメータ化）
def search_users_safe(query):
    sql = "SELECT * FROM users WHERE name = ?"
    return db.execute(sql, (query,))
```

#### 2. 認証・認可（例）
```python
# 脆弱になり得る例（認可チェックの抜け）
@app.route('/admin/users')
def admin_users():
    return render_template('admin_users.html', users=get_all_users())
```

#### 3. 機密情報の露出（例）
```python
# 脆弱になり得る例（ログへの機密出力）
logger.info(f"User login attempt: {username}, password: {password}")
```

### セキュリティ観点のサマリーを残す（例）
AIレビュー/人間レビュー/CIの結果を混ぜず、**一次情報（CI結果や根拠リンク）**に寄せてPRに残します。

```markdown
## Security review summary（例）

- CI（CodeQL等）の結果：リンク/結果
- 追加で確認した観点：auth、入力検証、ログ、依存関係 など
- リスクと受容判断：この変更で受けるリスク/避けるリスク
- ロールバック：戻し方、影響範囲
```

## 7.5 クォータ/コストを踏まえた運用設計

Copilotのcode reviewは、プランや組織設定によってクォータ等の制約があります。全PRに無条件で適用する前提ではなく、対象を選ぶ運用が現実的です。

### どのPRでAIレビューを使うか（例）
- **優先（高リスク）**：認証/認可、暗号、決済、権限、ネットワーク境界、データ移行、運用手順の変更
- **選択（中リスク）**：主要な仕様変更、パフォーマンス影響が大きい変更、依存関係の更新
- **省略（低リスク）**：誤字修正、コメント整形、単純なリファクタ（ただし例外あり）

### クォータ枯渇/失敗時の代替フロー
1. まずCI（必須チェック）を優先する（テスト/静的解析）
2. 人間レビューで「受入条件」と「リスク」を先に確定する
3. AIレビューは「使えるときに、観点補助として追加」する（前提が逆転しないようにする）

### 最小の運用指標（例）
定量は「断定値」ではなく、改善サイクルの材料として扱います。

- 初回レビューまでの時間（Time to first review）
- 修正ラウンド数（レビュー→修正→再レビュー）
- 重大指摘の流入元（人間/AI/CIのどれで検出されたか）
- ロールバック発生の有無（リスク判断の妥当性）

## まとめ

本章の要点は次のとおりです。
- Copilot code review は「気づきの補助」であり、最終判断と責任は人間側に残る
- 再現性は、PRテンプレ・カスタム指示・チェックリストで担保する
- セキュリティはAIレビューだけに依存せず、CI（静的解析/テスト）とルールで担保する
- クォータ等の制約を前提に、AIレビューを使うPRを選ぶ

次章（第8章）では、GitHub Advanced Securityによる静的解析・セキュリティ運用を扱います。

## 確認事項

- [ ] 章の冒頭で示した「テンプレ/指示/チェックリスト」の役割を説明できる
- [ ] 誤検知/見落としを前提に、AIレビューの結果を扱える
- [ ] セキュリティはCIと運用ルールで担保する設計にできる
- [ ] クォータ等の制約を前提に、AIレビューの適用範囲を決められる
