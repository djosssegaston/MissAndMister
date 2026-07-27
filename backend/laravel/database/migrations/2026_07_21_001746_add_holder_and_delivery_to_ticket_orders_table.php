<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ticket_orders', function (Blueprint $table) {
            $table->string('holder_name', 255)->nullable()->after('user_id');
            $table->string('holder_phone', 30)->nullable()->after('holder_name');
            $table->string('holder_email', 255)->nullable()->after('holder_phone');
            $table->string('delivery_method', 20)->default('email')->after('holder_email');
            $table->foreignId('user_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('ticket_orders', function (Blueprint $table) {
            $table->dropColumn(['holder_name', 'holder_phone', 'holder_email', 'delivery_method']);
            $table->foreignId('user_id')->nullable(false)->change();
        });
    }
};
