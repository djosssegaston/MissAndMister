<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsPreviewOriginTest extends TestCase
{
    public function test_preview_vercel_origin_is_allowed_for_api_preflight(): void
    {
        $this->call('OPTIONS', '/api/auth/login', [], [], [], [
            'HTTP_ORIGIN' => 'https://miss-and-mister-preview-test.vercel.app',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,authorization,accept',
        ])
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', 'https://miss-and-mister-preview-test.vercel.app')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }
}
