<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreJSeraiTemplateRequest;
use App\Models\JSeraiTemplate;
use App\Models\JSeraiTicket;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class JSeraiAdminController extends Controller
{
    public function templates(): JsonResponse
    {
        $templates = JSeraiTemplate::orderBy('created_at', 'desc')->get()->map(fn ($t) => [
            'id' => $t->id,
            'name' => $t->name,
            'file_url' => MediaUrl::fromPath($t->file_path),
            'mask_url' => MediaUrl::fromPath($t->mask_path),
            'is_active' => $t->is_active,
            'overlay_config' => $t->overlay_config,
            'created_at' => $t->created_at->toIso8601String(),
        ]);

        return response()->json($templates);
    }

    public function storeTemplate(StoreJSeraiTemplateRequest $request): JsonResponse
    {
        $path = $request->file('template')->store('j-serai/templates', 'public');

        $maskPath = null;
        if ($request->hasFile('mask')) {
            $maskPath = $request->file('mask')->store('j-serai/masks', 'public');
        }

        $template = JSeraiTemplate::create([
            'name' => $request->input('name'),
            'file_path' => $path,
            'mask_path' => $maskPath,
            'is_active' => $request->boolean('is_active', false),
            'overlay_config' => $request->has('overlay_config')
                ? json_decode($request->input('overlay_config'), true)
                : $this->defaultOverlayConfig(),
        ]);

        return response()->json([
            'id' => $template->id,
            'name' => $template->name,
            'file_url' => MediaUrl::fromPath($template->file_path),
            'mask_url' => MediaUrl::fromPath($template->mask_path),
            'is_active' => $template->is_active,
            'overlay_config' => $template->overlay_config,
        ], 201);
    }

    public function updateTemplate(string $id, Request $request): JsonResponse
    {
        $template = JSeraiTemplate::findOrFail($id);

        $data = [];

        if ($request->has('name')) {
            $data['name'] = $request->input('name');
        }

        if ($request->hasFile('template')) {
            if ($template->file_path) {
                Storage::disk('public')->delete($template->file_path);
            }

            $data['file_path'] = $request->file('template')->store('j-serai/templates', 'public');
        }

        if ($request->hasFile('mask')) {
            if ($template->mask_path) {
                Storage::disk('public')->delete($template->mask_path);
            }

            $data['mask_path'] = $request->file('mask')->store('j-serai/masks', 'public');
        }

        if ($request->has('overlay_config')) {
            $data['overlay_config'] = json_decode($request->input('overlay_config'), true);
        }

        if ($request->has('is_active')) {
            $data['is_active'] = $request->boolean('is_active');
        }

        $template->update($data);

        return response()->json([
            'id' => $template->id,
            'name' => $template->name,
            'file_url' => MediaUrl::fromPath($template->file_path),
            'mask_url' => MediaUrl::fromPath($template->mask_path),
            'is_active' => $template->is_active,
            'overlay_config' => $template->overlay_config,
        ]);
    }

    public function activateTemplate(string $id): JsonResponse
    {
        $template = JSeraiTemplate::findOrFail($id);

        DB::transaction(function () use ($template) {
            JSeraiTemplate::where('is_active', true)->update(['is_active' => false]);
            $template->update(['is_active' => true]);
        });

        return response()->json([
            'id' => $template->id,
            'is_active' => true,
        ]);
    }

    public function destroyTemplate(string $id): JsonResponse
    {
        $template = JSeraiTemplate::findOrFail($id);

        if ($template->file_path) {
            Storage::disk('public')->delete($template->file_path);
        }

        if ($template->mask_path) {
            Storage::disk('public')->delete($template->mask_path);
        }

        $template->delete();

        return response()->json(['message' => 'Template supprimé.'], 200);
    }

    public function stats(): JsonResponse
    {
        return response()->json([
            'total' => JSeraiTicket::count(),
            'draft' => JSeraiTicket::where('status', 'draft')->count(),
            'completed' => JSeraiTicket::where('status', 'completed')->count(),
            'downloaded' => JSeraiTicket::where('status', 'downloaded')->count(),
        ]);
    }

    public function tickets(Request $request): JsonResponse
    {
        $query = JSeraiTicket::orderBy('created_at', 'desc');

        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('uuid', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $tickets = $query->paginate($perPage);

        $tickets->getCollection()->transform(fn ($t) => [
            'uuid' => $t->uuid,
            'first_name' => $t->first_name,
            'last_name' => $t->last_name,
            'phone' => $t->phone,
            'email' => $t->email,
            'status' => $t->status,
            'photo_url' => $t->photo_url,
            'poster_url' => $t->poster_url,
            'downloaded_at' => $t->downloaded_at?->toIso8601String(),
            'created_at' => $t->created_at->toIso8601String(),
        ]);

        return response()->json($tickets);
    }

    public function showTicket(string $uuid): JsonResponse
    {
        $ticket = JSeraiTicket::where('uuid', $uuid)->first();

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable.'], 404);
        }

        return response()->json([
            'uuid' => $ticket->uuid,
            'first_name' => $ticket->first_name,
            'last_name' => $ticket->last_name,
            'phone' => $ticket->phone,
            'email' => $ticket->email,
            'status' => $ticket->status,
            'photo_url' => $ticket->photo_url,
            'poster_url' => $ticket->poster_url,
            'downloaded_at' => $ticket->downloaded_at?->toIso8601String(),
            'created_at' => $ticket->created_at->toIso8601String(),
        ]);
    }

    public function downloadTicket(string $uuid): JsonResponse
    {
        $ticket = JSeraiTicket::where('uuid', $uuid)->first();

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable.'], 404);
        }

        if (! $ticket->poster_path) {
            return response()->json(['message' => 'Aucune affiche générée pour ce ticket.'], 400);
        }

        $posterPath = Storage::disk('public')->path($ticket->poster_path);

        if (! file_exists($posterPath)) {
            return response()->json(['message' => 'Le fichier de l\'affiche est introuvable.'], 500);
        }

        $safeName = preg_replace('/[^\w\-]/', '_', $ticket->first_name);
        $filename = 'j-y-serai-'.$safeName.'-'.$ticket->uuid.'.png';

        return response()->file($posterPath, [
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function deleteTicket(string $uuid): JsonResponse
    {
        $ticket = JSeraiTicket::where('uuid', $uuid)->first();

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable.'], 404);
        }

        if ($ticket->photo_path) {
            Storage::disk('public')->delete($ticket->photo_path);
        }

        if ($ticket->poster_path) {
            Storage::disk('public')->delete($ticket->poster_path);
        }

        $ticket->delete();

        return response()->json(['message' => 'Ticket supprimé.']);
    }

    private function defaultOverlayConfig(): array
    {
        return [
            'photo' => [
                'x' => 100,
                'y' => 250,
                'width' => 400,
                'height' => 500,
            ],
            'first_name' => [
                'x' => 300,
                'y' => 100,
                'font_size' => 48,
                'font_color' => 'd4af37',
                'align' => 'center',
                'valign' => 'middle',
            ],
            'phone' => [
                'x' => 100,
                'y' => 800,
                'font_size' => 24,
                'font_color' => 'ffffff',
                'align' => 'left',
                'valign' => 'top',
            ],
            'email' => [
                'x' => 100,
                'y' => 840,
                'font_size' => 20,
                'font_color' => 'cccccc',
                'align' => 'left',
                'valign' => 'top',
            ],
        ];
    }
}
