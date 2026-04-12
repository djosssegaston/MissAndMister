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
        if (!Schema::hasTable('votes') || !Schema::hasTable('payments')) {
            return;
        }

        if (!Schema::hasColumn('votes', 'payment_id')) {
            return;
        }

        Schema::table('votes', function (Blueprint $table) {
            $table->foreign('payment_id')
                ->references('id')
                ->on('payments')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('votes')) {
            return;
        }

        if (!Schema::hasColumn('votes', 'payment_id')) {
            return;
        }

        Schema::table('votes', function (Blueprint $table) {
            $table->dropForeign(['payment_id']);
        });
    }
};
