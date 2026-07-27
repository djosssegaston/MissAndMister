<?php

namespace App\Services;

use App\Models\Ticket;
use App\Models\TicketOrder;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;

class TicketPdfService
{
    public function __construct(
        private TicketQrService $qr,
    ) {}

    /**
     * Generate a PDF for all tickets in an order and return raw PDF bytes.
     */
    public function generateOrderPdf(TicketOrder $order): string
    {
        $order->load(['tickets.ticketType.event', 'event']);

        $pdf = Pdf::loadView('tickets.pdf', [
            'order' => $order,
            'qrService' => $this->qr,
            'pdfService' => $this,
        ])->setPaper([0, 0, 842, 300], 'pt');

        return $pdf->output();
    }

    /**
     * Generate a PDF for a single ticket and return raw PDF bytes.
     */
    public function generateTicketPdf(Ticket $ticket): string
    {
        $ticket->load(['ticketType.event', 'order']);

        $pdf = Pdf::loadView('tickets.pdf', [
            'order' => $ticket->order,
            'singleTicket' => $ticket,
            'qrService' => $this->qr,
            'pdfService' => $this,
        ])->setPaper([0, 0, 842, 300], 'pt');

        return $pdf->output();
    }

    /**
     * Get the template image path (JPEG) for a ticket type.
     */
    public function getTicketTemplatePath(Ticket $ticket): ?string
    {
        $templatePath = $ticket->ticketType?->image_path;

        if ($templatePath && Storage::disk('public')->exists($templatePath)) {
            return Storage::disk('public')->path($templatePath);
        }

        return null;
    }
}
