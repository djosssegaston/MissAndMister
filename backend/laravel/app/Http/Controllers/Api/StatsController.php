<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use App\Services\StatsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class StatsController extends Controller
{
    public function __construct(
        private StatsService $stats,
        private PaymentService $payments,
    )
    {
    }

    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $this->payments->scheduleWarmPaymentStateForReadModels();
        return response()->json($this->stats->summary());
    }

    public function publicStats(): JsonResponse
    {
        $this->payments->scheduleWarmPaymentStateForReadModels();
        $payload = Cache::remember('public:stats:summary', now()->addSeconds(5), fn () => $this->stats->publicSummary());

        return response()->json($payload);
    }
}
