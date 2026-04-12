<?php

namespace Database\Seeders;

use App\Models\Admin;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $isLocal = app()->environment('local');
        $email = trim((string) env('PROD_ADMIN_EMAIL', $isLocal ? 'admin@missandmister.test' : ''));
        $password = (string) env('PROD_ADMIN_PASSWORD', $isLocal ? 'admin1234' : '');

        if ($email === '' || $password === '') {
            return;
        }

        Admin::updateOrCreate(
            ['email' => $email],
            [
                'name' => trim((string) env('PROD_ADMIN_NAME', $isLocal ? 'Super Admin' : 'Admin')) ?: 'Admin',
                'phone' => trim((string) env('PROD_ADMIN_PHONE', '0000000000')) ?: '0000000000',
                'password' => Hash::make($password),
                'role' => trim((string) env('PROD_ADMIN_ROLE', 'superadmin')) ?: 'superadmin',
                'status' => trim((string) env('PROD_ADMIN_STATUS', 'active')) ?: 'active',
            ]
        );
    }
}
