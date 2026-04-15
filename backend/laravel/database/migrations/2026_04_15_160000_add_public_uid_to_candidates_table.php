<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('candidates', 'public_uid')) {
            Schema::table('candidates', function (Blueprint $table) {
                $table->string('public_uid', 26)->nullable()->unique()->after('public_number');
            });
        }

        DB::table('candidates')
            ->select(['id', 'public_uid'])
            ->orderBy('id')
            ->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    if (filled($row->public_uid)) {
                        continue;
                    }

                    do {
                        $publicUid = (string) Str::ulid();
                    } while (
                        DB::table('candidates')
                            ->where('public_uid', $publicUid)
                            ->exists()
                    );

                    DB::table('candidates')
                        ->where('id', $row->id)
                        ->update(['public_uid' => $publicUid]);
                }
            });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('candidates', 'public_uid')) {
            return;
        }

        Schema::table('candidates', function (Blueprint $table) {
            $table->dropUnique(['public_uid']);
            $table->dropColumn('public_uid');
        });
    }
};
