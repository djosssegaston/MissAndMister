<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('social_projects', function (Blueprint $table) {
            $table->string('candidate1_photo_path')->nullable()->after('candidate2_id');
            $table->string('candidate2_photo_path')->nullable()->after('candidate1_photo_path');
        });
    }

    public function down(): void
    {
        Schema::table('social_projects', function (Blueprint $table) {
            $table->dropColumn(['candidate1_photo_path', 'candidate2_photo_path']);
        });
    }
};
