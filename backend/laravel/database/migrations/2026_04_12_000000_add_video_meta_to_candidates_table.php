<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('candidates', 'video_meta')) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->json('video_meta')->nullable()->after('video_path');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('candidates', 'video_meta')) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->dropColumn('video_meta');
            });
        }
    }
};
