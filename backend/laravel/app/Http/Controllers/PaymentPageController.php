<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use Illuminate\Contracts\View\View;

class PaymentPageController extends Controller
{
    public function show(string $reference): View
    {
        $payment = Payment::with(['vote.candidate'])
            ->where('reference', $reference)
            ->firstOrFail();

        return view('payments.show', [
            'payment' => $payment,
            'frontendUrl' => rtrim((string) config('app.frontend_url'), '/'),
            'kkiapayPublicKey' => config('services.kkiapay.public_key'),
            'sandbox' => config('app.env') !== 'production',
        ]);
    }
}
