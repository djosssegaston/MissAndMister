<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessFedapayWebhookJob;
use App\Models\Candidate;
use App\Models\Payment;
use App\Repositories\PaymentRepository;
use App\Services\FedaPayService;
use App\Services\FedapayWebhookService;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $payments,
        private PaymentRepository $paymentRepo,
        private FedaPayService $fedapay,
        private FedapayWebhookService $fedapayWebhooks,
    ) {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $this->payments->scheduleWarmPaymentStateForReadModels();
        return response()->json(Payment::latest()->paginate(30));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(Payment $payment): JsonResponse
    {
        $user = request()->user();
        if ($user->tokenCan('admin') || $payment->user_id === $user?->id) {
            return response()->json($payment->load('transactions'));
        }

        abort(403);
    }

    public function sync(string $reference): JsonResponse
    {
        $payment = $this->paymentRepo->findByReference($reference);

        if (!$payment) {
            return response()->json(['message' => 'Paiement introuvable.'], 404);
        }

        if (!$payment->transaction_id) {
            return response()->json($this->syncResponsePayload($payment));
        }

        try {
            $remoteTransaction = $this->fedapay->retrieveTransaction($payment->transaction_id);
        } catch (\Throwable $exception) {
            logger()->warning('FedaPay payment sync failed', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'transaction_id' => $payment->transaction_id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Impossible de verifier le paiement pour le moment.',
                'payment' => $this->syncResponsePayload($payment),
            ], 502);
        }

        $merchantReference = trim((string) Arr::get($remoteTransaction, 'merchant_reference', ''));
        if ($merchantReference !== '' && !hash_equals($payment->reference, $merchantReference)) {
            logger()->warning('FedaPay sync reference mismatch', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'remote_reference' => $merchantReference,
            ]);

            return response()->json([
                'message' => 'Reference de paiement invalide.',
            ], 409);
        }

        $payment = $this->payments->syncPaymentWithProvider($payment, $remoteTransaction, 'manual-sync');

        return response()->json($this->syncResponsePayload($payment, $remoteTransaction));
    }

    /**
     * Update the specified resource in storage.
     */
    public function webhook(Request $request): JsonResponse
    {
        $signature = $request->header('x-fedapay-signature') ?? $request->header('X-FEDAPAY-SIGNATURE');
        $raw = $request->getContent();

        if (!$this->fedapay->verifyWebhookSignature($raw, $signature)) {
            logger()->warning('FedaPay webhook signature validation failed', [
                'has_signature' => filled($signature),
                'signature_preview' => $signature ? substr((string) $signature, 0, 32) : null,
                'webhook_secret_configured' => filled($this->fedapay->webhookSecret()),
            ]);

            return response()->json(['message' => 'Invalid signature'], 401);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            $payload = $request->all();
        }

        $eventName = $this->extractEventName($payload);
        $transactionId = $this->extractTransactionId($payload);
        $reference = $this->extractPaymentReference($payload);
        $status = $this->extractWebhookStatus($payload);
        $fingerprint = sha1(json_encode([
            'event' => $eventName,
            'transaction_id' => $transactionId,
            'reference' => $reference,
            'payload_id' => data_get($payload, 'id') ?? data_get($payload, 'data.id'),
            'status' => $status,
            'updated_at' => data_get($payload, 'updated_at') ?? data_get($payload, 'data.updated_at'),
        ]));
        $lockKey = 'fedapay:webhook:process:' . $fingerprint;

        if (!Cache::add($lockKey, now()->timestamp, 600)) {
            return response()->json([
                'message' => 'Webhook already queued',
                'result' => 'duplicate',
            ]);
        }

        if (!$this->shouldProcessWebhookAsynchronously()) {
            try {
                $result = $this->fedapayWebhooks->processWebhookPayload($payload, $eventName, $transactionId, $reference);
            } catch (\Throwable $exception) {
                Cache::forget($lockKey);
                logger()->warning('FedaPay webhook processing failed', [
                    'event' => $eventName,
                    'transaction_id' => $transactionId,
                    'reference' => $reference,
                    'status' => $status !== '' ? $status : null,
                    'error' => $exception->getMessage(),
                ]);

                return response()->json(['message' => 'Webhook processing failed'], 500);
            }

            return response()->json([
                'message' => 'Webhook processed',
                'result' => $result['result'] ?? 'processed',
                'outcome' => $result['outcome'] ?? null,
            ]);
        }

        try {
            ProcessFedapayWebhookJob::dispatchAfterResponse(
                $payload,
                $eventName,
                $transactionId,
                $reference,
                $status,
                $fingerprint,
                $lockKey,
            )->onQueue((string) config('services.fedapay.webhook_queue', 'default'));
        } catch (\Throwable $exception) {
            logger()->warning('FedaPay webhook queue dispatch failed', [
                'event' => $eventName,
                'transaction_id' => $transactionId,
                'reference' => $reference,
                'status' => $status !== '' ? $status : null,
                'error' => $exception->getMessage(),
            ]);

            try {
                $result = $this->fedapayWebhooks->processWebhookPayload($payload, $eventName, $transactionId, $reference);

                return response()->json([
                    'message' => 'Webhook processed',
                    'result' => $result['result'] ?? 'processed',
                    'outcome' => $result['outcome'] ?? null,
                ]);
            } catch (\Throwable $fallbackException) {
                Cache::forget($lockKey);

                logger()->warning('FedaPay webhook fallback processing failed', [
                    'event' => $eventName,
                    'transaction_id' => $transactionId,
                    'reference' => $reference,
                    'status' => $status !== '' ? $status : null,
                    'error' => $fallbackException->getMessage(),
                ]);

                return response()->json(['message' => 'Webhook processing failed'], 500);
            }
        }

        return response()->json([
            'message' => 'Webhook accepted',
            'result' => 'queued',
            'outcome' => 'processing',
        ]);
    }

    private function extractEventName(array $payload): string
    {
        $candidates = [
            data_get($payload, 'name'),
            data_get($payload, 'event'),
            data_get($payload, 'type'),
            data_get($payload, 'data.name'),
            data_get($payload, 'data.event'),
        ];

        foreach ($candidates as $candidate) {
            $value = strtolower(trim((string) $candidate));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function extractTransactionId(array $payload): ?string
    {
        $candidates = [
            data_get($payload, 'data.id'),
            data_get($payload, 'data.entity.id'),
            data_get($payload, 'data.object.id'),
            data_get($payload, 'data.transaction_id'),
            data_get($payload, 'transaction.id'),
            data_get($payload, 'data.transaction.id'),
            data_get($payload, 'transaction_id'),
            data_get($payload, 'entity.id'),
            data_get($payload, 'id'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function extractPaymentReference(array $payload): ?string
    {
        $candidates = [
            data_get($payload, 'merchant_reference'),
            data_get($payload, 'data.merchant_reference'),
            data_get($payload, 'data.entity.merchant_reference'),
            data_get($payload, 'data.object.merchant_reference'),
            data_get($payload, 'reference'),
            data_get($payload, 'data.reference'),
            data_get($payload, 'data.entity.reference'),
            data_get($payload, 'data.object.reference'),
            data_get($payload, 'custom_metadata.payment_reference'),
            data_get($payload, 'data.custom_metadata.payment_reference'),
            data_get($payload, 'data.custom_metadata.reference'),
            data_get($payload, 'data.entity.custom_metadata.payment_reference'),
            data_get($payload, 'data.entity.custom_metadata.reference'),
            data_get($payload, 'data.object.custom_metadata.payment_reference'),
            data_get($payload, 'data.object.custom_metadata.reference'),
            data_get($payload, 'transaction.reference'),
            data_get($payload, 'data.transaction.reference'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function shouldProcessWebhookAsynchronously(): bool
    {
        if (app()->environment('testing')) {
            return (bool) config('services.fedapay.webhook_async', false);
        }

        return (bool) config('services.fedapay.webhook_async', true);
    }

    private function extractWebhookStatus(array $payload): string
    {
        $candidates = [
            data_get($payload, 'status'),
            data_get($payload, 'data.status'),
            data_get($payload, 'data.entity.status'),
            data_get($payload, 'data.object.status'),
            data_get($payload, 'data.transaction.status'),
            data_get($payload, 'transaction.status'),
        ];

        foreach ($candidates as $candidate) {
            $value = strtolower(trim((string) $candidate));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private function syncResponsePayload(Payment $payment, ?array $remoteTransaction = null): array
    {
        $payment->loadMissing('vote.candidate');
        $candidateVotesCount = null;

        if ($payment->vote?->candidate_id) {
            $candidate = Candidate::query()
                ->whereKey($payment->vote->candidate_id)
                ->withSum(['votes as votes_count' => function ($query) {
                    $query->where('status', 'confirmed');
                }], 'quantity')
                ->first();

            if ($candidate) {
                $candidateVotesCount = (int) ($candidate->votes_count ?? 0);
            }
        }

        return [
            'reference' => $payment->reference,
            'payment_status' => $payment->status,
            'vote_status' => $payment->vote?->status,
            'transaction_id' => $payment->transaction_id,
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency,
            'quantity' => (int) ($payment->vote?->quantity ?? data_get($payment->meta, 'quantity', 1)),
            'candidate_name' => trim((string) (
                data_get($payment->meta, 'candidate_name')
                ?: trim(($payment->vote?->candidate?->first_name ?? '') . ' ' . ($payment->vote?->candidate?->last_name ?? ''))
            )),
            'candidate_public_uid' => $payment->vote?->candidate?->public_uid,
            'candidate_slug' => $payment->vote?->candidate?->slug,
            'candidate_public_number' => $payment->vote?->candidate?->public_number,
            'candidate_votes_count' => $candidateVotesCount,
            'votes_count' => $candidateVotesCount,
            'votes' => $candidateVotesCount,
            'remote_status' => $remoteTransaction ? strtolower((string) Arr::get($remoteTransaction, 'status', '')) : null,
        ];
    }
}
