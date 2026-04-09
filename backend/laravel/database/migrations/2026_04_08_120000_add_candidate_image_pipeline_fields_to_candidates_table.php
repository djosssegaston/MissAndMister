<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $needsOriginalPath = !Schema::hasColumn('candidates', 'photo_original_path');
        $needsVariants = !Schema::hasColumn('candidates', 'photo_variants');
        $needsMeta = !Schema::hasColumn('candidates', 'photo_meta');
        $needsStatus = !Schema::hasColumn('candidates', 'photo_processing_status');
        $needsError = !Schema::hasColumn('candidates', 'photo_processing_error');

        Schema::table('candidates', function (Blueprint $table) use (
            $needsOriginalPath,
            $needsVariants,
            $needsMeta,
            $needsStatus,
            $needsError,
        ) {
            if ($needsOriginalPath) {
                $table->string('photo_original_path')->nullable()->after('photo_path');
            }

            if ($needsVariants) {
                $table->json('photo_variants')->nullable()->after('photo_original_path');
            }

            if ($needsMeta) {
                $table->json('photo_meta')->nullable()->after('photo_variants');
            }

            if ($needsStatus) {
                $table->string('photo_processing_status')->default('idle')->after('photo_meta');
            }

            if ($needsError) {
                $table->text('photo_processing_error')->nullable()->after('photo_processing_status');
            }
        });

        DB::table('candidates')
            ->whereNull('photo_processing_status')
            ->update(['photo_processing_status' => 'idle']);

        DB::table('candidates')
            ->whereNotNull('photo_path')
            ->update([
                'photo_original_path' => DB::raw('photo_path'),
                'photo_processing_status' => 'ready',
            ]);
    }

    public function down(): void
    {
        $columns = array_values(array_filter([
            Schema::hasColumn('candidates', 'photo_processing_error') ? 'photo_processing_error' : null,
            Schema::hasColumn('candidates', 'photo_processing_status') ? 'photo_processing_status' : null,
            Schema::hasColumn('candidates', 'photo_meta') ? 'photo_meta' : null,
            Schema::hasColumn('candidates', 'photo_variants') ? 'photo_variants' : null,
            Schema::hasColumn('candidates', 'photo_original_path') ? 'photo_original_path' : null,
        ]));

        if ($columns === []) {
            return;
        }

        Schema::table('candidates', function (Blueprint $table) use ($columns) {
            $table->dropColumn($columns);
        });
    }
};
