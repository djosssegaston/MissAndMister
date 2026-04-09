<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use Tests\TestCase;

class VoteFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_vote_endpoint_requires_authentication(): void
    {
        $response = $this->postJson('/api/votes', [
            'candidate_id' => 1,
            'amount' => 500,
        ]);

        $response->assertStatus(401);
    }
}
