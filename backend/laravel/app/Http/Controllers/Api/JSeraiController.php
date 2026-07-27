<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreJSeraiTicketRequest;
use App\Http\Requests\UpdateJSeraiTicketRequest;
use App\Http\Requests\UploadJSeraiPhotoRequest;
use App\Models\JSeraiTemplate;
use App\Models\JSeraiTicket;
use App\Services\JSeraiPosterService;
use App\Support\MediaUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class JSeraiController extends Controller
{
    public function __construct(
        private readonly JSeraiPosterService $posterService,
    ) {}

    public function init(): JsonResponse
    {
        $template = JSeraiTemplate::where('is_active', true)->first();

        return response()->json([
            'template' => $template ? [
                'id' => $template->id,
                'overlay_config' => $template->overlay_config,
                'preview_url' => MediaUrl::fromPath($template->file_path),
                'mask_url' => MediaUrl::fromPath($template->mask_path),
            ] : null,
        ]);
    }

    public function store(StoreJSeraiTicketRequest $request): JsonResponse
    {
        $template = JSeraiTemplate::where('is_active', true)->first();

        if (! $template) {
            return response()->json(['message' => 'Aucun template actif disponible pour le moment.'], 422);
        }

        $ticket = JSeraiTicket::create([
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'template_id' => $template->id,
            'status' => 'draft',
        ]);

        return response()->json([
            'uuid' => $ticket->uuid,
            'edit_token' => $ticket->edit_token,
            'status' => $ticket->status,
        ], 201);
    }

    public function update(string $uuid, UpdateJSeraiTicketRequest $request): JsonResponse
    {
        $ticket = $this->findTicket($uuid, $request);

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable ou token invalide.'], 404);
        }

        if ($ticket->isDownloaded()) {
            return response()->json(['message' => 'Ce ticket a déjà été téléchargé et ne peut plus être modifié.'], 403);
        }

        $ticket->update([
            'phone' => $request->input('phone'),
            'email' => $request->input('email'),
        ]);

        return response()->json([
            'uuid' => $ticket->uuid,
            'status' => $ticket->status,
        ]);
    }

    public function uploadPhoto(string $uuid, UploadJSeraiPhotoRequest $request): JsonResponse
    {
        $ticket = $this->findTicket($uuid, $request);

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable ou token invalide.'], 404);
        }

        if ($ticket->isDownloaded()) {
            return response()->json(['message' => 'Ce ticket a déjà été téléchargé et ne peut plus être modifié.'], 403);
        }

        if ($ticket->photo_path) {
            Storage::disk('public')->delete($ticket->photo_path);
        }

        if ($ticket->poster_path) {
            Storage::disk('public')->delete($ticket->poster_path);
        }

        $path = $request->file('photo')->store('j-serai/'.$ticket->uuid.'/photos', 'public');

        $ticket->update([
            'photo_path' => $path,
            'poster_path' => null,
        ]);

        $ticket->refresh();

        try {
            $posterPath = $this->posterService->generate($ticket);
            $ticket->update([
                'poster_path' => $posterPath,
                'status' => 'completed',
            ]);
            $ticket->refresh();
        } catch (\Throwable $e) {
            return response()->json([
                'message' => 'La photo a été sauvegardée mais la génération de l\'affiche a échoué: '.$e->getMessage(),
                'uuid' => $ticket->uuid,
                'photo_url' => $ticket->photo_url,
                'status' => $ticket->status,
            ], 201);
        }

        return response()->json([
            'uuid' => $ticket->uuid,
            'photo_url' => $ticket->photo_url,
            'poster_url' => $ticket->poster_url,
            'status' => $ticket->status,
        ], 201);
    }

    public function show(string $uuid, Request $request): JsonResponse
    {
        $ticket = JSeraiTicket::where('uuid', $uuid)->first();

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable.'], 404);
        }

        $isOwner = $request->header('X-Edit-Token') === $ticket->edit_token;
        $canEdit = $ticket->isEditable() && $isOwner;

        $data = [
            'uuid' => $ticket->uuid,
            'first_name' => $ticket->first_name,
            'status' => $ticket->status,
            'can_edit' => $canEdit,
        ];

        if ($isOwner) {
            $data['photo_url'] = $ticket->photo_url;
            $data['poster_url'] = $ticket->poster_url;
            $data['downloaded_at'] = $ticket->downloaded_at?->toIso8601String();
        }

        return response()->json($data);
    }

    public function download(string $uuid, Request $request): JsonResponse
    {
        $ticket = $this->findTicket($uuid, $request);

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable ou token invalide.'], 404);
        }

        if (! $ticket->poster_path) {
            return response()->json(['message' => 'L\'affiche n\'a pas encore été générée.'], 400);
        }

        $posterPath = Storage::disk('public')->path($ticket->poster_path);

        if (! file_exists($posterPath)) {
            return response()->json(['message' => 'Le fichier de l\'affiche est introuvable.'], 500);
        }

        $safeName = preg_replace('/[^\w\-]/', '_', $ticket->first_name);
        $filename = 'j-y-serai-'.$safeName.'-'.$ticket->uuid.'.png';

        $ticket->update([
            'status' => 'downloaded',
            'downloaded_at' => now(),
        ]);

        return response()->file($posterPath, [
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function servePoster(string $uuid): JsonResponse
    {
        $ticket = JSeraiTicket::where('uuid', $uuid)->first();

        if (! $ticket || ! $ticket->poster_path) {
            return response()->json(['message' => 'Affiche introuvable.'], 404);
        }

        $posterPath = Storage::disk('public')->path($ticket->poster_path);

        if (! file_exists($posterPath)) {
            return response()->json(['message' => 'Fichier introuvable.'], 404);
        }

        return response()->file($posterPath);
    }

    public function regenerate(string $uuid, Request $request): JsonResponse
    {
        $ticket = $this->findTicket($uuid, $request);

        if (! $ticket) {
            return response()->json(['message' => 'Ticket introuvable ou token invalide.'], 404);
        }

        if ($ticket->isDownloaded()) {
            return response()->json(['message' => 'Ce ticket a déjà été téléchargé et ne peut plus être modifié.'], 403);
        }

        if (! $ticket->photo_path) {
            return response()->json(['message' => 'Aucune photo uploadée.'], 400);
        }

        try {
            if ($ticket->poster_path) {
                Storage::disk('public')->delete($ticket->poster_path);
            }

            $posterPath = $this->posterService->generate($ticket);
            $ticket->update(['poster_path' => $posterPath]);
            $ticket->refresh();
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Erreur lors de la régénération: '.$e->getMessage()], 500);
        }

        return response()->json([
            'uuid' => $ticket->uuid,
            'poster_url' => $ticket->poster_url,
        ]);
    }

    private function findTicket(string $uuid, Request $request): ?JSeraiTicket
    {
        $ticket = JSeraiTicket::where('uuid', $uuid)->first();

        if (! $ticket) {
            return null;
        }

        if ($request->header('X-Edit-Token') !== $ticket->edit_token) {
            return null;
        }

        return $ticket;
    }
}
