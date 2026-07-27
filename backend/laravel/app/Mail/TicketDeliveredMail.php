<?php

namespace App\Mail;

use App\Models\TicketOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TicketDeliveredMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public TicketOrder $order,
        public ?string $pdfBytes = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Vos billets - '.($this->order->event?->title ?? 'Miss & Mister'),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.ticket-delivered',
        );
    }

    public function attachments(): array
    {
        if (! $this->pdfBytes) {
            return [];
        }

        $eventName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $this->order->event?->title ?? 'billet');
        $fileName = $eventName.'_billet.pdf';

        return [
            Attachment::fromData(fn () => $this->pdfBytes, $fileName)
                ->withMime('application/pdf'),
        ];
    }
}
