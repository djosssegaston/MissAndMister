<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Billet - {{ $order->event?->title ?? 'Miss & Mister' }}</title>
    <style>
        @page { margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; }

        .ticket-page {
            width: 842pt;
            height: 300pt;
            position: relative;
            overflow: hidden;
            background: #ffffff;
        }

        .ticket-bg {
            position: absolute;
            top: 0; left: 0;
            width: 842pt;
            height: 300pt;
        }

        .ticket-overlay {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            z-index: 2;
        }

        .qr-area {
            position: absolute;
            bottom: 22pt;
            left: 12pt;
            width: 95pt;
            text-align: center;
            z-index: 3;
        }

        .qr-image {
            width: 85pt;
            height: 85pt;
            border: 2pt solid rgba(255,255,255,0.95);
            background: #ffffff;
            padding: 3pt;
        }

        .qr-label {
            font-size: 5pt;
            color: rgba(255,255,255,0.9);
            text-transform: uppercase;
            letter-spacing: 0.5pt;
            margin-top: 2pt;
            font-weight: 600;
        }

        .qr-code-text {
            font-family: 'Courier New', monospace;
            font-size: 5pt;
            color: rgba(255,255,255,0.95);
            margin-top: 2pt;
            letter-spacing: 0.3pt;
            word-break: break-all;
            background: rgba(0,0,0,0.4);
            padding: 2pt 3pt;
        }

        .info-panel {
            position: absolute;
            top: 12pt;
            right: 12pt;
            width: 180pt;
            z-index: 3;
        }

        .event-title-bar {
            background: rgba(0,0,0,0.65);
            padding: 6pt 8pt;
            margin-bottom: 4pt;
            border-left: 3pt solid #D4AF37;
        }

        .event-title-text {
            font-size: 11pt;
            font-weight: bold;
            color: #D4AF37;
            line-height: 1.2;
        }

        .event-subtitle-text {
            font-size: 6pt;
            color: rgba(255,255,255,0.7);
            text-transform: uppercase;
            letter-spacing: 1pt;
            margin-top: 1pt;
        }

        .info-rows {
            background: rgba(0,0,0,0.6);
            padding: 5pt 8pt;
        }

        .info-row {
            padding: 2pt 0;
            border-bottom: 0.5pt solid rgba(255,255,255,0.1);
        }

        .info-row:last-child { border-bottom: none; }

        .info-label {
            font-size: 5pt;
            color: rgba(255,255,255,0.55);
            text-transform: uppercase;
            letter-spacing: 0.5pt;
        }

        .info-value {
            font-size: 7.5pt;
            color: #ffffff;
            font-weight: 600;
            margin-top: 1pt;
        }

        .info-value.gold { color: #D4AF37; }

        .bottom-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.75);
            padding: 5pt 12pt;
            display: table;
            width: 100%;
            z-index: 3;
            border-top: 1.5pt solid #D4AF37;
        }

        .bottom-left {
            display: table-cell;
            vertical-align: middle;
            width: 60%;
        }

        .bottom-right {
            display: table-cell;
            vertical-align: middle;
            text-align: right;
            width: 40%;
        }

        .brand-name {
            font-size: 7pt;
            font-weight: bold;
            color: #D4AF37;
            letter-spacing: 0.5pt;
            text-transform: uppercase;
        }

        .brand-url {
            font-size: 5pt;
            color: rgba(255,255,255,0.5);
            margin-top: 1pt;
        }

        .ticket-qty {
            font-size: 6pt;
            color: rgba(255,255,255,0.6);
        }

        .ticket-qty strong {
            color: #D4AF37;
            font-size: 7.5pt;
        }

        .security-notice {
            position: absolute;
            bottom: 22pt;
            right: 12pt;
            width: 180pt;
            z-index: 3;
        }

        .security-notice-box {
            background: rgba(180, 30, 30, 0.85);
            border: 0.5pt solid rgba(255, 80, 80, 0.6);
            border-radius: 3pt;
            padding: 4pt 6pt;
        }

        .security-notice-text {
            font-size: 4.5pt;
            color: rgba(255, 255, 255, 0.95);
            line-height: 1.4;
            text-align: center;
        }

        .security-notice-text strong {
            color: #ff6b6b;
        }
    </style>
</head>
<body>
    @php
        $ticketsToRender = isset($singleTicket) ? collect([$singleTicket]) : $order->tickets;
    @endphp

    @foreach($ticketsToRender as $ticket)
    <div class="ticket-page">
        @php
            $templatePath = $pdfService->getTicketTemplatePath($ticket);
        @endphp
        @if($templatePath)
            <img src="file://{{ $templatePath }}" class="ticket-bg" alt="" />
        @endif

        <div class="ticket-overlay">
            {{-- QR Code Left Side --}}
            <div class="qr-area">
                @php
                    $qrContent = $qrService->buildQrContent($ticket->ticket_code, $ticket->qr_token);
                    $qrDataUri = $qrService->generateQrImageUri($qrContent, 200);
                @endphp
                <img src="{{ $qrDataUri }}" class="qr-image" alt="QR Code" />
                <div class="qr-label">Scannez pour entrer</div>
                <div class="qr-code-text">{{ $ticket->ticket_code }}</div>
            </div>

            {{-- Info Panel Right Side --}}
            <div class="info-panel">
                <div class="event-title-bar">
                    <div class="event-title-text">{{ $ticket->ticketType?->event?->title ?? 'Miss & Mister University Benin' }}</div>
                    <div class="event-subtitle-text">Billet d'entrée</div>
                </div>

                <div class="info-rows">
                    <div class="info-row">
                        <div class="info-label">Nom</div>
                        <div class="info-value">{{ $ticket->holder_name ?? $order->holder_name ?? 'N/A' }}</div>
                    </div>

                    <div class="info-row">
                        <div class="info-label">Type</div>
                        <div class="info-value gold">{{ $ticket->ticketType?->name ?? '' }}</div>
                    </div>

                    <div class="info-row">
                        <div class="info-label">Acheté le</div>
                        <div class="info-value">{{ $order->created_at->format('d/m/Y à H:i') }}</div>
                    </div>

                    @if($ticket->ticketType?->event?->location)
                    <div class="info-row">
                        <div class="info-label">Lieu</div>
                        <div class="info-value">{{ $ticket->ticketType->event->location }}</div>
                    </div>
                    @endif

                </div>
            </div>

            {{-- Security Notice --}}
            <div class="security-notice">
                <div class="security-notice-box">
                    <div class="security-notice-text">
                        <strong>CONFIDENTIEL</strong> — Ce billet est strictement personnel. Ne partagez pas le code ni le QR code. Toute personne présentant ce billet sera admise.
                    </div>
                </div>
            </div>

            {{-- Bottom Bar --}}
            <div class="bottom-bar">
                <div class="bottom-left">
                    <div class="brand-name">Miss &amp; Mister University Benin</div>
                    <div class="brand-url">missmisteruniversitybenin.com</div>
                </div>
                <div class="bottom-right">
                    <div class="ticket-qty">Billet <strong>#{{ $loop->iteration }}</strong> / {{ $order->quantity }}</div>
                </div>
            </div>
        </div>
    </div>
    @if(!$loop->last)
        <div style="page-break-after: always;"></div>
    @endif
    @endforeach
</body>
</html>
