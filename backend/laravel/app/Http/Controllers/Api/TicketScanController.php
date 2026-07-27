<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketScan;
use App\Services\TicketQrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TicketScanController extends Controller
{
    public function __construct(
        private TicketQrService $qr,
    ) {}

    /**
     * Single-step validate: verify signature + check status + mark as used.
     * Everything in ONE DB transaction, ONE HTTP call.
     * Target: < 3 seconds end-to-end.
     */
    public function validateTicket(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'token' => ['required', 'string', 'max:100'],
            'sig' => ['required', 'string', 'max:100'],
        ]);

        // 1. HMAC check (~0.1ms, no DB)
        if (! $this->qr->verifySignature($data['code'], $data['token'], $data['sig'])) {
            $this->logRejected(null, $request, 'Signature invalide — billet falsifié.');

            return response()->json([
                'status' => 'invalid',
                'success' => false,
                'message' => 'Billet falsifié. La signature de sécurité est invalide.',
            ], 403);
        }

        // 2. Single atomic DB transaction: find + lock + validate + update
        $result = DB::transaction(function () use ($data, $request) {
            // Raw query for max speed — only select columns we need
            $ticket = DB::table('tickets')
                ->where('ticket_code', $data['code'])
                ->where('qr_token', $data['token'])
                ->lockForUpdate()
                ->first([
                    'id', 'ticket_code', 'holder_name', 'holder_email', 'holder_phone',
                    'status', 'scanned_at', 'scanned_by', 'ticket_type_id', 'ticket_order_id',
                ]);

            if (! $ticket) {
                return ['status' => 'not_found'];
            }

            if ($ticket->status !== 'valid') {
                return ['status' => 'invalid', 'ticket_status' => $ticket->status];
            }

            if ($ticket->scanned_at) {
                return [
                    'status' => 'already_used',
                    'scanned_at' => $ticket->scanned_at,
                ];
            }

            // Mark as scanned — single UPDATE query
            $now = now();
            DB::table('tickets')
                ->where('id', $ticket->id)
                ->update([
                    'scanned_at' => $now,
                    'scanned_by' => $request->user()->id,
                    'updated_at' => $now,
                ]);

            // Audit log — fire and forget (no await)
            DB::table('ticket_scans')->insert([
                'ticket_id' => $ticket->id,
                'admin_id' => $request->user()->id,
                'action' => 'confirmed',
                'result' => 'Billet validé à '.$now->format('H:i:s').'.',
                'ip_address' => $request->ip(),
                'user_agent' => substr((string) $request->userAgent(), 0, 500),
                'scanned_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            // Load event info for response (single query)
            $eventInfo = DB::table('ticket_types')
                ->join('events', 'events.id', '=', 'ticket_types.event_id')
                ->where('ticket_types.id', $ticket->ticket_type_id)
                ->select([
                    'ticket_types.name as ticket_type_name',
                    'events.title as event_title',
                    'events.event_date',
                    'events.location as event_location',
                ])
                ->first();

            // Load order reference (single query)
            $orderRef = DB::table('ticket_orders')
                ->where('id', $ticket->ticket_order_id)
                ->value('payment_reference');

            return [
                'status' => 'validated',
                'scanned_at' => $now->toIso8601String(),
                'ticket' => [
                    'id' => $ticket->id,
                    'holder_name' => $ticket->holder_name,
                    'holder_email' => $ticket->holder_email,
                    'holder_phone' => $ticket->holder_phone,
                    'ticket_code' => $ticket->ticket_code,
                    'ticket_type' => $eventInfo?->ticket_type_name,
                    'event_title' => $eventInfo?->event_title,
                    'event_date' => $eventInfo->event_date ? date('d/m/Y à H:i', strtotime($eventInfo->event_date)) : null,
                    'event_location' => $eventInfo?->event_location,
                    'order_reference' => $orderRef,
                ],
            ];
        });

        // 3. Map result to HTTP response
        return match ($result['status']) {
            'validated' => response()->json([
                'status' => 'validated',
                'success' => true,
                'message' => 'Billet validé avec succès à '.date('H:i:s', strtotime($result['scanned_at'])).'.',
                'ticket' => $result['ticket'],
            ]),

            'not_found' => $this->reject($request, 404, 'not_found', 'Billet introuvable. Ce billet n\'existe pas dans le système.'),

            'invalid' => $this->reject($request, 422, 'invalid', 'Ce billet n\'est pas valide (statut : '.$result['ticket_status'].').'),

            'already_used' => $this->reject(
                $request,
                409,
                'already_used',
                'Ce billet a déjà été utilisé le '.date('d/m/Y à H:i:s', strtotime($result['scanned_at'])).'.',
                ['scanned_at' => $result['scanned_at']],
            ),
        };
    }

    /**
     * Read-only verify (no write). For preview before confirming.
     */
    public function verify(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:100'],
            'token' => ['required', 'string', 'max:100'],
            'sig' => ['required', 'string', 'max:100'],
        ]);

        if (! $this->qr->verifySignature($data['code'], $data['token'], $data['sig'])) {
            return response()->json([
                'status' => 'invalid',
                'message' => 'Billet falsifié. La signature de sécurité est invalide.',
            ], 403);
        }

        $ticket = DB::table('tickets')
            ->where('ticket_code', $data['code'])
            ->where('qr_token', $data['token'])
            ->first();

        if (! $ticket) {
            return response()->json([
                'status' => 'not_found',
                'message' => 'Billet introuvable.',
            ], 404);
        }

        if ($ticket->status !== 'valid') {
            return response()->json([
                'status' => 'invalid',
                'message' => 'Ce billet n\'est pas valide (statut : '.$ticket->status.').',
            ], 422);
        }

        if ($ticket->scanned_at) {
            return response()->json([
                'status' => 'already_used',
                'message' => 'Ce billet a déjà été utilisé le '.date('d/m/Y à H:i:s', strtotime($ticket->scanned_at)).'.',
                'scanned_at' => $ticket->scanned_at,
            ], 409);
        }

        return response()->json([
            'status' => 'valid',
            'message' => 'Billet valide.',
        ]);
    }

    private function reject(Request $request, int $httpCode, string $status, string $message, array $extra = []): JsonResponse
    {
        $this->logRejected(null, $request, $message);

        return response()->json(array_merge([
            'status' => $status,
            'success' => false,
            'message' => $message,
        ], $extra), $httpCode);
    }

    private function logRejected(?Ticket $ticket, Request $request, string $result): void
    {
        // Non-critical, fire-and-forget style (do not block response)
        try {
            if ($ticket) {
                TicketScan::create([
                    'ticket_id' => $ticket->id,
                    'admin_id' => $request->user()->id,
                    'action' => 'rejected',
                    'result' => $result,
                    'ip_address' => $request->ip(),
                    'user_agent' => substr((string) $request->userAgent(), 0, 500),
                    'scanned_at' => now(),
                ]);
            }
        } catch (\Throwable) {
            // Silently ignore — audit log must never break the scan flow
        }
    }
}
