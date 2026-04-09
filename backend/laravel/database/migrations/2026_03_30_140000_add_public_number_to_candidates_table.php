<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('candidates', 'public_number')) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->unsignedInteger('public_number')->nullable()->unique()->after('id');
            });

            // Backfill sequentially based on creation order then id
            $rows = DB::table('candidates')
                ->select('id')
                ->orderBy('created_at')
                ->orderBy('id')
                ->get();

            $n = 1;
            foreach ($rows as $row) {
                DB::table('candidates')->where('id', $row->id)->update(['public_number' => $n]);
                $n++;
            }

            // Make column non-nullable after backfill
            Schema::table('candidates', function (Blueprint $table) {
                $table->unsignedInteger('public_number')->nullable(false)->change();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('candidates', 'public_number')) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->dropUnique(['public_number']);
                $table->dropColumn('public_number');
            });
        }
    }
};
