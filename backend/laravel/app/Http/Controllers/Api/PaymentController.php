<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Vote;
use App\Repositories\PaymentRepository;
use App\Jobs\SendVoteConfirmationJob;
use App\Services\FedaPayService;
use App\Services\PaymentService;
use App\Services\VoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $payments,
        private PaymentRepository $paymentRepo,
        private VoteService $voteService,
        private FedaPayService $fedapay,
    ) {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
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

        $payment = $this->applyOutcome(
            $payment,
            $this->resolveWebhookOutcome($remoteTransaction, $remoteTransaction, 'manual-sync'),
            $remoteTransaction
        );

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
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            $payload = $request->all();
        }

        $eventName = $this->extractEventName($payload);
        $transactionId = $this->extractTransactionId($payload);
        $reference = $this->extractPaymentReference($payload);

        $payment = null;
        if ($transactionId !== null) {
            $payment = $this->paymentRepo->findByTransactionId($transactionId);
        }
        if (!$payment && $reference !== null) {
            $payment = $this->paymentRepo->findByReference($reference);
        }

        if (!$payment) {
            logger()->warning('FedaPay webhook received but no local payment matched', [
                'event' => $eventName,
                'transaction_id' => $transactionId,
                'reference' => $reference,
            ]);

            return response()->json(['message' => 'Webhook processed']);
        }

        $remoteTransaction = null;
        if ($transactionId !== null) {
            try {
                $remoteTransaction = $this->fedapay->retrieveTransaction($transactionId);
            } catch (\Throwable $exception) {
                logger()->warning('FedaPay transaction lookup failed during webhook sync', [
                    'payment_id' => $payment->id,
                    'transaction_id' => $transactionId,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        $outcome = $this->resolveWebhookOutcome($payload, $remoteTransaction, $eventName);

        $this->applyOutcome($payment, $outcome, $remoteTransaction ?: $payload, $eventName);

        return response()->json(['message' => 'Webhook processed']);
    }

    private function applyOutcome(Payment $payment, string $outcome, array $payload = [], ?string $eventName = null): Payment
    {
        if ($outcome === 'succeeded') {
            $payment = $this->payments->confirm($payment->reference, $payload);

            $vote = Vote::where('payment_id', $payment->id)->first();
            if ($vote) {
                $this->voteService->confirmVote($vote);
                SendVoteConfirmationJob::dispatch($vote->id);
            }

            return $payment->fresh(['vote']);
        }

        if ($outcome === 'failed') {
            $payment = $this->paymentRepo->updateStatus($payment, 'failed', $payload);
            $vote = Vote::where('payment_id', $payment->id)->first();
            if ($vote) {
                $this->voteService->failVote($vote, $eventName ?: 'transaction.failed');
            }

            return $payment->fresh(['vote']);
        }

        if ($outcome === 'processing') {
            $payment = $this->paymentRepo->updateStatus($payment, 'processing', $payload);
        }

        return $payment->fresh(['vote']);
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
            data_get($payload, 'reference'),
            data_get($payload, 'data.reference'),
            data_get($payload, 'data.entity.reference'),
            data_get($payload, 'custom_metadata.payment_reference'),
            data_get($payload, 'data.custom_metadata.payment_reference'),
            data_get($payload, 'data.custom_metadata.reference'),
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

    private function resolveWebhookOutcome(array $payload, ?array $remoteTransaction, string $eventName): string
    {
        $status = strtolower((string) (
            data_get($remoteTransaction, 'status')
            ?? data_get($payload, 'status')
            ?? data_get($payload, 'data.status')
            ?? ''
        ));

        $approvedIndicators = ['approved', 'succeeded', 'successful', 'success', 'paid'];
        $failureIndicators = ['canceled', 'cancelled', 'declined', 'failed', 'expired', 'rejected'];
        $processingIndicators = ['pending', 'processing', 'created', 'initiated'];

        if (in_array($status, $approvedIndicators, true) || str_contains($eventName, 'approved') || str_contains($eventName, 'success')) {
            return 'succeeded';
        }

        if (in_array($status, $failureIndicators, true) || str_contains($eventName, 'canceled') || str_contains($eventName, 'cancelled') || str_contains($eventName, 'declined') || str_contains($eventName, 'failed')) {
            return 'failed';
        }

        if (in_array($status, $processingIndicators, true) || str_contains($eventName, 'pending') || str_contains($eventName, 'created')) {
            return 'processing';
        }

        return 'processing';
    }

    private function syncResponsePayload(Payment $payment, ?array $remoteTransaction = null): array
    {
        $payment->loadMissing('vote');

        return [
            'reference' => $payment->reference,
            'payment_status' => $payment->status,
            'vote_status' => $payment->vote?->status,
            'transaction_id' => $payment->transaction_id,
            'remote_status' => $remoteTransaction ? strtolower((string) Arr::get($remoteTransaction, 'status', '')) : null,
        ];
    }
}
