<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            if (!Schema::hasColumn('candidates', 'city')) {
                $table->string('city')->nullable()->after('age');
            }
            if (!Schema::hasColumn('candidates', 'description')) {
                $table->text('description')->nullable()->after('city');
            }
            if (!Schema::hasColumn('candidates', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('status')->index();
            }
        });

        // Align existing rows with new flags
        DB::table('candidates')->update([
            'is_active' => true,
        ]);
    }

    public function down(): void
    {
        Schema::table('candidates', function (Blueprint $table) {
            if (Schema::hasColumn('candidates', 'is_active')) {
                $table->dropColumn('is_active');
            }
            if (Schema::hasColumn('candidates', 'description')) {
                $table->dropColumn('description');
            }
            if (Schema::hasColumn('candidates', 'city')) {
                $table->dropColumn('city');
            }
        });
    }
};
