<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use App\Services\PublicApiPayloadService;
use App\Services\StatsService;
use Illuminate\Http\JsonResponse;

class StatsController extends Controller
{
    public function __construct(
        private StatsService $stats,
        private PaymentService $payments,
        private PublicApiPayloadService $publicApi,
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

        return response()->json($this->publicApi->statsPayload());
    }
}
