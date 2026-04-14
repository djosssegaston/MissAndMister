<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Services\FedaPayService;
use Illuminate\Contracts\View\View;

class PaymentPageController extends Controller
{
    public function __construct(private FedaPayService $fedapay)
    {
    }

    public function show(string $reference): View
    {
        $payment = Payment::with(['vote.candidate'])
            ->where('reference', $reference)
            ->firstOrFail();

        return view('payments.show', [
            'payment' => $payment,
            'frontendUrl' => rtrim((string) config('app.frontend_url'), '/'),
            'fedapayPublicKey' => $this->fedapay->publicKey() ?? config('services.fedapay.public_key'),
            'fedapayEnvironment' => $this->fedapay->environment(),
            'fedapayConfigured' => $this->fedapay->isConfigured(),
            'fedapayScriptUrl' => 'https://cdn.fedapay.com/checkout.js?v=1.1.7',
        ]);
    }
}
