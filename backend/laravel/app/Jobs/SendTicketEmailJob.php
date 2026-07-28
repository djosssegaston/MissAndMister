<?php

namespace App\Jobs;

use App\Mail\TicketDeliveredMail;
use App\Models\TicketOrder;
use App\Services\TicketPdfService;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendTicketEmailJob
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $timeout = 120;

    public function __construct(
        public int $orderId,
    ) {}

    public function handle(TicketPdfService $pdf): void
    {
        $order = TicketOrder::with(['tickets.ticketType.event', 'event', 'user'])->find($this->orderId);

        if (! $order) {
            return;
        }

        $holderEmail = $order->holder_email ?? $order->tickets->firstWhere('holder_email')?->holder_email;
        $email = $order->user?->email ?? $holderEmail;

        if (! $email) {
            logger()->warning('Ticket email skipped: no email address found', [
                'order_id' => $order->id,
            ]);

            return;
        }

        $pdfBytes = null;

        try {
            $pdfBytes = $pdf->generateOrderPdf($order);
        } catch (\Throwable $e) {
            logger()->warning('PDF generation failed for ticket email', [
                'order_id' => $order->id,
                'error' => $e->getMessage(),
            ]);
        }

        Mail::to($email)->send(new TicketDeliveredMail($order, $pdfBytes));

        logger()->info('Ticket email sent via job', [
            'order_id' => $order->id,
            'email' => $email,
            'reference' => $order->payment_reference,
            'has_pdf' => $pdfBytes !== null,
        ]);
    }

    public function failed(\Throwable $exception): void
    {
        logger()->error('SendTicketEmailJob failed permanently', [
            'order_id' => $this->orderId,
            'error' => $exception->getMessage(),
        ]);
    }
}
