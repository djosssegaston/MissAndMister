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
        Admin::firstOrCreate(
            ['email' => 'admin@missandmister.test'],
            [
                'name' => 'Super Admin',
                'phone' => '0000000000',
                'password' => Hash::make('admin1234'),
                'role' => 'superadmin',
                'status' => 'active',
            ]
        );
    }
}
