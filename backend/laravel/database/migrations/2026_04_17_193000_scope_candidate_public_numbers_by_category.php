<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const LEGACY_INDEX = 'candidates_public_number_unique';
    private const SCOPED_INDEX = 'candidates_category_public_number_unique';

    public function up(): void
    {
        if (!Schema::hasColumn('candidates', 'public_number') || !Schema::hasColumn('candidates', 'category_id')) {
            return;
        }

        $this->dropIndexIfExists('candidates', self::LEGACY_INDEX);
        $this->renumberCandidatesPerCategory();
        $this->addScopedIndexIfMissing();
    }

    public function down(): void
    {
        if (!Schema::hasColumn('candidates', 'public_number') || !Schema::hasColumn('candidates', 'category_id')) {
            return;
        }

        $this->dropIndexIfExists('candidates', self::SCOPED_INDEX);
        $this->renumberCandidatesGlobally();

        if (!$this->indexExists('candidates', self::LEGACY_INDEX)) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->unique('public_number', self::LEGACY_INDEX);
            });
        }
    }

    private function renumberCandidatesPerCategory(): void
    {
        $rows = DB::table('candidates')
            ->select(['id', 'category_id'])
            ->orderBy('category_id')
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $counters = [];

        foreach ($rows as $row) {
            $categoryId = (int) $row->category_id;
            $counters[$categoryId] = ($counters[$categoryId] ?? 0) + 1;

            DB::table('candidates')
                ->where('id', $row->id)
                ->update(['public_number' => $counters[$categoryId]]);
        }
    }

    private function renumberCandidatesGlobally(): void
    {
        $rows = DB::table('candidates')
            ->select(['id'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        $counter = 1;

        foreach ($rows as $row) {
            DB::table('candidates')
                ->where('id', $row->id)
                ->update(['public_number' => $counter]);

            $counter++;
        }
    }

    private function addScopedIndexIfMissing(): void
    {
        if ($this->indexExists('candidates', self::SCOPED_INDEX)) {
            return;
        }

        Schema::table('candidates', function (Blueprint $table) {
            $table->unique(['category_id', 'public_number'], self::SCOPED_INDEX);
        });
    }

    private function dropIndexIfExists(string $table, string $indexName): void
    {
        if (!$this->indexExists($table, $indexName)) {
            return;
        }

        Schema::table($table, function (Blueprint $table) use ($indexName) {
            $table->dropUnique($indexName);
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $database = DB::getDatabaseName();

        return !empty(DB::select(
            'SELECT 1 FROM information_schema.statistics WHERE table_schema = ? AND table_name = ? AND index_name = ? LIMIT 1',
            [$database, $table, $indexName]
        ));
    }
};
