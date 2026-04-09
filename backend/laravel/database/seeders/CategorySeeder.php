<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            ['name' => 'Miss', 'description' => 'Concours Miss'],
            ['name' => 'Mister', 'description' => 'Concours Mister'],
        ];

        foreach ($categories as $index => $category) {
            Category::firstOrCreate(
                ['name' => $category['name']],
                [
                    'slug' => Str::slug($category['name']),
                    'description' => $category['description'],
                    'status' => 'active',
                    'position' => $index,
                ]
            );
        }
    }
}
