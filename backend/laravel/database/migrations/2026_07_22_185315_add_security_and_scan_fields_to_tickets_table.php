<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('security_token', 64)->after('ticket_code')->index();
            $table->string('qr_token', 64)->after('security_token')->unique();
            $table->timestamp('scanned_at')->nullable()->after('checked_in_at');
            $table->foreignId('scanned_by')->nullable()->after('scanned_at')->constrained('admins')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropForeign(['scanned_by']);
            $table->dropColumn(['security_token', 'qr_token', 'scanned_at', 'scanned_by']);
        });
    }
};
