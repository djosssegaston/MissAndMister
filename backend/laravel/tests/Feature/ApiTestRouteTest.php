<?php

namespace Tests\Feature;

use Tests\TestCase;

class ApiTestRouteTest extends TestCase
{
    public function test_api_test_route_returns_valid_json(): void
    {
        $this->getJson('/api/test')
            ->assertOk()
            ->assertJsonStructure([
                'ok',
                'service',
                'timestamp',
            ])
            ->assertJson([
                'ok' => true,
                'service' => 'miss-and-mister-api',
            ]);
    }
}
