<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('j_serai_tickets', function (Blueprint $table) {
            $table->text('phone')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('j_serai_tickets', function (Blueprint $table) {
            $table->text('phone')->nullable(false)->change();
        });
    }
};
