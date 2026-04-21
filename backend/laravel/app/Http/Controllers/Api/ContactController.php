<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function store(ContactRequest $request): JsonResponse
    {
        $data = $request->validated();
        $recipient = trim((string) config('mail.from.address', ''));

        if ($recipient === '') {
            Log::warning('Contact form submission rejected because no recipient is configured.');

            return response()->json([
                'message' => 'Le service de contact est temporairement indisponible.',
            ], 503);
        }

        try {
            Mail::raw($this->buildPlainTextBody($data), function ($message) use ($data, $recipient): void {
                $message
                    ->to($recipient)
                    ->replyTo($data['email'], $data['name'])
                    ->subject('[Contact MMUB] ' . $data['subject']);
            });
        } catch (\Throwable $exception) {
            Log::warning('Contact form delivery failed', [
                'email' => $data['email'],
                'subject' => $data['subject'],
                'error' => $exception->getMessage(),
            ]);

            return response()->json([
                'message' => 'Impossible d’envoyer votre message pour le moment. Veuillez réessayer plus tard.',
            ], 503);
        }

        return response()->json([
            'message' => 'Votre message a été envoyé avec succès.',
        ], 202);
    }

    private function buildPlainTextBody(array $data): string
    {
        return implode(PHP_EOL, [
            'Nouveau message depuis le formulaire de contact MMUB',
            '',
            'Nom : ' . $data['name'],
            'Email : ' . $data['email'],
            'Sujet : ' . $data['subject'],
            '',
            'Message :',
            $data['message'],
        ]);
    }
}
