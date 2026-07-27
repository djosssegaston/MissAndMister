<?php

namespace Database\Factories;

use App\Models\TicketOrder;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TicketOrderFactory extends Factory
{
    protected $model = TicketOrder::class;

    public function definition(): array
    {
        return [
            'user_id' => null,
            'event_id' => null,
            'payment_id' => null,
            'holder_name' => fake()->name(),
            'holder_phone' => fake()->numerify('+229########'),
            'holder_email' => fake()->safeEmail(),
            'delivery_method' => 'email',
            'total_amount' => fake()->numberBetween(5000, 100000),
            'currency' => 'XOF',
            'status' => 'pending',
            'payment_reference' => strtoupper('BT'.Str::random(10)),
            'quantity' => fake()->numberBetween(1, 5),
        ];
    }

    public function paid(): static
    {
        return $this->state(fn () => ['status' => 'paid']);
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending']);
    }

    public function whatsapp(): static
    {
        return $this->state(fn () => ['delivery_method' => 'whatsapp']);
    }
}
