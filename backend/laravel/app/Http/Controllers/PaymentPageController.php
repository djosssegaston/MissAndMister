<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\Payment;
use App\Models\Vote;
use App\Repositories\PaymentRepository;
use App\Services\FedaPayService;
use App\Services\PaymentService;
use App\Services\VoteService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;

class PaymentPageController extends Controller
{
    public function __construct(
        private FedaPayService $fedapay,
        private PaymentService $payments,
        private PaymentRepository $paymentRepo,
        private VoteService $voteService,
    ) {
    }

    public function show(string $reference): View
    {
        $payment = Payment::with('vote')
            ->where('reference', $reference)
            ->firstOrFail();

        $frontendUrl = rtrim((string) (config('app.frontend_url') ?: config('app.frontend-url') ?: env('FRONTEND_URL', '')), '/');
        $candidateId = (int) (Arr::get($payment->meta, 'candidate_id') ?: $payment->vote?->candidate_id ?: 0);
        $candidatePublicUid = trim((string) ($payment->vote?->candidate?->public_uid ?? ''));
        $candidateSlug = trim((string) ($payment->vote?->candidate?->slug ?? ''));
        $candidateName = trim((string) Arr::get($payment->meta, 'candidate_name', ''));

        if (($candidateName === '' || $candidateSlug === '' || $candidatePublicUid === '') && $candidateId > 0) {
            $candidate = Candidate::query()
                ->select(['id', 'public_uid', 'slug', 'first_name', 'last_name'])
                ->find($candidateId);

            if ($candidate) {
                $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
                $candidatePublicUid = $candidatePublicUid !== '' ? $candidatePublicUid : (string) ($candidate->public_uid ?? '');
                $candidateSlug = $candidateSlug !== '' ? $candidateSlug : (string) ($candidate->slug ?? '');
            }
        }

        if ($candidateName === '') {
            $candidateName = 'Candidat inconnu';
        }

        $candidateIdentifier = $candidatePublicUid !== ''
            ? $candidatePublicUid
            : ($candidateSlug !== '' ? $candidateSlug : null);
        $candidateLink = $candidateIdentifier
            ? "{$frontendUrl}/candidates/" . rawurlencode($candidateIdentifier)
            : "{$frontendUrl}/candidates";

        if ($candidateLink === '/candidates') {
            $candidateLink = '/candidates';
        }

        $quantity = (int) ($payment->vote?->quantity ?: Arr::get($payment->meta, 'quantity', 1));
        $paymentData = [
            'reference' => $payment->reference,
            'quantity' => max(1, $quantity),
            'amount' => (float) $payment->amount,
            'transaction_id' => (string) ($payment->transaction_id ?? ''),
            'payment_status' => (string) $payment->status,
            'vote_status' => (string) ($payment->vote?->status ?? ''),
        ];
        $voteConfirmed = $payment->vote?->status === Vote::STATUS_CONFIRMED;
        $voteFailed = $payment->vote?->status === 'failed';
        $paymentState = $payment->status === 'succeeded' && $voteConfirmed
            ? 'success'
            : (($payment->status === 'failed' || $voteFailed) ? 'failed' : 'opening');
        $paymentDescription = $candidateName !== 'Candidat inconnu'
            ? 'Vote sécurisé pour ' . $candidateName
            : 'Paiement sécurisé Miss & Mister University Bénin 2026';
        $confirmationUrls = $this->buildConfirmationUrls(
            $payment,
            $frontendUrl
        );

        return view('payments.show', [
            'payment' => $payment,
            'frontendUrl' => $frontendUrl,
            'candidateName' => $candidateName,
            'candidateLink' => $candidateLink,
            'paymentData' => $paymentData,
            'paymentState' => $paymentState,
            'paymentDescription' => $paymentDescription,
            'fedapayPublicKey' => $this->fedapay->publicKey() ?? config('services.fedapay.public_key'),
            'fedapayEnvironment' => $this->fedapay->environment(),
            'fedapayConfigured' => $this->fedapay->isConfigured(),
            'fedapayScriptUrl' => 'https://cdn.fedapay.com/checkout.js?v=1.1.7',
            'paymentSuccessUrl' => $confirmationUrls['success'],
            'paymentFailureUrl' => $confirmationUrls['failed'],
            'paymentProcessingUrl' => $confirmationUrls['processing'],
            'paymentCallbackUrl' => route('payments.callback', ['reference' => $payment->reference]),
        ]);
    }

    public function callback(string $reference): RedirectResponse
    {
        $payment = Payment::with('vote')
            ->where('reference', $reference)
            ->firstOrFail();
        $payment = $this->synchronizeForCallback($payment);

        $frontendUrl = rtrim((string) (config('app.frontend_url') ?: config('app.frontend-url') ?: env('FRONTEND_URL', '')), '/');
        $candidateId = (int) (Arr::get($payment->meta, 'candidate_id') ?: $payment->vote?->candidate_id ?: 0);
        $candidateIdentifier = trim((string) ($payment->vote?->candidate?->public_uid ?? ''));
        if ($candidateIdentifier === '' && $candidateId > 0) {
            $candidateIdentifier = (string) Candidate::query()
                ->whereKey($candidateId)
                ->value('public_uid');
        }
        if ($candidateIdentifier === '' && $candidateId > 0) {
            $candidateIdentifier = (string) Candidate::query()
                ->whereKey($candidateId)
                ->value('slug');
        }
        $urls = $this->buildConfirmationUrls(
            $payment,
            $frontendUrl
        );

        $voteStatus = (string) ($payment->vote?->status ?? '');
        if ($payment->status === 'succeeded' && $voteStatus === Vote::STATUS_CONFIRMED) {
            return $this->redirectToFrontendUrl($urls['success']);
        }

        if ($payment->status === 'failed' || $voteStatus === 'failed') {
            return $this->redirectToFrontendUrl($urls['failed']);
        }

        return $this->redirectToFrontendUrl($urls['processing']);
    }

    private function synchronizeForCallback(Payment $payment): Payment
    {
        $payment->loadMissing('vote');

        if (!$payment->transaction_id) {
            return $payment;
        }

        if (
            $payment->status === 'succeeded' && $payment->vote?->status === Vote::STATUS_CONFIRMED
            || $payment->status === 'failed'
            || $payment->vote?->status === 'failed'
        ) {
            return $payment;
        }

        try {
            $remoteTransaction = $this->fedapay->retrieveTransaction($payment->transaction_id);
        } catch (\Throwable $exception) {
            logger()->warning('FedaPay callback sync failed', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'transaction_id' => $payment->transaction_id,
                'error' => $exception->getMessage(),
            ]);

            return $payment->fresh(['vote']);
        }

        $merchantReference = trim((string) Arr::get($remoteTransaction, 'merchant_reference', ''));
        if ($merchantReference !== '' && !hash_equals($payment->reference, $merchantReference)) {
            logger()->warning('FedaPay callback reference mismatch', [
                'payment_id' => $payment->id,
                'reference' => $payment->reference,
                'remote_reference' => $merchantReference,
            ]);

            return $payment->fresh(['vote']);
        }

        $remoteStatus = strtolower((string) Arr::get($remoteTransaction, 'status', ''));
        $successStates = ['approved', 'succeeded', 'successful', 'success', 'paid'];
        $failureStates = ['canceled', 'cancelled', 'declined', 'failed', 'expired', 'rejected'];

        if (in_array($remoteStatus, $successStates, true)) {
            $payment = $this->payments->confirm($payment->reference, $remoteTransaction) ?? $payment;

            $vote = Vote::where('payment_id', $payment->id)->first();
            if ($vote) {
                $this->voteService->confirmVote($vote);
            }

            return $payment->fresh(['vote']);
        }

        if (in_array($remoteStatus, $failureStates, true)) {
            $payment = $this->paymentRepo->updateStatus($payment, 'failed', $remoteTransaction);

            $vote = Vote::where('payment_id', $payment->id)->first();
            if ($vote) {
                $this->voteService->failVote($vote, 'callback-sync');
            }

            return $payment->fresh(['vote']);
        }

        $this->paymentRepo->updateStatus($payment, 'processing', $remoteTransaction);

        return $payment->fresh(['vote']);
    }

    private function buildConfirmationUrls(
        Payment $payment,
        string $frontendUrl,
    ): array {
        $basePath = ($frontendUrl !== '' ? $frontendUrl : '') . '/payment/confirmation';
        $baseParams = array_filter([
            'reference' => $payment->reference,
        ], static fn ($value) => $value !== null && $value !== '');

        $build = function (string $status) use ($basePath, $baseParams): string {
            $params = array_merge($baseParams, ['status' => $status]);
            return $basePath . '?' . http_build_query($params);
        };

        return [
            'success' => $build('success'),
            'failed' => $build('failed'),
            'processing' => $build('processing'),
        ];
    }

    private function redirectToFrontendUrl(string $url): RedirectResponse
    {
        if (str_starts_with($url, 'http://') || str_starts_with($url, 'https://')) {
            return redirect()->away($url);
        }

        return redirect($url);
    }
}
