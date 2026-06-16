<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->foreignId('candidate1_id')->constrained('candidates')->restrictOnDelete();
            $table->foreignId('candidate2_id')->constrained('candidates')->restrictOnDelete();
            $table->text('theme');
            $table->foreignId('created_by')->nullable()->constrained('admins')->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();

            $table->index('created_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_projects');
    }
};
