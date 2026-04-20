<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const VOTES_PAYMENT_STATUS_CREATED_INDEX = 'votes_payment_status_created_idx';
    private const VOTES_USER_STATUS_CREATED_INDEX = 'votes_user_status_created_idx';
    private const PAYMENTS_USER_STATUS_CREATED_INDEX = 'payments_user_status_created_idx';
    private const USERS_ROLE_STATUS_CREATED_INDEX = 'users_role_status_created_idx';

    public function up(): void
    {
        if ($this->databaseDriver() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('votes') && !$this->indexExists('votes', self::VOTES_PAYMENT_STATUS_CREATED_INDEX)) {
            Schema::table('votes', function (Blueprint $table) {
                $table->index(['payment_id', 'status', 'created_at'], self::VOTES_PAYMENT_STATUS_CREATED_INDEX);
            });
        }

        if (Schema::hasTable('votes') && !$this->indexExists('votes', self::VOTES_USER_STATUS_CREATED_INDEX)) {
            Schema::table('votes', function (Blueprint $table) {
                $table->index(['user_id', 'status', 'created_at'], self::VOTES_USER_STATUS_CREATED_INDEX);
            });
        }

        if (Schema::hasTable('payments') && !$this->indexExists('payments', self::PAYMENTS_USER_STATUS_CREATED_INDEX)) {
            Schema::table('payments', function (Blueprint $table) {
                $table->index(['user_id', 'status', 'created_at'], self::PAYMENTS_USER_STATUS_CREATED_INDEX);
            });
        }

        if (Schema::hasTable('users') && !$this->indexExists('users', self::USERS_ROLE_STATUS_CREATED_INDEX)) {
            Schema::table('users', function (Blueprint $table) {
                $table->index(['role', 'status', 'created_at'], self::USERS_ROLE_STATUS_CREATED_INDEX);
            });
        }
    }

    public function down(): void
    {
        if ($this->databaseDriver() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('votes') && $this->indexExists('votes', self::VOTES_PAYMENT_STATUS_CREATED_INDEX)) {
            Schema::table('votes', function (Blueprint $table) {
                $table->dropIndex(self::VOTES_PAYMENT_STATUS_CREATED_INDEX);
            });
        }

        if (Schema::hasTable('votes') && $this->indexExists('votes', self::VOTES_USER_STATUS_CREATED_INDEX)) {
            Schema::table('votes', function (Blueprint $table) {
                $table->dropIndex(self::VOTES_USER_STATUS_CREATED_INDEX);
            });
        }

        if (Schema::hasTable('payments') && $this->indexExists('payments', self::PAYMENTS_USER_STATUS_CREATED_INDEX)) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropIndex(self::PAYMENTS_USER_STATUS_CREATED_INDEX);
            });
        }

        if (Schema::hasTable('users') && $this->indexExists('users', self::USERS_ROLE_STATUS_CREATED_INDEX)) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(self::USERS_ROLE_STATUS_CREATED_INDEX);
            });
        }
    }

    private function databaseDriver(): string
    {
        return (string) DB::connection()->getDriverName();
    }

    private function indexExists(string $table, string $index): bool
    {
        return DB::table('information_schema.statistics')
            ->where('table_schema', DB::getDatabaseName())
            ->where('table_name', $table)
            ->where('index_name', $index)
            ->exists();
    }
};
