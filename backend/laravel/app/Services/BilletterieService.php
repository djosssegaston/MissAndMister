<?php

namespace App\Services;

use App\Jobs\SendTicketEmailJob;
use App\Models\ActivityLog;
use App\Models\Ticket;
use App\Models\TicketCheckin;
use App\Models\TicketOrder;
use App\Models\TicketType;
use App\Repositories\PaymentRepository;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class BilletterieService
{
    public function __construct(
        private PaymentService $payments,
        private PaymentRepository $paymentRepo,
        private TicketPdfService $pdf,
    ) {}

    private function skipPayment(): bool
    {
        if (app()->environment('production') && config('billetterie.skip_payment', false)) {
            logger()->critical('BILLETTERIE_SKIP_PAYMENT is enabled in production — blocked.', [
                'env' => app()->environment(),
            ]);

            return false;
        }

        return config('billetterie.skip_payment', false);
    }

    public function createOrder(
        ?int $userId,
        int $ticketTypeId,
        int $quantity,
        string $ipAddress,
        ?string $userAgent = null,
        ?string $holderName = null,
        ?string $holderEmail = null,
        ?string $holderPhone = null,
        ?string $deliveryMethod = 'email',
    ): array {
        $ticketType = TicketType::with('event')->findOrFail($ticketTypeId);

        if (! $ticketType->event || ! $ticketType->event->isPublished()) {
            throw new \RuntimeException('Cet événement n\'est pas disponible.');
        }

        if ($ticketType->isSoldOut()) {
            throw new \RuntimeException('Ce type de billet est épuisé.');
        }

        if ($quantity < 1 || $quantity > 10) {
            throw new \RuntimeException('La quantité doit être entre 1 et 10.');
        }

        $available = $ticketType->getAvailableQuantity();
        if ($quantity > $available) {
            throw new \RuntimeException('Il ne reste que '.$available.' billet(s) disponible(s).');
        }

        $totalAmount = $ticketType->price * $quantity;

        $result = DB::transaction(function () use (
            $userId,
            $ticketType,
            $quantity,
            $totalAmount,
            $ipAddress,
            $userAgent,
            $holderName,
            $holderEmail,
            $holderPhone,
            $deliveryMethod,
        ) {
            $lockedType = TicketType::lockForUpdate()->find($ticketType->id);

            if ($quantity > $lockedType->getAvailableQuantity()) {
                throw new \RuntimeException('Ce type de billet est maintenant épuisé.');
            }

            $reference = strtoupper('BT'.Str::random(10));

            $skipPayment = $this->skipPayment();

            if ($skipPayment) {
                // Skip payment: create order directly as paid
                $order = TicketOrder::create([
                    'user_id' => $userId,
                    'event_id' => $ticketType->event_id,
                    'payment_id' => null,
                    'holder_name' => $holderName,
                    'holder_phone' => $holderPhone,
                    'holder_email' => $holderEmail,
                    'delivery_method' => $deliveryMethod,
                    'total_amount' => $totalAmount,
                    'currency' => 'XOF',
                    'status' => 'paid',
                    'payment_reference' => $reference,
                    'quantity' => $quantity,
                ]);

                for ($i = 0; $i < $quantity; $i++) {
                    Ticket::create([
                        'ticket_code' => (string) Str::uuid(),
                        'security_token' => Str::random(64),
                        'qr_token' => Str::random(64),
                        'ticket_order_id' => $order->id,
                        'ticket_type_id' => $ticketType->id,
                        'user_id' => $userId,
                        'holder_name' => $holderName,
                        'holder_email' => $holderEmail,
                        'holder_phone' => $holderPhone,
                        'status' => 'valid',
                    ]);
                }

                $ticketType->increment('quantity_sold', $quantity);

                ActivityLog::create([
                    'causer_id' => $userId ?? 0,
                    'causer_type' => \App\Models\User::class,
                    'action' => 'ticket_order_paid_skipped',
                    'ip_address' => $ipAddress,
                    'meta' => [
                        'order_id' => $order->id,
                        'event_id' => $ticketType->event_id,
                        'ticket_type_id' => $ticketType->id,
                        'quantity' => $quantity,
                        'total_amount' => $totalAmount,
                    ],
                    'status' => 'active',
                ]);

                return [
                    'order' => $order->fresh(),
                    'payment' => null,
                    'payment_url' => null,
                    'skipped_payment' => true,
                ];
            }

            // Normal flow: initiate payment via FedaPay
            $payment = $this->payments->initiate(
                $userId,
                (float) $totalAmount,
                'XOF',
                array_merge([
                    'ip' => $ipAddress,
                    'user_agent' => $userAgent,
                    'type' => 'billetterie',
                    'event_id' => $ticketType->event_id,
                    'ticket_type_id' => $ticketType->id,
                    'ticket_type_name' => $ticketType->name,
                    'event_name' => $ticketType->event->title,
                    'quantity' => $quantity,
                    'holder_name' => $holderName,
                    'holder_email' => $holderEmail,
                    'holder_phone' => $holderPhone,
                    'payment_reference' => $reference,
                ]),
            );

            $order = TicketOrder::create([
                'user_id' => $userId,
                'event_id' => $ticketType->event_id,
                'payment_id' => $payment->id,
                'holder_name' => $holderName,
                'holder_phone' => $holderPhone,
                'holder_email' => $holderEmail,
                'delivery_method' => $deliveryMethod,
                'total_amount' => $totalAmount,
                'currency' => 'XOF',
                'status' => 'pending',
                'payment_reference' => $reference,
                'quantity' => $quantity,
            ]);

            for ($i = 0; $i < $quantity; $i++) {
                Ticket::create([
                    'ticket_code' => (string) Str::uuid(),
                    'security_token' => Str::random(64),
                    'qr_token' => Str::random(64),
                    'ticket_order_id' => $order->id,
                    'ticket_type_id' => $ticketType->id,
                    'user_id' => $userId,
                    'holder_name' => $holderName,
                    'holder_email' => $holderEmail,
                    'holder_phone' => $holderPhone,
                    'status' => 'pending',
                ]);
            }

            ActivityLog::create([
                'causer_id' => $userId ?? 0,
                'causer_type' => \App\Models\User::class,
                'action' => 'ticket_order_initiated',
                'ip_address' => $ipAddress,
                'meta' => [
                    'order_id' => $order->id,
                    'event_id' => $ticketType->event_id,
                    'ticket_type_id' => $ticketType->id,
                    'quantity' => $quantity,
                    'total_amount' => $totalAmount,
                    'payment_id' => $payment->id,
                ],
                'status' => 'active',
            ]);

            return [
                'order' => $order,
                'payment' => $payment,
                'payment_url' => $payment->meta['payment_url'] ?? null,
            ];
        });

        if (($result['skipped_payment'] ?? false) && isset($result['order'])) {
            SendTicketEmailJob::dispatch($result['order']->id);
        }

        return $result;
    }

    public function confirmOrder(string $reference, array $payload = []): ?TicketOrder
    {
        $orderToNotify = null;

        $result = DB::transaction(function () use ($reference, $payload, &$orderToNotify) {
            $order = TicketOrder::lockForUpdate()
                ->where('payment_reference', $reference)
                ->first();

            if (! $order) {
                return null;
            }

            if ($order->status === 'paid') {
                return $order;
            }

            $order->update(['status' => 'paid']);

            $order->tickets()->update(['status' => 'valid']);

            $order->ticketType()->increment('quantity_sold', $order->quantity);

            ActivityLog::create([
                'causer_id' => $order->user_id,
                'causer_type' => \App\Models\User::class,
                'action' => 'ticket_order_confirmed',
                'ip_address' => $payload['ip_address'] ?? null,
                'meta' => [
                    'order_id' => $order->id,
                    'event_id' => $order->event_id,
                    'quantity' => $order->quantity,
                    'total_amount' => $order->total_amount,
                ],
                'status' => 'active',
            ]);

            $orderToNotify = $order->fresh();

            return $orderToNotify;
        });

        if ($orderToNotify) {
            SendTicketEmailJob::dispatch($orderToNotify->id);
        }

        return $result;
    }

    public function failOrder(string $reference, array $payload = []): ?TicketOrder
    {
        return DB::transaction(function () use ($reference, $payload) {
            $order = TicketOrder::lockForUpdate()
                ->where('payment_reference', $reference)
                ->first();

            if (! $order || $order->status === 'paid') {
                return $order;
            }

            $order->update(['status' => 'cancelled']);

            $order->tickets()->update(['status' => 'cancelled']);

            $ticketType = $order->ticketType;
            if ($ticketType && $ticketType->quantity_sold > 0) {
                $ticketType->decrement('quantity_sold', min($ticketType->quantity_sold, $order->quantity));
            }

            ActivityLog::create([
                'causer_id' => $order->user_id,
                'causer_type' => \App\Models\User::class,
                'action' => 'ticket_order_failed',
                'ip_address' => $payload['ip_address'] ?? null,
                'meta' => [
                    'order_id' => $order->id,
                    'event_id' => $order->event_id,
                ],
                'status' => 'active',
            ]);

            return $order->fresh();
        });
    }

    public function checkinTicket(string $ticketCode, int $adminId, ?string $ipAddress = null): array
    {
        $ticket = Ticket::with(['ticketType.event', 'order'])->where('ticket_code', $ticketCode)->first();

        if (! $ticket) {
            return ['success' => false, 'message' => 'Billet introuvable.'];
        }

        if ($ticket->status !== 'valid') {
            return ['success' => false, 'message' => 'Ce billet n\'est pas valide (statut : '.$ticket->status.').'];
        }

        if ($ticket->checked_in_at) {
            return [
                'success' => false,
                'message' => 'Ce billet a déjà été utilisé le '.$ticket->checked_in_at->format('d/m/Y à H:i').'.',
            ];
        }

        DB::transaction(function () use ($ticket, $adminId, $ipAddress) {
            $lockedTicket = Ticket::lockForUpdate()->find($ticket->id);

            if ($lockedTicket->checked_in_at) {
                return;
            }

            $lockedTicket->update(['checked_in_at' => now()]);

            TicketCheckin::create([
                'ticket_id' => $lockedTicket->id,
                'checked_in_by' => $adminId,
                'ip_address' => $ipAddress,
            ]);

            ActivityLog::create([
                'causer_id' => $adminId,
                'causer_type' => \App\Models\Admin::class,
                'action' => 'ticket_checked_in',
                'ip_address' => $ipAddress,
                'meta' => [
                    'ticket_id' => $lockedTicket->id,
                    'ticket_code' => $lockedTicket->ticket_code,
                    'holder_name' => $lockedTicket->holder_name,
                    'event_id' => $lockedTicket->ticketType?->event_id,
                ],
                'status' => 'active',
            ]);
        });

        $ticket->refresh()->load(['ticketType.event', 'order.user']);

        return [
            'success' => true,
            'message' => 'Billet validé avec succès.',
            'ticket' => $ticket,
        ];
    }

    public function getTicketForVerification(string $ticketCode): ?Ticket
    {
        return Ticket::with(['ticketType.event', 'order.user', 'checkins.checker'])
            ->where('ticket_code', $ticketCode)
            ->first();
    }
}
