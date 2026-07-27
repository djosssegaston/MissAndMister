<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('j_serai_tickets', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('first_name');
            $table->string('last_name');
            $table->text('phone');
            $table->text('email')->nullable();
            $table->string('photo_path')->nullable();
            $table->string('poster_path')->nullable();
            $table->string('edit_token', 64);
            $table->foreignId('template_id')->nullable()->constrained('j_serai_templates')->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->timestamp('downloaded_at')->nullable();
            $table->timestamps();

            $table->index('uuid');
            $table->index('status');
            $table->index('edit_token');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('j_serai_tickets');
    }
};
