<?php

namespace App\Mail;

use App\Models\Candidate;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class CandidateInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Candidate $candidate,
        public User $user,
        public string $temporaryPassword,
        public string $loginUrl,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Vos accès candidat Miss & Mister University Bénin',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.candidate-invitation',
        );
    }
}
