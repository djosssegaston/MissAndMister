#!/usr/bin/env sh
set -eu

mkdir -p \
  bootstrap/cache \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/views \
  storage/logs

php artisan migrate --force
php artisan db:seed --force

cd public

exec php \
  -d upload_max_filesize=2048M \
  -d post_max_size=2100M \
  -d max_execution_time=3600 \
  -d max_input_time=3600 \
  -d memory_limit=512M \
  -S 0.0.0.0:${PORT:-10000} \
  ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
