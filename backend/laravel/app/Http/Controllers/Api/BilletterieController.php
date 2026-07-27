<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Ticket;
use App\Models\TicketOrder;
use App\Services\BilletterieService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BilletterieController extends Controller
{
    public function __construct(
        private BilletterieService $billetterie,
    ) {}

    public function events(): JsonResponse
    {
        $events = \App\Models\Event::published()
            ->with(['ticketTypes' => fn ($q) => $q->where('quantity_total', '>', 0)])
            ->where(function ($q) {
                $q->whereNull('event_date')->orWhere('event_date', '>=', now()->subDay());
            })
            ->orderBy('event_date', 'asc')
            ->get();

        return response()->json($events);
    }

    public function showEvent(Event $event): JsonResponse
    {
        $event = Event::published()
            ->with(['ticketTypes' => fn ($q) => $q->where('quantity_total', '>', 0)])
            ->where('id', $event->id)
            ->firstOrFail();

        return response()->json($event);
    }

    public function order(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ticket_type_id' => ['required', 'integer', 'exists:ticket_types,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:10'],
            'holder_name' => ['required', 'string', 'max:255'],
            'holder_email' => ['required', 'email', 'max:255'],
            'holder_phone' => ['required', 'string', 'max:30'],
            'delivery_method' => ['required', 'string', 'in:whatsapp,email,both'],
        ]);

        $user = $request->user();

        try {
            $result = $this->billetterie->createOrder(
                $user?->id,
                $data['ticket_type_id'],
                $data['quantity'],
                $request->ip(),
                $request->userAgent(),
                $data['holder_name'],
                $data['holder_email'],
                $data['holder_phone'],
                $data['delivery_method'],
            );

            if ($result['skipped_payment'] ?? false) {
                return response()->json([
                    'message' => 'Commande confirmée. Vos billets ont été envoyés par email.',
                    'order' => $result['order'],
                    'payment_url' => null,
                ], 201);
            }

            return response()->json([
                'message' => 'Commande créée, paiement en cours.',
                'order' => $result['order'],
                'payment_url' => $result['payment_url'],
            ], 201);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Exception $e) {
            report($e);
            $message = match (true) {
                $e instanceof \Illuminate\Http\Client\ConnectionException => 'Impossible de contacter le service de paiement. Vérifiez votre connexion et réessayez.',
                $e instanceof \Illuminate\Database\QueryException => 'Une erreur de base de données est survenue. Réessayez dans quelques instants.',
                default => 'Une erreur est survenue lors du traitement. Veuillez réessayer.',
            };

            return response()->json(['message' => $message], 422);
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['message' => 'Une erreur interne est survenue. Veuillez réessayer plus tard.'], 500);
        }
    }

    public function orderDetail(Request $request, int $orderId): JsonResponse
    {
        $order = TicketOrder::with(['tickets.ticketType', 'event', 'payment'])
            ->where('user_id', $request->user()->id)
            ->find($orderId);

        if (! $order) {
            return response()->json(['message' => 'Commande introuvable.'], 404);
        }

        return response()->json($order);
    }

    public function myTickets(Request $request): JsonResponse
    {
        $tickets = Ticket::with(['ticketType.event', 'order'])
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($tickets);
    }

    public function orderPublic(string $paymentReference): JsonResponse
    {
        $order = TicketOrder::with(['event'])
            ->where('payment_reference', $paymentReference)
            ->first();

        if (! $order) {
            return response()->json(['message' => 'Commande introuvable.'], 404);
        }

        return response()->json([
            'id' => $order->id,
            'status' => $order->status,
            'payment_reference' => $order->payment_reference,
            'event_name' => $order->event?->title,
            'event' => [
                'id' => $order->event?->id,
                'title' => $order->event?->title,
            ],
            'holder_name' => $order->holder_name,
            'quantity' => $order->quantity,
            'total_amount' => $order->total_amount,
            'currency' => $order->currency,
            'ticket_count' => $order->tickets()->count(),
        ]);
    }

    public function verifyTicket(Request $request, string $ticketCode): JsonResponse
    {
        $ticket = $this->billetterie->getTicketForVerification($ticketCode);

        if (! $ticket) {
            return response()->json(['valid' => false, 'message' => 'Billet introuvable.'], 404);
        }

        $isCheckedIn = $ticket->checked_in_at !== null;
        $isValid = $ticket->status === 'valid' && ! $isCheckedIn;

        return response()->json([
            'valid' => $isValid,
            'ticket_code' => $ticket->ticket_code,
            'holder_name' => $ticket->holder_name,
            'event_title' => $ticket->ticketType?->event?->title,
            'ticket_type' => $ticket->ticketType?->name,
            'checked_in' => $isCheckedIn,
            'checked_in_at' => $ticket->checked_in_at?->toIso8601String(),
            'status' => $ticket->status,
        ]);
    }
}
