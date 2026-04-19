<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const CANDIDATES_INDEX = 'candidates_active_listing_idx';
    private const VOTES_INDEX = 'votes_candidate_status_idx';
    private const PAYMENTS_INDEX = 'payments_provider_status_updated_idx';

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if ($this->databaseDriver() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('candidates') && !$this->indexExists('candidates', self::CANDIDATES_INDEX)) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->index(['status', 'is_active', 'category_id', 'public_number'], self::CANDIDATES_INDEX);
            });
        }

        if (Schema::hasTable('votes') && !$this->indexExists('votes', self::VOTES_INDEX)) {
            Schema::table('votes', function (Blueprint $table) {
                $table->index(['candidate_id', 'status'], self::VOTES_INDEX);
            });
        }

        if (Schema::hasTable('payments') && !$this->indexExists('payments', self::PAYMENTS_INDEX)) {
            Schema::table('payments', function (Blueprint $table) {
                $table->index(['provider', 'status', 'updated_at'], self::PAYMENTS_INDEX);
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if ($this->databaseDriver() !== 'mysql') {
            return;
        }

        if (Schema::hasTable('candidates') && $this->indexExists('candidates', self::CANDIDATES_INDEX)) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->dropIndex(self::CANDIDATES_INDEX);
            });
        }

        if (Schema::hasTable('votes') && $this->indexExists('votes', self::VOTES_INDEX)) {
            Schema::table('votes', function (Blueprint $table) {
                $table->dropIndex(self::VOTES_INDEX);
            });
        }

        if (Schema::hasTable('payments') && $this->indexExists('payments', self::PAYMENTS_INDEX)) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropIndex(self::PAYMENTS_INDEX);
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

