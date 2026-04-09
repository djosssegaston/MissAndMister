<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class AdminApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_routes_require_admin_token(): void
    {
        $response = $this->postJson('/api/admin/candidates', []);

        $response->assertStatus(401);
    }
}
