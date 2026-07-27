<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->uuid('uuid')->unique()->after('id');
        });

        // Backfill existing rows with generated UUIDs
        foreach (\DB::select('SELECT id FROM events WHERE uuid IS NULL') as $row) {
            \DB::table('events')->where('id', $row->id)->update(['uuid' => \Illuminate\Support\Str::uuid()->toString()]);
        }
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn('uuid');
        });
    }
};
