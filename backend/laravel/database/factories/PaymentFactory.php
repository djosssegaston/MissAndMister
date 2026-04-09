<?php

namespace Database\Factories;

use App\Models\Payment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Payment>
 */
class PaymentFactory extends Factory
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
            'provider' => 'kkiapay',
            'reference' => strtoupper($this->faker->bothify('KKIA-####-####')),
            'transaction_id' => null,
            'amount' => 500,
            'currency' => 'XOF',
            'status' => 'initiated',
            'payload' => ['factory' => true],
            'meta' => ['channel' => 'test'],
        ];
    }
}
