<?php

namespace Database\Seeders;

use App\Services\AdminAccountSynchronizer;
use Illuminate\Database\Seeder;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        app(AdminAccountSynchronizer::class)->syncDefinedAccounts();
    }
}
