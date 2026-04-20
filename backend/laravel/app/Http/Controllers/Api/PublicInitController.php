<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use App\Services\PublicApiPayloadService;
use Illuminate\Http\JsonResponse;

class PublicInitController extends Controller
{
    public function __construct(
        private PublicApiPayloadService $publicApi,
        private PaymentService $payments,
    ) {
    }

    public function show(): JsonResponse
    {
        $this->payments->scheduleWarmPaymentStateForReadModels();

        return response()->json($this->publicApi->initDataPayload());
    }

    public function lastUpdate(): JsonResponse
    {
        return response()->json($this->publicApi->updateSignalPayload());
    }
}
