<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('votes', 'quantity')) {
            Schema::table('votes', function (Blueprint $table) {
                $table->unsignedInteger('quantity')->default(1)->after('amount');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('votes', 'quantity')) {
            Schema::table('votes', function (Blueprint $table) {
                $table->dropColumn('quantity');
            });
        }
    }
};
