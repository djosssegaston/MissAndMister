<?php

namespace Database\Factories;

use App\Models\Vote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vote>
 */
class VoteFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => 1,
            'candidate_id' => 1,
            'payment_id' => null,
            'amount' => 500,
            'quantity' => 1,
            'currency' => 'XOF',
            'status' => 'pending',
            'ip_address' => $this->faker->ipv4(),
            'meta' => ['source' => 'factory'],
        ];
    }
}
