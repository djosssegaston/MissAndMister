<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'candidate_id')) {
                $table->foreignId('candidate_id')
                    ->nullable()
                    ->unique()
                    ->after('id')
                    ->constrained('candidates')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'candidate_id')) {
                $table->dropConstrainedForeignId('candidate_id');
            }
        });
    }
};
