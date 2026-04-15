<?php

namespace App\Http\Controllers;

use App\Models\Candidate;
use App\Models\Payment;
use App\Services\FedaPayService;
use Illuminate\Contracts\View\View;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Arr;

class PaymentPageController extends Controller
{
    public function __construct(private FedaPayService $fedapay)
    {
    }

    public function show(string $reference): View
    {
        $payment = Payment::with('vote')
            ->where('reference', $reference)
            ->firstOrFail();

        $frontendUrl = rtrim((string) (config('app.frontend_url') ?: config('app.frontend-url') ?: env('FRONTEND_URL', '')), '/');
        $candidateId = (int) (Arr::get($payment->meta, 'candidate_id') ?: $payment->vote?->candidate_id ?: 0);
        $candidateName = trim((string) Arr::get($payment->meta, 'candidate_name', ''));

        if ($candidateName === '' && $candidateId > 0) {
            $candidate = Candidate::query()
                ->select(['id', 'first_name', 'last_name'])
                ->find($candidateId);

            if ($candidate) {
                $candidateName = trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''));
            }
        }

        if ($candidateName === '') {
            $candidateName = 'Candidat inconnu';
        }

        $candidateLink = $candidateId > 0
            ? "{$frontendUrl}/candidates/{$candidateId}"
            : "{$frontendUrl}/candidates";

        if ($candidateLink === '/candidates') {
            $candidateLink = '/candidates';
        }

        $quantity = (int) ($payment->vote?->quantity ?: Arr::get($payment->meta, 'quantity', 1));
        $paymentData = [
            'reference' => $payment->reference,
            'payment_id' => $payment->id,
            'vote_id' => $payment->vote?->id,
            'candidate_id' => $candidateId ?: null,
            'quantity' => max(1, $quantity),
            'amount' => (float) $payment->amount,
            'transaction_id' => (string) ($payment->transaction_id ?? ''),
        ];
        $paymentState = $payment->status === 'succeeded'
            ? 'success'
            : ($payment->status === 'failed' ? 'failed' : 'opening');
        $paymentDescription = $candidateName !== 'Candidat inconnu'
            ? 'Vote sécurisé pour ' . $candidateName
            : 'Paiement sécurisé Miss & Mister University Bénin 2026';

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
        ]);
    }

    public function callback(string $reference): RedirectResponse
    {
        return redirect()->route('payments.show', [
            'reference' => $reference,
            'payment' => 'processing',
        ]);
    }
}
