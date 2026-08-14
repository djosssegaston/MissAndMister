#!/usr/bin/env bash

# install-cron-lws.sh — Installe (ou vérifie) le cron schedule:run sur LWS.
#
# Sans ce cron, le scheduler Laravel ne tourne jamais : les votes payes via
# FedaPay dont le webhook n'arrive pas restent bloques a 'pending'.
# Idempotent : n'ajoute pas de doublon.
#
# Usage:
#   bash backend/laravel/scripts/install-cron-lws.sh
#
# Environnement (defauts identiques a deploy-lws.sh) :
#   LWS_SSH_TARGET   SSH target (defaut: missm2781953@webdb2210)
#   LWS_REMOTE_DIR   Repertoire Laravel distant (defaut: /home/htdocs/.../backend/laravel)
#   LWS_PHP_BIN      Binaire PHP sur LWS (defaut: php)

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

LWS_SSH_TARGET="${LWS_SSH_TARGET:-missm2781953@webdb2210}"
LWS_REMOTE_DIR="${LWS_REMOTE_DIR:-/home/htdocs/api.missmisteruniversitybenin.com/backend/laravel}"
LWS_PHP_BIN="${LWS_PHP_BIN:-php}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "Missing required command: $1" >&2
        exit 1
    fi
}

require_command ssh

CRON_LINE="* * * * * cd ${LWS_REMOTE_DIR} && ${LWS_PHP_BIN} artisan schedule:run >> /dev/null 2>&1"
GUARD="${LWS_REMOTE_DIR} && ${LWS_PHP_BIN} artisan schedule:run"

INSTALL_CMD="cron=\"\$(crontab -l 2>/dev/null || true)\"
if printf '%s\\n' \"\$cron\" | grep -Fq '${GUARD}'; then
    echo 'Cron deja present, rien a faire.'
else
    { printf '%s\\n' \"\$cron\"; printf '%s\\n' '${CRON_LINE}'; } | crontab -
    echo 'Cron installe.'
fi"

echo "Cible: ${LWS_SSH_TARGET}:${LWS_REMOTE_DIR}"
echo "Ligne: ${CRON_LINE}"
echo ""

ssh "$LWS_SSH_TARGET" "$INSTALL_CMD"

echo ""
echo "Verification du crontab distant :"
ssh "$LWS_SSH_TARGET" "crontab -l 2>/dev/null | grep -F 'artisan schedule:run' || echo 'ABSENT'"

echo ""
echo "Termine. Le scheduler Laravel tourne desormais chaque minute sur LWS."
echo "La prochaine pass de reconciliation FedaPay corrigera les votes en attente."
