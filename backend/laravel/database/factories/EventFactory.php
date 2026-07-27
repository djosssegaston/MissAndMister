<?php

namespace Database\Factories;

use App\Models\Event;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class EventFactory extends Factory
{
    protected $model = Event::class;

    public function definition(): array
    {
        return [
            'uuid' => Str::uuid()->toString(),
            'title' => fake()->sentence(3),
            'description' => fake()->paragraph(),
            'location' => fake()->city(),
            'event_date' => fake()->dateTimeBetween('+1 month', '+6 months'),
            'image_path' => null,
            'status' => 'published',
            'created_by' => null,
        ];
    }

    public function draft(): static
    {
        return $this->state(fn () => ['status' => 'draft']);
    }

    public function published(): static
    {
        return $this->state(fn () => ['status' => 'published']);
    }
}
