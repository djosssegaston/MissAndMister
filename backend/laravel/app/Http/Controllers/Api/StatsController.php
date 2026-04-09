<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StatsService;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __construct(private StatsService $stats)
    {
    }

    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        return response()->json($this->stats->summary());
    }

    public function publicStats(): JsonResponse
    {
        return response()->json($this->stats->publicSummary());
    }
}
