<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
    ) {}

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
    public function store(Request $request): JsonResponse
    {
        abort(405, 'Use the vote endpoint to create payments.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Payment $payment): JsonResponse
    {
        $user = request()->user();
        if ($user->tokenCan('admin') || $payment->user_id === $user?->id) {
            return response()->json([
                'id' => $payment->id,
                'reference' => $payment->reference,
                'status' => $payment->status,
                'amount' => (float) $payment->amount,
                'currency' => $payment->currency,
                'created_at' => $payment->created_at,
                'paid_at' => $payment->paid_at,
            ]);
        }

        abort(403);
    }

    public function sync(string $reference): JsonResponse
    {
        $payment = $this->paymentRepo->findByReference($reference);

        if (! $payment) {
            return response()->json(['message' => 'Paiement introuvable.'], 404);
        }

        if (! $payment->transaction_id) {
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
        if ($merchantReference !== '' && ! hash_equals($payment->reference, $merchantReference)) {
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

        $this->payments->scheduleWarmPaymentStateForReadModels();

        return response()->json($this->syncResponsePayload($payment, $remoteTransaction));
    }

    public function syncPublic(string $reference): JsonResponse
    {
        $payment = $this->paymentRepo->findByReference($reference);

        if (! $payment) {
            return response()->json(['message' => 'Paiement introuvable.'], 404);
        }

        if (! $payment->transaction_id) {
            return response()->json($this->publicSyncPayload($payment));
        }

        try {
            $remoteTransaction = $this->fedapay->retrieveTransaction($payment->transaction_id);
        } catch (\Throwable $exception) {
            logger()->warning('FedaPay public sync failed', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'transaction_id' => $payment->transaction_id,
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Impossible de verifier le paiement pour le moment.',
                'payment' => $this->publicSyncPayload($payment),
            ], 502);
        }

        $merchantReference = trim((string) Arr::get($remoteTransaction, 'merchant_reference', ''));
        if ($merchantReference !== '' && ! hash_equals($payment->reference, $merchantReference)) {
            return response()->json([
                'message' => 'Reference de paiement invalide.',
            ], 409);
        }

        $payment = $this->payments->syncPaymentWithProvider($payment, $remoteTransaction, 'public-sync');

        $this->payments->scheduleWarmPaymentStateForReadModels();

        return response()->json($this->publicSyncPayload($payment, $remoteTransaction));
    }

    /**
     * Update the specified resource in storage.
     */
    public function webhook(Request $request): JsonResponse
    {
        $signature = $request->header('x-fedapay-signature') ?? $request->header('X-FEDAPAY-SIGNATURE');
        $raw = $request->getContent();

        if (! $this->fedapay->verifyWebhookSignature($raw, $signature)) {
            logger()->warning('FedaPay webhook signature validation failed', [
                'has_signature' => filled($signature),
                'signature_preview' => $signature ? substr((string) $signature, 0, 32) : null,
                'webhook_secret_configured' => filled($this->fedapay->webhookSecret()),
            ]);

            return response()->json(['message' => 'Invalid signature'], 401);
        }

        $payload = json_decode($raw, true);
        if (! is_array($payload)) {
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
        $lockKey = 'fedapay:webhook:process:'.$fingerprint;

        if (! Cache::add($lockKey, now()->timestamp, 300)) {
            return response()->json([
                'message' => 'Webhook already processed or in progress',
                'result' => 'duplicate',
            ]);
        }

        // Webhooks are always processed synchronously inside the request. This is the
        // reliable path on shared hosting (LWS) where no queue worker/cron is guaranteed:
        // the vote is confirmed before FedaPay receives our 200, and a 500 lets FedaPay
        // retry if anything fails. Processing is idempotent, so retries are harmless.
        try {
            $result = $this->fedapayWebhooks->processWebhookPayload($payload, $eventName, $transactionId, $reference);

            return response()->json([
                'message' => 'Webhook processed',
                'result' => $result['result'] ?? 'processed',
                'outcome' => $result['outcome'] ?? null,
            ]);
        } catch (\Throwable $exception) {
            logger()->warning('FedaPay webhook processing failed', [
                'event' => $eventName,
                'transaction_id' => $transactionId,
                'reference' => $reference,
                'status' => $status !== '' ? $status : null,
                'error' => $exception->getMessage(),
            ]);

            return response()->json(['message' => 'Webhook processing failed'], 500);
        } finally {
            Cache::forget($lockKey);
        }
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
            data_get($payload, 'data.attributes.id'),
            data_get($payload, 'data.attributes.transaction_id'),
            data_get($payload, 'data.entity.attributes.id'),
            data_get($payload, 'data.object.attributes.id'),
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
            data_get($payload, 'data.attributes.merchant_reference'),
            data_get($payload, 'data.entity.attributes.merchant_reference'),
            data_get($payload, 'data.object.attributes.merchant_reference'),
            data_get($payload, 'data.transaction.merchant_reference'),
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
            data_get($payload, 'data.attributes.reference'),
        ];

        foreach ($candidates as $candidate) {
            $value = trim((string) $candidate);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
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
            data_get($payload, 'data.attributes.status'),
            data_get($payload, 'data.entity.attributes.status'),
            data_get($payload, 'data.object.attributes.status'),
            data_get($payload, 'data.transaction.attributes.status'),
            data_get($payload, 'event.data.status'),
            data_get($payload, 'event.data.attributes.status'),
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
            'amount' => (float) $payment->amount,
            'currency' => $payment->currency,
            'quantity' => (int) ($payment->vote?->quantity ?? data_get($payment->meta, 'quantity', 1)),
            'candidate_name' => trim((string) (
                data_get($payment->meta, 'candidate_name')
                ?: trim(($payment->vote?->candidate?->first_name ?? '').' '.($payment->vote?->candidate?->last_name ?? ''))
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

    private function publicSyncPayload(Payment $payment, ?array $remoteTransaction = null): array
    {
        return $this->syncResponsePayload($payment, $remoteTransaction);
    }
}
