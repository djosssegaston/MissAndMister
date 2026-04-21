#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

LWS_SSH_TARGET="${LWS_SSH_TARGET:-missm2781953@webdb10}"
LWS_REMOTE_DIR="${LWS_REMOTE_DIR:-/home/htdocs/api.missmisteruniversitybenin.com/backend/laravel}"
LWS_PHP_BIN="${LWS_PHP_BIN:-php}"
LWS_HEALTH_URL="${LWS_HEALTH_URL:-https://api.missmisteruniversitybenin.com/up}"
LWS_SETTINGS_URL="${LWS_SETTINGS_URL:-https://api.missmisteruniversitybenin.com/api/public/settings}"

DRY_RUN=0
RUN_BOOTSTRAP=0
SKIP_HEALTH_CHECK=0

usage() {
    cat <<'EOF'
Usage: bash backend/laravel/scripts/deploy-lws.sh [options]

Options:
  --dry-run                Show what would be synchronized without changing LWS
  --bootstrap-production   Run php artisan app:bootstrap-production on LWS after sync
  --skip-health-check      Skip HTTP checks after deployment
  --help                   Show this help

Environment overrides:
  LWS_SSH_TARGET           SSH target (default: missm2781953@webdb10)
  LWS_REMOTE_DIR           Remote Laravel directory
  LWS_PHP_BIN              PHP binary on LWS (default: php)
  LWS_HEALTH_URL           Health endpoint to verify after deploy
  LWS_SETTINGS_URL         Public settings endpoint to verify after deploy
EOF
}

while (($# > 0)); do
    case "$1" in
        --dry-run)
            DRY_RUN=1
            ;;
        --bootstrap-production)
            RUN_BOOTSTRAP=1
            ;;
        --skip-health-check)
            SKIP_HEALTH_CHECK=1
            ;;
        --help|-h)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage
            exit 1
            ;;
    esac
    shift
done

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1" >&2
        exit 1
    fi
}

verify_php_syntax() {
    local file
    local failed=0

    while IFS= read -r -d '' file; do
        if ! php -l "$file" >/dev/null; then
            failed=1
        fi
    done < <(find "$BACKEND_DIR" \
        -type f -name '*.php' \
        ! -path '*/vendor/*' \
        ! -path '*/node_modules/*')

    if [[ "$failed" -ne 0 ]]; then
        echo "PHP syntax verification failed." >&2
        exit 1
    fi
}

run_health_checks() {
    if [[ "$SKIP_HEALTH_CHECK" -eq 1 ]]; then
        return
    fi

    if ! command -v curl >/dev/null 2>&1; then
        echo "curl not found, skipping HTTP verification."
        return
    fi

    echo "Checking ${LWS_HEALTH_URL}"
    curl -fsS --max-time 20 "$LWS_HEALTH_URL" >/dev/null

    echo "Checking ${LWS_SETTINGS_URL}"
    curl -fsS --max-time 20 "$LWS_SETTINGS_URL" >/dev/null
}

require_command php
require_command rsync
require_command ssh
require_command find

echo "Verifying PHP syntax in ${BACKEND_DIR}"
verify_php_syntax

echo "Synchronizing backend to ${LWS_SSH_TARGET}:${LWS_REMOTE_DIR}"

RSYNC_ARGS=(
    -az
    --delete
    --omit-dir-times
    --no-perms
    --exclude=.env
    --exclude=.env.*
    --exclude=vendor/
    --exclude=node_modules/
    --exclude=storage/
    --exclude=bootstrap/cache/*
    --exclude=public/storage
    --exclude=.git/
)

if [[ "$DRY_RUN" -eq 1 ]]; then
    RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

rsync "${RSYNC_ARGS[@]}" \
    "${BACKEND_DIR}/" \
    "${LWS_SSH_TARGET}:${LWS_REMOTE_DIR}/"

if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "Dry run completed. No remote files were modified."
    exit 0
fi

REMOTE_COMMANDS=(
    "cd '$LWS_REMOTE_DIR'"
    "$LWS_PHP_BIN artisan optimize:clear"
)

if [[ "$RUN_BOOTSTRAP" -eq 1 ]]; then
    REMOTE_COMMANDS+=("$LWS_PHP_BIN artisan app:bootstrap-production")
fi

echo "Running post-deploy Laravel commands on LWS"
ssh "$LWS_SSH_TARGET" "$(printf '%s && ' "${REMOTE_COMMANDS[@]}") true"

run_health_checks

echo "LWS backend deployment completed successfully."
