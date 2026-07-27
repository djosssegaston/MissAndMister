<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ticket_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->unsignedInteger('total_amount')->default(0);
            $table->string('currency', 10)->default('XOF');
            $table->string('status', 20)->default('pending');
            $table->string('payment_reference', 30)->nullable()->unique();
            $table->unsignedInteger('quantity')->default(1);
            $table->timestamps();

            $table->index('user_id');
            $table->index('event_id');
            $table->index('status');
            $table->index('payment_reference');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_orders');
    }
};
