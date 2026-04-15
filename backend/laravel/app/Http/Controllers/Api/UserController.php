<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use App\Models\User;

class UserController extends Controller
{
    public function __construct(private PaymentService $payments)
    {
    }

    public function profile(): JsonResponse
    {
        $user = request()->user();
        return response()->json($user->load(['votes', 'payments']));
    }

    public function dashboard(): JsonResponse
    {
        $this->payments->reconcileSuccessfulAssociations();

        $user = request()->user();
        return response()->json([
            'message' => 'User dashboard',
            'stats' => [
                'votes' => $user->votes()->successful()->sum('quantity'),
                'payments' => $user->payments()->succeeded()->count(),
            ],
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $this->payments->reconcileSuccessfulAssociations();
        $perPage = max(25, min((int) request()->integer('per_page', 200), 500));

        // Utilisateurs inscrits
        $registered = User::query()
            ->where('role', 'user')
            ->withCount(['payments as payments_count' => function ($q) {
                $q->succeeded();
            }])
            ->select(['id', 'name', 'email', 'phone', 'status', 'created_at'])
            ->addSelect([
                'votes_count' => function ($q) {
                    $q->from('votes')
                        ->selectRaw('COALESCE(SUM(votes.quantity), 0)')
                        ->where('votes.status', 'confirmed')
                        ->where(function ($voteQuery) {
                            $voteQuery
                                ->whereColumn('votes.user_id', 'users.id')
                                ->orWhere(function ($fallbackQuery) {
                                    $fallbackQuery
                                        ->whereNull('votes.user_id')
                                        ->whereExists(function ($paymentQuery) {
                                            $paymentQuery
                                                ->selectRaw('1')
                                                ->from('payments')
                                                ->whereColumn('payments.id', 'votes.payment_id')
                                                ->whereColumn('payments.user_id', 'users.id')
                                                ->where('payments.status', 'succeeded');
                                        });
                                });
                        })
                        ->where(function ($voteQuery) {
                            $voteQuery
                                ->whereNull('votes.payment_id')
                                ->orWhereExists(function ($paymentQuery) {
                                    $paymentQuery
                                        ->selectRaw('1')
                                        ->from('payments')
                                        ->whereColumn('payments.id', 'votes.payment_id')
                                        ->where('payments.status', 'succeeded');
                                });
                        });
                },
            ])
            ->addSelect([
                'last_vote_ip' => function ($q) {
                    $q->from('votes')
                        ->where('votes.status', 'confirmed')
                        ->where(function ($voteQuery) {
                            $voteQuery
                                ->whereColumn('votes.user_id', 'users.id')
                                ->orWhere(function ($fallbackQuery) {
                                    $fallbackQuery
                                        ->whereNull('votes.user_id')
                                        ->whereExists(function ($paymentQuery) {
                                            $paymentQuery
                                                ->selectRaw('1')
                                                ->from('payments')
                                                ->whereColumn('payments.id', 'votes.payment_id')
                                                ->whereColumn('payments.user_id', 'users.id')
                                                ->where('payments.status', 'succeeded');
                                        });
                                });
                        })
                        ->where(function ($voteQuery) {
                            $voteQuery
                                ->whereNull('votes.payment_id')
                                ->orWhereExists(function ($paymentQuery) {
                                    $paymentQuery
                                        ->selectRaw('1')
                                        ->from('payments')
                                        ->whereColumn('payments.id', 'votes.payment_id')
                                        ->where('payments.status', 'succeeded');
                                });
                        })
                        ->orderByDesc('created_at')
                        ->limit(1)
                        ->select('ip_address');
                },
                'last_vote_at' => function ($q) {
                    $q->from('votes')
                        ->where('votes.status', 'confirmed')
                        ->where(function ($voteQuery) {
                            $voteQuery
                                ->whereColumn('votes.user_id', 'users.id')
                                ->orWhere(function ($fallbackQuery) {
                                    $fallbackQuery
                                        ->whereNull('votes.user_id')
                                        ->whereExists(function ($paymentQuery) {
                                            $paymentQuery
                                                ->selectRaw('1')
                                                ->from('payments')
                                                ->whereColumn('payments.id', 'votes.payment_id')
                                                ->whereColumn('payments.user_id', 'users.id')
                                                ->where('payments.status', 'succeeded');
                                        });
                                });
                        })
                        ->where(function ($voteQuery) {
                            $voteQuery
                                ->whereNull('votes.payment_id')
                                ->orWhereExists(function ($paymentQuery) {
                                    $paymentQuery
                                        ->selectRaw('1')
                                        ->from('payments')
                                        ->whereColumn('payments.id', 'votes.payment_id')
                                        ->where('payments.status', 'succeeded');
                                });
                        })
                        ->orderByDesc('created_at')
                        ->limit(1)
                        ->select('created_at');
                },
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        // Invités (user_id null)
        $guests = \App\Models\Vote::query()
            ->successful()
            ->whereNull('user_id')
            ->where(function ($query) {
                $query->whereNull('payment_id')
                    ->orWhereExists(function ($paymentQuery) {
                        $paymentQuery
                            ->selectRaw('1')
                            ->from('payments')
                            ->whereColumn('payments.id', 'votes.payment_id')
                            ->whereNull('payments.user_id');
                    });
            })
            ->selectRaw('ip_address, SUM(quantity) as votes_count, MAX(created_at) as last_vote_at, MIN(created_at) as created_at')
            ->groupBy('ip_address')
            ->orderByDesc('last_vote_at')
            ->get()
            ->map(function ($v) {
                return [
                    'id' => 'guest-' . md5($v->ip_address ?? uniqid()),
                    'name' => 'Invité',
                    'email' => null,
                    'phone' => null,
                    'status' => 'guest',
                    'created_at' => $v->created_at,
                    'votes_count' => (int) $v->votes_count,
                    'payments_count' => 0,
                    'last_vote_ip' => $v->ip_address,
                    'last_vote_at' => $v->last_vote_at,
                    'registered' => false,
                ];
            });

        $registeredItems = collect($registered->items())->map(function ($u) {
            return [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'phone' => $u->phone,
                'status' => $u->status ?? 'active',
                'created_at' => $u->created_at,
                'votes_count' => (int) ($u->votes_count ?? 0),
                'payments_count' => (int) ($u->payments_count ?? 0),
                'last_vote_ip' => $u->last_vote_ip,
                'last_vote_at' => $u->last_vote_at,
                'registered' => true,
            ];
        });

        $data = $registeredItems->merge($guests)->values();

        return response()->json([
            'data' => $data,
            'registered_total' => $registered->total(),
            'guests_total' => $guests->count(),
        ]);
    }

    public function updateStatus(string $user): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $user = $this->resolveManageableUser($user);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        $validated = request()->validate([
            'status' => ['nullable', 'in:active,inactive'],
        ]);

        $user->status = $validated['status']
            ?? ($user->status === 'active' ? 'inactive' : 'active');
        $user->save();

        return response()->json($user);
    }

    public function destroy(string $user): JsonResponse
    {
        abort_unless(request()->user()?->tokenCan('admin'), 403);
        $user = $this->resolveManageableUser($user);
        if ($user instanceof JsonResponse) {
            return $user;
        }

        // Soft deactivate instead of hard delete
        $user->status = 'inactive';
        $user->save();

        // Revoke all tokens so the account can't access anymore
        $user->tokens()->delete();

        return response()->json([
            'message' => 'User deactivated',
            'user' => $user,
        ]);
    }

    private function resolveManageableUser(string $userId): User|JsonResponse
    {
        if (str_starts_with($userId, 'guest-')) {
            return response()->json([
                'message' => 'Les utilisateurs invites sont en lecture seule et ne peuvent pas etre modifies.',
            ], 422);
        }

        $user = User::where('role', 'user')->find($userId);
        if (!$user) {
            return response()->json([
                'message' => 'Utilisateur introuvable.',
            ], 404);
        }

        return $user;
    }
}
