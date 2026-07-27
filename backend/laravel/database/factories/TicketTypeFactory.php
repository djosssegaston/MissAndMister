<?php

namespace Database\Factories;

use App\Models\TicketType;
use Illuminate\Database\Eloquent\Factories\Factory;

class TicketTypeFactory extends Factory
{
    protected $model = TicketType::class;

    public function definition(): array
    {
        return [
            'event_id' => null,
            'name' => fake()->randomElement(['Standard', 'VIP', 'VVIP', 'Premium']),
            'description' => fake()->sentence(),
            'image_path' => null,
            'ticket_template_path' => null,
            'price' => fake()->randomElement([5000, 10000, 15000, 25000, 50000]),
            'currency' => 'XOF',
            'quantity_total' => fake()->numberBetween(50, 500),
            'quantity_sold' => 0,
        ];
    }
}
