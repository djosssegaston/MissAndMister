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
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->enum('type', ['debit', 'credit'])->default('debit');
            $table->enum('status', ['pending', 'succeeded', 'failed'])->default('pending')->index();
            $table->decimal('amount', 12, 2);
            $table->string('currency', 8)->default('XOF');
            $table->string('provider_reference')->nullable()->index();
            $table->json('payload')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
