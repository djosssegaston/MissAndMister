<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Vote;
use App\Repositories\PaymentRepository;
use App\Jobs\SendVoteConfirmationJob;
use App\Services\KkiapayService;
use App\Services\PaymentService;
use App\Services\VoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentService $payments,
        private PaymentRepository $paymentRepo,
        private VoteService $voteService,
        private KkiapayService $kkiapay,
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

    /**
     * Update the specified resource in storage.
     */
    public function webhook(Request $request): JsonResponse
    {
        $signature = $request->header('x-kkiapay-secret') ?? $request->header('X-KKIAPAY-SECRET');
        $raw = $request->getContent();

        if (!$this->kkiapay->verifySignature($raw, $signature)) {
            return response()->json(['message' => 'Invalid signature'], 401);
        }

        $reference = (string) ($request->input('partnerId') ?? $request->input('reference') ?? '');
        $isSuccess = $request->boolean('isPaymentSucces')
            || $request->input('event') === 'transaction.success'
            || in_array(strtolower((string) $request->input('status', '')), ['success', 'succeeded'], true);

        $payment = $this->paymentRepo->findByReference($reference);
        if (!$payment) {
            return response()->json(['message' => 'Payment not found'], 404);
        }

        if ($isSuccess) {
            $payment = $this->payments->confirm($reference, $request->all());

            $vote = Vote::where('payment_id', $payment->id)->first();
            if ($vote) {
                $this->voteService->confirmVote($vote);
                SendVoteConfirmationJob::dispatch($vote->id);
            }
        } else {
            $this->paymentRepo->updateStatus($payment, 'failed', $request->all());
        }

        return response()->json(['message' => 'Webhook processed']);
    }
}
