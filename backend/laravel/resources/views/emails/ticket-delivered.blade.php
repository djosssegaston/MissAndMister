<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vos billets - {{ $order->event?->title ?? '' }}</title>
    <style>
        body { margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #e0e0e0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #111111; border: 1px solid #2a2a2a; }
        .header { background: linear-gradient(135deg, #1a1a2e, #16213e); padding: 32px; text-align: center; border-bottom: 2px solid #D4AF37; }
        .header h1 { color: #D4AF37; font-size: 24px; margin: 0; letter-spacing: 1px; }
        .header p { color: #999; font-size: 14px; margin-top: 8px; }
        .body { padding: 32px; }
        .greeting { font-size: 16px; color: #ffffff; margin-bottom: 24px; }
        .ticket-card { background: linear-gradient(135deg, #1a1a2e, #0f3460); border: 1px solid #D4AF37; border-radius: 12px; padding: 24px; margin-bottom: 16px; }
        .ticket-card h3 { color: #D4AF37; margin: 0 0 12px; font-size: 18px; }
        .ticket-detail { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #2a2a2a; }
        .ticket-detail:last-child { border-bottom: none; }
        .ticket-label { color: #888; font-size: 13px; }
        .ticket-value { color: #ffffff; font-size: 14px; font-weight: 600; }
        .event-info { background-color: #1a1a1a; border-radius: 8px; padding: 20px; margin: 24px 0; }
        .event-info h3 { color: #D4AF37; margin: 0 0 12px; font-size: 16px; }
        .info-row { display: flex; justify-content: space-between; padding: 6px 0; }
        .info-label { color: #888; font-size: 13px; }
        .info-value { color: #e0e0e0; font-size: 14px; }
        .whatsapp-btn { display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 16px 0; }
        .footer { padding: 24px 32px; border-top: 1px solid #2a2a2a; text-align: center; color: #666; font-size: 12px; }
        .footer a { color: #D4AF37; text-decoration: none; }
        .note { background-color: #1a1a1a; border-left: 3px solid #D4AF37; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #999; border-radius: 0 8px 8px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Miss & Mister University Benin</h1>
            <p>Confirmation de vos billets</p>
        </div>

        <div class="body">
            <p class="greeting">
                Cher(e) <strong style="color: #D4AF37;">{{ $order->user?->name ?? 'Client' }}</strong>,
            </p>

            <p style="color: #ccc; line-height: 1.6;">
                Merci pour votre achat ! Vos billets pour l'événement <strong style="color: #D4AF37;">{{ $order->event?->title ?? '' }}</strong> ont été confirmés.
            </p>

            <div class="event-info">
                <h3>Informations de l'événement</h3>
                <div class="info-row">
                    <span class="info-label">Événement</span>
                    <span class="info-value">{{ $order->event?->title ?? '' }}</span>
                </div>
                @if($order->event?->event_date)
                <div class="info-row">
                    <span class="info-label">Date</span>
                    <span class="info-value">{{ $order->event->event_date->format('d/m/Y à H:i') }}</span>
                </div>
                @endif
                @if($order->event?->location)
                <div class="info-row">
                    <span class="info-label">Lieu</span>
                    <span class="info-value">{{ $order->event->location }}</span>
                </div>
                @endif
                <div class="info-row">
                    <span class="info-label">Nombre de billets</span>
                    <span class="info-value">{{ $order->quantity }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Montant total</span>
                    <span class="info-value" style="color: #D4AF37;">{{ number_format($order->total_amount, 0, ',', ' ') }} {{ $order->currency }}</span>
                </div>
            </div>

            @foreach($order->tickets as $ticket)
            <div class="ticket-card">
                <h3>Billet #{{ $loop->iteration }}</h3>
                <div class="ticket-detail">
                    <span class="ticket-label">Type</span>
                    <span class="ticket-value">{{ $ticket->ticketType?->name ?? '' }}</span>
                </div>
                <div class="ticket-detail">
                    <span class="ticket-label">Code du billet</span>
                    <span class="ticket-value" style="font-family: monospace; font-size: 13px;">{{ $ticket->ticket_code }}</span>
                </div>
                <div class="ticket-detail">
                    <span class="ticket-label">Statut</span>
                    <span class="ticket-value" style="color: #25D366;">{{ $ticket->status === 'valid' ? 'Valide' : $ticket->status }}</span>
                </div>
            </div>
            @endforeach

            <div class="note">
                Présentez vos codes de billet (QR code ou code alphanumérique) à l'entrée de l'événement pour accéder.
            </div>

            <div style="background-color: #2a1515; border: 1px solid #ff6b6b; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <p style="color: #ff6b6b; font-weight: 700; font-size: 14px; margin: 0 0 8px;">⚠ NE PARTAGEZ PAS VOS BILLETS</p>
                <p style="color: #ccc; font-size: 13px; line-height: 1.5; margin: 0;">
                    Ce billet est <strong style="color: #fff;">strictement personnel</strong>. Ne transmettez pas le PDF, le code QR ou le code alphanumérique à un tiers.
                    Toute personne présentant ce billet sera admise à l'événement.
                </p>
            </div>

            <p style="text-align: center; margin-top: 24px;">
                <a href="https://wa.me/22955748787?text=Bonjour, je suis un acheteur de billet pour l'événement {{ urlencode($order->event?->title ?? '') }}. Ma référence: {{ $order->payment_reference }}" class="whatsapp-btn">
                    Contacter via WhatsApp
                </a>
            </p>
        </div>

        <div class="footer">
            <p>Miss & Mister University Benin</p>
            <p><a href="https://missmisteruniversitybenin.com">missmisteruniversitybenin.com</a></p>
            <p style="margin-top: 8px;">Ce mail a été envoyé automatiquement. Merci de ne pas y répondre directement.</p>
        </div>
    </div>
</body>
</html>
