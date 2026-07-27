#!/bin/bash
set -e

php artisan migrate --force --no-interaction

echo "Starting queue worker..."
exec php artisan queue:work --sleep=3 --tries=3 --timeout=120 --max-time=3600
