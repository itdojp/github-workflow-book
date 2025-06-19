#!/bin/bash

# デプロイスクリプト
# プライベートリポジトリからパブリックリポジトリ（または GitHub Pages）へデプロイ

set -e # エラーで停止

# エラーハンドリング機能
declare -A ERROR_CODES=(
    ["DEPLOY_INIT_FAILED"]="D001"
    ["BUILD_FAILED"]="D002"
    ["GIT_CLONE_FAILED"]="D003"
    ["GIT_PUSH_FAILED"]="D004"
    ["AUTH_FAILED"]="D005"
    ["DIRECTORY_NOT_FOUND"]="D006"
    ["UNKNOWN_ERROR"]="D999"
)

# ログレベル
declare -A LOG_LEVELS=(
    ["DEBUG"]=0
    ["INFO"]=1
    ["WARN"]=2
    ["ERROR"]=3
)

# 現在のログレベル（環境変数で制御）
CURRENT_LOG_LEVEL=${LOG_LEVEL:-1}

# エラー記録配列
declare -a ERROR_LOG=()

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ログ関数
log_debug() {
    [[ ${LOG_LEVELS["DEBUG"]} -ge $CURRENT_LOG_LEVEL ]] && echo -e "${CYAN}[DEBUG]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" >&2
}

log_info() {
    [[ ${LOG_LEVELS["INFO"]} -ge $CURRENT_LOG_LEVEL ]] && echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    [[ ${LOG_LEVELS["WARN"]} -ge $CURRENT_LOG_LEVEL ]] && echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1" >&2
    ERROR_LOG+=("$(date '+%Y-%m-%d %H:%M:%S'): $1")
}

# エラーハンドリング関数
handle_error() {
    local exit_code=$1
    local line_number=$2
    local error_message=${3:-"不明なエラーが発生しました"}
    local error_code=${4:-"UNKNOWN_ERROR"}
    
    log_error "デプロイエラー [${ERROR_CODES[$error_code]}]: $error_message (行: $line_number)"
    
    # エラーレポート生成
    generate_error_report
    
    # クリーンアップ
    cleanup_on_error
    
    exit $exit_code
}

# エラートラップ設定
trap 'handle_error $? $LINENO "スクリプト実行中にエラーが発生しました"' ERR

# リトライ機能
retry_command() {
    local max_attempts=${1:-3}
    local delay=${2:-1}
    local command="${@:3}"
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_debug "コマンド実行試行 $attempt/$max_attempts: $command"
        
        if eval "$command"; then
            log_debug "コマンドが成功しました: $command"
            return 0
        else
            local exit_code=$?
            if [ $attempt -eq $max_attempts ]; then
                log_error "コマンドが最大試行回数後に失敗しました: $command"
                return $exit_code
            else
                log_warn "コマンドが失敗しました。${delay}秒後にリトライします... ($attempt/$max_attempts)"
                sleep $delay
                attempt=$((attempt + 1))
                delay=$((delay * 2)) # 指数バックオフ
            fi
        fi
    done
}

# エラーレポート生成
generate_error_report() {
    if [ ${#ERROR_LOG[@]} -eq 0 ]; then
        return
    fi
    
    echo ""
    echo "====================================="
    echo "エラーレポート ($(date '+%Y-%m-%d %H:%M:%S'))"
    echo "====================================="
    
    for error in "${ERROR_LOG[@]}"; do
        echo "• $error"
    done
    
    echo ""
    echo "自動診断:"
    echo "-------------------------------------"
    
    # よくあるエラーパターンの診断
    local error_text=$(printf '%s\n' "${ERROR_LOG[@]}" | tr '[:upper:]' '[:lower:]')
    
    if echo "$error_text" | grep -q "permission denied\|認証"; then
        echo "• 認証エラーが発生している可能性があります"
        echo "  → GitHubトークンまたはSSHキーの設定を確認してください"
    fi
    
    if echo "$error_text" | grep -q "not found\|見つかりません"; then
        echo "• ファイルまたはディレクトリが見つかりません"
        echo "  → パスとファイルの存在を確認してください"
    fi
    
    if echo "$error_text" | grep -q "network\|connection\|ネットワーク"; then
        echo "• ネットワーク接続の問題が発生している可能性があります"
        echo "  → インターネット接続とGitHubの状態を確認してください"
    fi
    
    echo ""
}

# クリーンアップ処理
cleanup_on_error() {
    log_info "エラー時のクリーンアップ処理を実行中..."
    
    # 一時ファイルの削除など必要に応じて追加
    if [ -n "${TEMP_FILES:-}" ]; then
        log_debug "一時ファイルを削除中: $TEMP_FILES"
        rm -f $TEMP_FILES 2>/dev/null || true
    fi
    
    log_info "クリーンアップ処理完了"
}

log_info "🚀 デプロイプロセスを開始します..."

# 設定読み込み関数
load_deploy_config() {
    local config_file="$(cd "$(dirname "$0")/.." && pwd)/.deploy-config.json"
    
    if [ -f "$config_file" ]; then
        # jq が利用可能な場合
        if command -v jq >/dev/null 2>&1; then
            PUBLIC_REPO_CONFIG=$(jq -r '.publicRepo // ""' "$config_file")
            DEPLOY_BRANCH_CONFIG=$(jq -r '.deployBranch // "gh-pages"' "$config_file")
            BUILD_DIR_CONFIG=$(jq -r '.buildDir // "public"' "$config_file")
        else
            # jq が利用できない場合は grep で簡易パース
            PUBLIC_REPO_CONFIG=$(grep -o '"publicRepo"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" | sed 's/.*"publicRepo"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
            DEPLOY_BRANCH_CONFIG=$(grep -o '"deployBranch"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" | sed 's/.*"deployBranch"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
            BUILD_DIR_CONFIG=$(grep -o '"buildDir"[[:space:]]*:[[:space:]]*"[^"]*"' "$config_file" | sed 's/.*"buildDir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
        fi
    fi
}

# .env ファイルの読み込み
load_env_file() {
    local env_file="$(cd "$(dirname "$0")/.." && pwd)/.env"
    
    if [ -f "$env_file" ]; then
        # .env ファイルから環境変数を読み込み
        set -a  # 変数を自動的にエクスポート
        source "$env_file"
        set +a
    fi
}

# 設定の初期化
PRIVATE_REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

log_debug "設定値を読み込みました" 
log_debug "  PRIVATE_REPO_DIR: $PRIVATE_REPO_DIR"
log_debug "  DEPLOY_BRANCH: $DEPLOY_BRANCH"
log_debug "  BUILD_DIR: $BUILD_DIR"

# GitHub Actions環境でのトークン自動設定
if [ -n "${GITHUB_ACTIONS:-}" ] && [ -n "${GITHUB_TOKEN:-}" ] && [ -z "${DEPLOY_TOKEN:-}" ]; then
    log_info "GitHub Actions環境: GITHUB_TOKENを認証に使用します"
    DEPLOY_TOKEN="${GITHUB_TOKEN}"
fi

# リポジトリURLの設定（優先順位付き）
if [ -n "${PUBLIC_REPO_URL:-}" ]; then
    # 環境変数が設定されている場合（最優先）
    REPO_URL="$PUBLIC_REPO_URL"
    log_info "環境変数PUBLIC_REPO_URLを使用: $REPO_URL"
elif [ -n "${PUBLIC_REPO_CONFIG:-}" ]; then
    # 設定ファイルに記載されている場合
    REPO_URL="$PUBLIC_REPO_CONFIG"
    log_info "設定ファイルからURLを使用: $REPO_URL"
elif [ -n "${GITHUB_REPOSITORY:-}" ]; then
    # GitHub Actions環境での自動設定
    if [ -n "${DEPLOY_TOKEN:-}" ]; then
        # DEPLOY_TOKENが利用可能（GITHUB_TOKENまたはカスタムトークン）
        REPO_URL="https://x-access-token:${DEPLOY_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
        log_debug "デプロイトークンを使用した認証URLを設定しました"
    elif [ -n "${GITHUB_TOKEN:-}" ]; then
        # 後方互換性のためGITHUB_TOKENも直接チェック
        REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
        log_debug "GitHubトークンを使用した認証URLを設定しました"
    else
        REPO_URL="https://github.com/${GITHUB_REPOSITORY}.git"
        log_warn "認証トークンが見つかりません。パブリックURLを使用します"
        log_warn "GitHub Actionsでデプロイする場合は、ワークフローに 'permissions: contents: write' を追加してください"
    fi
    log_info "GitHub Actions環境での自動設定: $REPO_URL"
else
    # git remoteから自動検出を試行
    DETECTED_URL=$(git remote get-url origin 2>/dev/null || echo "")
    if [ -n "$DETECTED_URL" ]; then
        log_info "Git remoteから公開リポジトリURLを自動検出: $DETECTED_URL"
        REPO_URL="$DETECTED_URL"
    else
        log_error "❌ 公開リポジトリのURLが設定されていません"
        log_error "💡 次のいずれかの方法で設定してください:"
        log_error "   1. npm run setup:deploy を実行"
        log_error "   2. 環境変数 PUBLIC_REPO_URL を設定"
        log_error "   3. .env ファイルに PUBLIC_REPO_URL を記載"
        log_error "   4. GitHub Actions環境変数 GITHUB_REPOSITORY"
        exit 1
    fi
fi

# URL検証
if ! validate_repo_url "$REPO_URL"; then
    exit 1
fi

PUBLIC_REPO_DIR="${PUBLIC_REPO_DIR:-/tmp/$(basename ${GITHUB_REPOSITORY:-{{PUBLIC_REPO_NAME}}})}"
BRANCH="$DEPLOY_BRANCH"

log_debug "最終設定:"
log_debug "  REPO_URL: $REPO_URL"
log_debug "  PUBLIC_REPO_DIR: $PUBLIC_REPO_DIR"
log_debug "  BRANCH: $BRANCH"

# ロールバック関数
rollback_deployment() {
    local reason="${1:-Manual rollback requested}"
    log_warn "🔄 Initiating rollback: $reason"
    
    if [ -d "$PUBLIC_REPO_DIR" ]; then
        cd "$PUBLIC_REPO_DIR"
        
        # 最新のコミットが今回のデプロイかチェック
        LAST_COMMIT_MSG=$(git log -1 --pretty=format:"%s" 2>/dev/null || echo "")
        if [[ "$LAST_COMMIT_MSG" == "Deploy: "* ]]; then
            log_info "Rolling back to previous commit..."
            git reset --hard HEAD~1
            
            if [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ]; then
                read -p "Push rollback to remote? (y/N) " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    git push --force-with-lease origin "$BRANCH"
                    log_info "✅ Rollback completed successfully"
                else
                    log_info "Rollback prepared locally (not pushed)"
                fi
            else
                log_warn "⚠️  CI environment: Rollback prepared but not pushed automatically"
            fi
        else
            log_warn "Cannot rollback: Last commit doesn't appear to be from this deployment"
        fi
    else
        log_error "Cannot rollback: Public repository directory not found"
    fi
}

# URL検証関数
validate_repo_url() {
    local url="$1"
    if [[ ! "$url" =~ ^(https?://|git@) ]]; then
        log_error "無効なリポジトリURL形式です: $url"
        return 1
    fi
    
    # GitHub URLの基本的な検証
    if [[ "$url" =~ github\.com ]]; then
        if [[ ! "$url" =~ github\.com[:/][^/]+/[^/.]+ ]]; then
            log_error "無効なGitHubリポジトリURL形式です: $url"
            return 1
        fi
    fi
    
    return 0
}

# CI環境の検出と設定
setup_ci_environment() {
    if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
        log_info "🔧 CI環境をセットアップ中..."
        
        retry_command 3 1 "git config --global user.email '${GIT_USER_EMAIL:-actions@github.com}'" || {
            handle_error 1 $LINENO "Git設定の更新に失敗しました" "AUTH_FAILED"
        }
        
        retry_command 3 1 "git config --global user.name '${GIT_USER_NAME:-GitHub Actions}'" || {
            handle_error 1 $LINENO "Git設定の更新に失敗しました" "AUTH_FAILED"
        }
        
        # GitHub Actions環境での認証設定
        if [ -n "${GITHUB_TOKEN:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ]; then
            log_info "GitHubトークンを使用した認証を設定しました"
        fi
        
        log_info "CI環境のセットアップが完了しました"
    else
        log_debug "ローカル環境での実行を検出しました"
    fi
}

# 1. ビルドを実行（インクリメンタルビルドを優先）
deploy_step_build() {
    log_info "🔨 公開用コンテンツをビルド中..."
    cd "$PRIVATE_REPO_DIR" || {
        handle_error 1 $LINENO "プライベートリポジトリディレクトリに移動できませんでした: $PRIVATE_REPO_DIR" "DIRECTORY_NOT_FOUND"
    }

    # ビルドディレクトリの存在確認
    if [ ! -d "$BUILD_DIR" ]; then
        log_info "ビルドディレクトリが存在しないため、作成します..."
        mkdir -p "$BUILD_DIR" || {
            handle_error 1 $LINENO "ビルドディレクトリの作成に失敗しました: $BUILD_DIR" "DIRECTORY_NOT_FOUND"
        }
    fi

    # CI環境のセットアップ
    setup_ci_environment

# ロールバックオプションの処理
if [ "$1" = "--rollback" ]; then
    log_info "🔄 Rollback mode activated"
    rollback_deployment "Manual rollback requested"
    exit 0
fi

# インクリメンタルビルドオプションの確認
if [ "$1" = "--full" ]; then
    log_info "Performing full rebuild..."
    npm run build || node scripts/build.js
else
    log_info "Performing incremental build..."
    node scripts/build-incremental.js || npm run build || node scripts/build.js
fi


    # ビルド結果の確認
    if [ ! -d "$BUILD_DIR" ] || [ -z "$(ls -A "$BUILD_DIR" 2>/dev/null)" ]; then
        handle_error 1 $LINENO "ビルドが失敗したか、ビルドディレクトリ '$BUILD_DIR' が空です" "BUILD_FAILED"
    fi
    
    log_info "ビルドが正常に完了しました"
}

# 🔍 セキュリティスキャン: ビルド済みコンテンツをスキャン
log_info "🔍 Scanning built content for private information..."
cd "$PRIVATE_REPO_DIR"

# プライベートコンテンツのチェック
SCAN_WARNINGS=""
if [ -d "$BUILD_DIR" ]; then
    # TODOやPRIVATEコメントが残っていないかチェック
    PRIVATE_CONTENT=$(grep -r "<!-- \(TODO\|PRIVATE\|SECRET\|DRAFT\|CONFIDENTIAL\|INSTRUCTOR\|INTERNAL\|SENSITIVE\):" "$BUILD_DIR/" 2>/dev/null || true)
    if [ -n "$PRIVATE_CONTENT" ]; then
        log_warn "⚠️  WARNING: Private content markers found in built files:"
        echo "$PRIVATE_CONTENT" | while read -r line; do
            log_warn "    $line"
        done
        SCAN_WARNINGS="private_markers"
    fi
    
    # API keys, passwords などの機密情報チェック
    SENSITIVE_CONTENT=$(grep -rE "(api[_-]?key|secret[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|github[_-]?token|aws[_-]?access[_-]?key)\s*[=:]\s*['\"][^'\"]+['\"]" "$BUILD_DIR/" 2>/dev/null || true)
    if [ -n "$SENSITIVE_CONTENT" ]; then
        log_warn "⚠️  WARNING: Potentially sensitive information found:"
        echo "$SENSITIVE_CONTENT" | while read -r line; do
            log_warn "    $line"
        done
        SCAN_WARNINGS="${SCAN_WARNINGS} sensitive_info"
    fi
fi

# スキャン結果に応じた処理
if [ -n "$SCAN_WARNINGS" ]; then
    if [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ]; then
        echo ""
        log_warn "🛡️  Security scan detected potential issues."
        read -p "Do you want to continue deployment despite warnings? (y/N) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warn "Deployment cancelled due to security concerns"
            exit 1
        fi
    else
        log_warn "⚠️  CI environment: Proceeding with warnings (review recommended)"
    fi
else
    log_info "✅ Security scan passed - no private content detected"
fi

# 2. 公開リポジトリをクローン（または更新）
deploy_step_clone_or_update() {
    log_info "📦 公開リポジトリを準備中..."
    
    if [ -d "$PUBLIC_REPO_DIR" ]; then
        log_info "既存の公開リポジトリを更新中..."
        cd "$PUBLIC_REPO_DIR" || {
            handle_error 1 $LINENO "公開リポジトリディレクトリに移動できませんでした: $PUBLIC_REPO_DIR" "DIRECTORY_NOT_FOUND"
        }
        
        retry_command 3 2 "git fetch origin" || {
            handle_error 1 $LINENO "リモートリポジトリからのfetchに失敗しました" "GIT_CLONE_FAILED"
        }
        
        retry_command 3 2 "git checkout '$BRANCH'" || {
            handle_error 1 $LINENO "ブランチのチェックアウトに失敗しました: $BRANCH" "GIT_CLONE_FAILED"
        }
        
        retry_command 3 2 "git pull origin '$BRANCH'" || {
            handle_error 1 $LINENO "ブランチのpullに失敗しました: $BRANCH" "GIT_CLONE_FAILED"
        }
    else
        log_info "公開リポジトリをクローン中..."
        retry_command 3 5 "git clone '$REPO_URL' '$PUBLIC_REPO_DIR'" || {
            handle_error 1 $LINENO "リポジトリのクローンに失敗しました: $REPO_URL" "GIT_CLONE_FAILED"
        }
        
        cd "$PUBLIC_REPO_DIR" || {
            handle_error 1 $LINENO "クローンしたリポジトリディレクトリに移動できませんでした: $PUBLIC_REPO_DIR" "DIRECTORY_NOT_FOUND"
        }
        
        # gh-pagesブランチが存在しない場合は作成
        if ! git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
            log_info "$BRANCH ブランチを作成中..."
            retry_command 3 2 "git checkout --orphan '$BRANCH'" || {
                handle_error 1 $LINENO "orphanブランチの作成に失敗しました: $BRANCH" "GIT_CLONE_FAILED"
            }
            retry_command 3 2 "git rm -rf . 2>/dev/null || true" || log_warn "既存ファイルの削除に失敗しましたが、継続します"
        else
            retry_command 3 2 "git checkout '$BRANCH'" || {
                handle_error 1 $LINENO "既存ブランチのチェックアウトに失敗しました: $BRANCH" "GIT_CLONE_FAILED"
            }
        fi
    fi
    
    log_info "公開リポジトリの準備が完了しました"
}

# 3. ファイルの同期
deploy_step_sync_files() {
    local build_option="$1"
    
    log_info "📁 ファイルを同期中..."
    
    if [ "$build_option" = "--full" ]; then
        log_info "フルビルドモード: 既存ファイルを削除してからコピーします"
        find . -maxdepth 1 ! -name '.git' ! -name '.' ! -name '..' -exec rm -rf {} + 2>/dev/null || {
            log_warn "既存ファイルの削除中に一部エラーが発生しましたが、継続します"
        }
        
        retry_command 3 2 "cp -r '$PRIVATE_REPO_DIR/$BUILD_DIR/'* ." || {
            handle_error 1 $LINENO "ビルドファイルのコピーに失敗しました" "BUILD_FAILED"
        }
    else
        log_info "インクリメンタルモード: 差分のみ同期します"
        if command -v rsync >/dev/null 2>&1; then
            retry_command 3 2 "rsync -av --delete --exclude='.git' --exclude='.gitignore' --exclude='CNAME' --exclude='.nojekyll' '$PRIVATE_REPO_DIR/$BUILD_DIR/' ." || {
                handle_error 1 $LINENO "rsyncによる同期に失敗しました" "BUILD_FAILED"
            }
        else
            log_warn "rsyncが利用できません。cpコマンドを使用します"
            retry_command 3 2 "cp -r '$PRIVATE_REPO_DIR/$BUILD_DIR/'* ." || {
                handle_error 1 $LINENO "ビルドファイルのコピーに失敗しました" "BUILD_FAILED"
            }
        fi
    fi
    
    log_info "ファイル同期が完了しました"
}

# 4. コミットとプッシュ
deploy_step_commit_and_push() {
    log_info "📝 変更をコミット中..."
    
    retry_command 3 1 "git add -A" || {
        handle_error 1 $LINENO "ファイルのステージングに失敗しました" "GIT_PUSH_FAILED"
    }

    if git diff --staged --quiet; then
        log_warn "デプロイする変更がありません"
        return 0
    fi

    local commit_msg="Deploy: $(date '+%Y-%m-%d %H:%M:%S')"
    if [ -n "${GITHUB_SHA:-}" ]; then
        commit_msg="$commit_msg (from ${GITHUB_SHA:0:7})"
    fi
    
    retry_command 3 2 "git commit -m '$commit_msg'" || {
        handle_error 1 $LINENO "コミットの作成に失敗しました" "GIT_PUSH_FAILED"
    }

    # デプロイ前の最終確認（CI環境では自動実行）
    if [ -z "${CI:-}" ] && [ -z "${GITHUB_ACTIONS:-}" ]; then
        log_info "デプロイ準備完了。以下の変更を含みます:"
        git log --oneline -1
        echo ""
        git diff --stat HEAD~1

        echo ""
        read -p "デプロイを実行しますか? (y/N) " -n 1 -r
        echo ""

        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warn "デプロイがキャンセルされました"
            exit 1
        fi
    else
        log_info "CI環境での自動デプロイを実行中..."
    fi

    log_info "リモートリポジトリにプッシュ中..."
    retry_command 3 5 "git push origin '$BRANCH'" || {
        handle_error 1 $LINENO "リモートリポジトリへのプッシュに失敗しました" "GIT_PUSH_FAILED"
    }
    
    log_info "プッシュが正常に完了しました"
}

# メイン実行関数
main() {
    log_info "デプロイメント設定を確認中..."
    
    # 引数の処理
    local build_option="$1"
    
    # ステップ1: ビルド
    deploy_step_build "$build_option"
    
    # ステップ2: リポジトリの準備
    deploy_step_clone_or_update
    
    # ステップ3: ファイルの同期
    deploy_step_sync_files "$build_option"
    
    # ステップ4: コミット＆プッシュ
    deploy_step_commit_and_push
    
    # 正常完了
    log_info "✅ デプロイメントが正常に完了しました！"
    log_info "📎 サイトを確認: https://username.github.io/theoretical-cs-textbook-public/"
    log_info "📊 デプロイメントステータス: https://github.com/username/theoretical-cs-textbook-public/actions"
}

# エラートラップ削除（メイン実行前）
trap - ERR

# メイン処理を実行し、エラーハンドリングを適用
if ! main "$@"; then
    handle_error $? $LINENO "メインデプロイメント処理が失敗しました" "DEPLOY_INIT_FAILED"
fi