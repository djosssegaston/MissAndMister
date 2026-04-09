<?php

namespace Database\Factories;

use App\Models\Candidate;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Candidate>
 */
class CandidateFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $first = $this->faker->firstName();
        $last = $this->faker->lastName();

        return [
            'category_id' => 1,
            'first_name' => $first,
            'last_name' => $last,
            'public_number' => $this->faker->unique()->numberBetween(1, 999999),
            'slug' => \Str::slug($first . ' ' . $last . '-' . $this->faker->unique()->numberBetween(1, 9999)),
            'email' => $this->faker->unique()->safeEmail(),
            'phone' => $this->faker->unique()->phoneNumber(),
            'bio' => $this->faker->sentence(12),
            'description' => $this->faker->paragraph(),
            'photo_path' => null,
            'city' => $this->faker->city(),
            'age' => $this->faker->numberBetween(18, 30),
            'university' => $this->faker->company(),
            'status' => 'active',
            'is_active' => true,
        ];
    }
}
