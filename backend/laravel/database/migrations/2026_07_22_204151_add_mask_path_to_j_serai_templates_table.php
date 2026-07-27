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
        Schema::table('j_serai_templates', function (Blueprint $table) {
            $table->string('mask_path')->nullable()->after('file_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('j_serai_templates', function (Blueprint $table) {
            $table->dropColumn('mask_path');
        });
    }
};
