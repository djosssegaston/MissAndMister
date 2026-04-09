<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Extend allowed statuses for admin moderation (suspect, cancelled)
        DB::statement("ALTER TABLE votes MODIFY status ENUM('pending','confirmed','failed','suspect','cancelled') DEFAULT 'pending'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert to original enum values
        DB::statement("ALTER TABLE votes MODIFY status ENUM('pending','confirmed','failed') DEFAULT 'pending'");
    }
};
