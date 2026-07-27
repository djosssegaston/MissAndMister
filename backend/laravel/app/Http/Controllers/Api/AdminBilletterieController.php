<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Ticket;
use App\Models\TicketOrder;
use App\Models\TicketType;
use App\Services\BilletterieService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminBilletterieController extends Controller
{
    public function __construct(
        private BilletterieService $billetterie,
    ) {}

    public function index(): JsonResponse
    {
        $events = Event::withCount(['orders' => fn ($q) => $q->where('status', 'paid'), 'ticketTypes'])
            ->with(['ticketTypes'])
            ->withSum(['orders as total_revenue' => fn ($q) => $q->where('status', 'paid')], 'total_amount')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($events);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'event_date' => ['nullable', 'date'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'image' => ['nullable', 'image', 'max:5120'],
            'ticket_types' => ['nullable', 'array'],
            'ticket_types.*.name' => ['required_with:ticket_types', 'string', 'max:255'],
            'ticket_types.*.description' => ['nullable', 'string'],
            'ticket_types.*.price' => ['required_with:ticket_types', 'integer', 'min:0'],
            'ticket_types.*.quantity_total' => ['required_with:ticket_types', 'integer', 'min:1'],
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('events', 'public');
        }

        $event = Event::create([
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'location' => $data['location'] ?? null,
            'event_date' => $data['event_date'] ?? null,
            'image_path' => $imagePath,
            'status' => $data['status'] ?? 'draft',
            'created_by' => $request->user()->id,
        ]);

        if (! empty($data['ticket_types'])) {
            foreach ($data['ticket_types'] as $typeData) {
                TicketType::create([
                    'event_id' => $event->id,
                    'name' => $typeData['name'],
                    'description' => $typeData['description'] ?? null,
                    'price' => $typeData['price'],
                    'quantity_total' => $typeData['quantity_total'],
                ]);
            }
        }

        return response()->json($event->load('ticketTypes'), 201);
    }

    public function show(Event $event): JsonResponse
    {
        $event->load(['ticketTypes', 'orders.user', 'orders.payment']);
        $event->setRelation('orders_count', $event->orders()->where('status', 'paid')->count());
        $event->total_revenue = (int) $event->orders()->where('status', 'paid')->sum('total_amount');

        return response()->json($event);
    }

    public function update(Request $request, Event $event): JsonResponse
    {

        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'event_date' => ['nullable', 'date'],
            'status' => ['nullable', 'in:draft,published,archived'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            if ($event->image_path) {
                Storage::disk('public')->delete($event->image_path);
            }
            $data['image_path'] = $request->file('image')->store('events', 'public');
        }

        $event->update($data);

        return response()->json($event->load('ticketTypes'));
    }

    public function destroy(Event $event): JsonResponse
    {
        if ($event->orders()->where('status', 'paid')->exists()) {
            return response()->json(['message' => 'Impossible de supprimer un événement avec des ventes confirmées.'], 422);
        }

        if ($event->image_path) {
            Storage::disk('public')->delete($event->image_path);
        }

        $event->delete();

        return response()->json(['message' => 'Événement supprimé.']);
    }

    public function updateTicketType(Request $request, Event $event, string $typeId): JsonResponse
    {
        $ticketType = TicketType::where('event_id', $event->id)->findOrFail($typeId);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['sometimes', 'integer', 'min:0'],
            'quantity_total' => ['sometimes', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'max:10'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        if (isset($data['quantity_total']) && $data['quantity_total'] < $ticketType->quantity_sold) {
            return response()->json(['message' => 'La nouvelle quantité est inférieure au nombre déjà vendu.'], 422);
        }

        if ($request->hasFile('image')) {
            if ($ticketType->image_path) {
                Storage::disk('public')->delete($ticketType->image_path);
            }
            $data['image_path'] = $request->file('image')->store('ticket-types', 'public');
        }

        $ticketType->update($data);

        return response()->json($ticketType);
    }

    public function storeTicketType(Request $request, Event $event): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'price' => ['required', 'integer', 'min:0'],
            'quantity_total' => ['required', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'max:10'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('ticket-types', 'public');
        }

        $ticketType = TicketType::create(array_merge($data, [
            'event_id' => $event->id,
            'image_path' => $imagePath,
        ]));

        return response()->json($ticketType, 201);
    }

    public function destroyTicketType(Event $event, string $typeId): JsonResponse
    {
        $ticketType = TicketType::where('event_id', $event->id)->findOrFail($typeId);

        if ($ticketType->quantity_sold > 0) {
            return response()->json(['message' => 'Impossible de supprimer un type de billet déjà vendu.'], 422);
        }

        if ($ticketType->image_path) {
            Storage::disk('public')->delete($ticketType->image_path);
        }

        if ($ticketType->ticket_template_path) {
            Storage::disk('public')->delete($ticketType->ticket_template_path);
        }

        $ticketType->delete();

        return response()->json(['message' => 'Type de billet supprimé.']);
    }

    public function uploadTicketTemplate(Request $request, Event $event, string $typeId): JsonResponse
    {
        $ticketType = TicketType::where('event_id', $event->id)->findOrFail($typeId);

        $data = $request->validate([
            'ticket_template' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:5120'],
        ]);

        if ($ticketType->ticket_template_path) {
            Storage::disk('public')->delete($ticketType->ticket_template_path);
        }

        $path = $request->file('ticket_template')->store('ticket-templates', 'public');

        $ticketType->update(['ticket_template_path' => $path]);

        return response()->json([
            'message' => 'Template de billet uploadé avec succès.',
            'ticket_template_url' => asset('storage/'.$path),
            'ticket_type' => $ticketType,
        ]);
    }

    public function orders(Request $request): JsonResponse
    {
        $query = TicketOrder::with(['user', 'event', 'tickets.ticketType', 'payment'])
            ->orderByDesc('created_at');

        if ($request->has('event_id')) {
            $query->where('event_id', $request->input('event_id'));
        }

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    public function checkin(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ticket_code' => ['required', 'string'],
        ]);

        try {
            $result = $this->billetterie->checkinTicket(
                $data['ticket_code'],
                $request->user()->id,
                $request->ip(),
            );
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Une erreur est survenue lors du check-in: '.$e->getMessage(),
            ], 500);
        }

        $statusCode = $result['success'] ? 200 : 422;

        return response()->json($result, $statusCode);
    }

    public function stats(): JsonResponse
    {
        $totalEvents = Event::count();
        $publishedEvents = Event::where('status', 'published')->count();
        $totalOrders = TicketOrder::where('status', 'paid')->count();
        $totalRevenue = TicketOrder::where('status', 'paid')->sum('total_amount');
        $totalTickets = Ticket::where('status', 'valid')->count();
        $checkedInTickets = Ticket::whereNotNull('checked_in_at')->count();

        return response()->json([
            'total_events' => $totalEvents,
            'published_events' => $publishedEvents,
            'total_orders' => $totalOrders,
            'total_revenue' => (int) $totalRevenue,
            'total_tickets' => $totalTickets,
            'checked_in_tickets' => $checkedInTickets,
        ]);
    }

    public function exportOrders(Request $request): StreamedResponse
    {
        $query = TicketOrder::with(['user', 'event', 'tickets.ticketType'])
            ->where('status', 'paid')
            ->orderByDesc('created_at');

        if ($request->has('event_id')) {
            $query->where('event_id', $request->input('event_id'));
        }

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="commandes_billetterie.csv"',
        ];

        return response()->stream(function () use ($query) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['ID', 'Utilisateur', 'Email', 'Événement', 'Type billet', 'Quantité', 'Montant', 'Devise', 'Référence', 'Statut', 'Créé le']);
            $query->chunk(500, function ($rows) use ($out) {
                foreach ($rows as $order) {
                    $typeName = $order->tickets->first()?->ticketType?->name ?? '';
                    fputcsv($out, [
                        $order->id,
                        $order->user?->name,
                        $order->user?->email,
                        $order->event?->title,
                        $typeName,
                        $order->quantity,
                        $order->total_amount,
                        $order->currency,
                        $order->payment_reference,
                        $order->status,
                        $order->created_at?->toDateTimeString(),
                    ]);
                }
            });
            fclose($out);
        }, 200, $headers);
    }
}
