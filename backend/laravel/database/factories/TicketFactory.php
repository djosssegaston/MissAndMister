<?php

namespace Database\Factories;

use App\Models\Ticket;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TicketFactory extends Factory
{
    protected $model = Ticket::class;

    public function definition(): array
    {
        return [
            'ticket_code' => (string) Str::uuid(),
            'security_token' => Str::random(64),
            'qr_token' => Str::random(64),
            'ticket_order_id' => null,
            'ticket_type_id' => null,
            'user_id' => null,
            'holder_name' => fake()->name(),
            'holder_email' => fake()->safeEmail(),
            'holder_phone' => fake()->numerify('+229########'),
            'status' => 'valid',
            'checked_in_at' => null,
            'scanned_at' => null,
            'scanned_by' => null,
        ];
    }

    public function valid(): static
    {
        return $this->state(fn () => ['status' => 'valid']);
    }

    public function pending(): static
    {
        return $this->state(fn () => ['status' => 'pending']);
    }

    public function cancelled(): static
    {
        return $this->state(fn () => ['status' => 'cancelled']);
    }
}
