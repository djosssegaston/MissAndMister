<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VoteRequest;
use App\Models\Candidate;
use App\Models\Payment;
use App\Models\Vote;
use App\Services\PaymentService;
use App\Services\VoteService;
use App\Services\VotingWindowService;
use App\Repositories\VoteRepository;
use App\Models\Setting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VoteController extends Controller
{
    public function __construct(
        private VoteService $voteService,
        private PaymentService $payments,
        private VoteRepository $votes,
        private VotingWindowService $votingWindow,
    )
    {
    }

    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $this->payments->reconcileSuccessfulAssociations();
        $filters = request()->only(['status', 'candidate_id', 'from', 'to']);
        $perPage = max(5, min((int) request()->get('per_page', 20), 500));
        $list = $this->votes->paginateFiltered($filters, $perPage);
        return response()->json($list);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(VoteRequest $request): JsonResponse
    {
        $settings = Setting::whereIn('key', [
            'maintenance_mode',
            'voting_open',
            'vote_start_at',
            'vote_end_at',
            ...$this->votingWindow->runtimeKeys(),
        ])->pluck('value', 'key')->toArray();

        $votingStatus = $this->votingWindow->computeState($settings);
        if ($votingStatus['blocked']) {
            $statusCode = $votingStatus['reason'] === 'maintenance' ? 503 : 403;
            return response()->json([
                'message' => $votingStatus['message'],
                'reason' => $votingStatus['reason'],
            ], $statusCode);
        }

        $user = $this->resolveOptionalAuthenticatedUser($request);
        $quantity = $request->integer('quantity', 1);
        $candidateId = $request->integer('candidate_id');

        if (!$candidateId) {
            $identifier = trim((string) $request->input('candidate_identifier', ''));
            $candidateId = Candidate::query()
                ->where('public_uid', $identifier)
                ->orWhere('slug', $identifier)
                ->when(ctype_digit($identifier), fn ($query) => $query->orWhere('public_number', (int) $identifier))
                ->value('id');
        }

        if (!$candidateId) {
            return response()->json([
                'message' => 'Candidat introuvable pour cette opération.',
            ], 422);
        }

        [$payment, $vote] = $this->voteService->initiateVote(
            $user->id ?? null,
            (int) $candidateId,
            $request->float('amount'),
            $request->input('currency', 'XOF'),
            $request->ip(),
            ['user_agent' => $request->userAgent(), 'quantity' => $quantity],
            $quantity,
        );

        return response()->json([
            'message' => 'Payment initiated, vote pending confirmation',
            'payment' => $payment,
            'payment_url' => $payment->meta['payment_url'] ?? null,
            'vote' => $vote,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(int $id): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $this->payments->reconcileSuccessfulAssociations();
        $vote = $this->votes->paginateFiltered(['id' => $id], 1)->first();
        if (!$vote) {
            return response()->json(['message' => 'Vote not found'], 404);
        }
        return response()->json($vote);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $vote = Vote::with('payment')->find($id);
        if (!$vote) {
            return response()->json(['message' => 'Vote not found'], 404);
        }
        $data = $request->validate([
            'status' => ['required', 'in:pending,confirmed,failed,cancelled,suspect'],
        ]);

        if (
            $data['status'] === Vote::STATUS_CONFIRMED
            && $vote->payment
            && $vote->payment->status !== \App\Models\Payment::STATUS_SUCCEEDED
        ) {
            return response()->json([
                'message' => 'Seuls les votes associes a un paiement reussi peuvent etre valides.',
            ], 422);
        }

        if ($this->isProtectedSuccessfulVote($vote) && $data['status'] !== Vote::STATUS_CONFIRMED) {
            return response()->json([
                'message' => 'Un vote confirme avec paiement FedaPay reussi ne peut plus etre modifie par l’administration.',
            ], 422);
        }

        if ($data['status'] === Vote::STATUS_CONFIRMED) {
            $vote = $this->voteService->confirmVote($vote);
        } elseif ($data['status'] === 'failed') {
            $vote = $this->voteService->failVote($vote, 'admin_review');
        } else {
            $vote->update($data);
            $vote->refresh();
        }

        return response()->json($vote->load(['user:id,name,email', 'candidate:id,first_name,last_name,category_id', 'candidate.category:id,name']));
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $vote = Vote::with(['payment.transactions'])->find($id);
        if (!$vote) {
            return response()->json(['message' => 'Vote not found'], 404);
        }

        $actor = request()->user();
        $paymentSucceeded = $vote->payment?->status === Payment::STATUS_SUCCEEDED;

        if ($paymentSucceeded && ($actor->role ?? null) !== 'superadmin') {
            return response()->json([
                'message' => 'Seul le superadmin peut supprimer un vote confirme avec paiement FedaPay reussi.',
            ], 403);
        }

        DB::transaction(function () use ($vote, $paymentSucceeded) {
            if (!$paymentSucceeded && $vote->payment) {
                $vote->payment->transactions()->withTrashed()->get()->each->forceDelete();
                $vote->payment->forceDelete();
            }

            $vote->forceDelete();
        });

        return response()->json([
            'message' => $paymentSucceeded
                ? 'Vote supprime definitivement par le superadmin.'
                : 'Vote et paiement non confirme supprimes definitivement.',
        ]);
    }

    public function export(): StreamedResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $this->payments->reconcileSuccessfulAssociations();
        $filters = request()->only(['status', 'candidate_id', 'from', 'to']);
        $query = \App\Models\Vote::with(['user', 'candidate.category', 'payment'])
            ->when(isset($filters['status']) && $filters['status'], fn($q) => $q->where('status', $filters['status']))
            ->when(isset($filters['candidate_id']) && $filters['candidate_id'], fn($q) => $q->where('candidate_id', $filters['candidate_id']))
            ->when(isset($filters['from']) && $filters['from'], fn($q) => $q->whereDate('created_at', '>=', $filters['from']))
            ->when(isset($filters['to']) && $filters['to'], fn($q) => $q->whereDate('created_at', '<=', $filters['to']))
            ->orderByDesc('created_at');

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="votes_export.csv"',
        ];

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['ID', 'User', 'Email', 'Candidate', 'Category', 'Status', 'Votes', 'Amount', 'Currency', 'Payment Ref', 'IP', 'Created At']);
            $query->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $v) {
                    fputcsv($out, [
                        $v->id,
                        $v->user?->name,
                        $v->user?->email,
                        trim(($v->candidate?->first_name ?? '') . ' ' . ($v->candidate?->last_name ?? '')),
                        $v->candidate?->category?->name,
                        $v->status,
                        $v->quantity,
                        $v->payment?->amount,
                        $v->payment?->currency,
                        $v->payment?->reference,
                        $v->ip_address,
                        optional($v->created_at)->toDateTimeString(),
                    ]);
                }
            });
            fclose($out);
        }, 200, $headers);
    }

    private function resolveOptionalAuthenticatedUser(Request $request): mixed
    {
        if ($request->user()) {
            return $request->user();
        }

        $plainTextToken = trim((string) $request->bearerToken());
        if ($plainTextToken === '') {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($plainTextToken);
        $tokenable = $accessToken?->tokenable;

        if (!$tokenable || ($tokenable->role ?? null) !== 'user' || ($tokenable->status ?? 'active') !== 'active') {
            return null;
        }

        return $tokenable;
    }

    private function isProtectedSuccessfulVote(Vote $vote): bool
    {
        return $vote->status === Vote::STATUS_CONFIRMED
            && $vote->payment?->status === Payment::STATUS_SUCCEEDED;
    }
}
