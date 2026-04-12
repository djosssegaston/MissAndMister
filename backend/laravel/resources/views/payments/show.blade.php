<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Paiement sécurisé | Miss & Mister</title>
    <script src="https://cdn.kkiapay.me/k.js"></script>
    <style>
        :root {
            color-scheme: dark;
            --gold: #D4AF37;
            --gold-soft: rgba(212, 175, 55, 0.18);
            --bg: #050505;
            --panel: rgba(12, 12, 12, 0.92);
            --text: rgba(255, 255, 255, 0.86);
            --muted: rgba(255, 255, 255, 0.56);
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            min-height: 100%;
            background:
                radial-gradient(circle at top, rgba(212,175,55,0.18), transparent 34%),
                radial-gradient(circle at 15% 18%, rgba(255,255,255,0.05), transparent 24%),
                linear-gradient(180deg, #030303, #0b0b0b);
            color: var(--text);
            font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        body {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
        }

        .shell {
            width: min(100%, 760px);
            background: var(--panel);
            border: 1px solid rgba(212,175,55,0.18);
            border-radius: 28px;
            padding: clamp(24px, 4vw, 40px);
            box-shadow: 0 30px 80px rgba(0,0,0,0.55);
            position: relative;
            overflow: hidden;
        }

        .shell::before {
            content: "";
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(135deg, rgba(212,175,55,0.32), transparent 35%, rgba(212,175,55,0.1));
            pointer-events: none;
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
                    mask-composite: exclude;
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 1.3rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.72);
            font-size: 0.78rem;
            font-weight: 700;
        }

        .brand-mark {
            width: 46px;
            height: 46px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at 30% 28%, rgba(255,255,255,0.14), transparent 42%),
                conic-gradient(from 0deg, rgba(212,175,55,0), rgba(212,175,55,0.9), rgba(212,175,55,0));
            padding: 2px;
            box-shadow: 0 0 24px rgba(212,175,55,0.18);
        }

        .brand-mark span {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: #0a0a0a;
            border: 1px solid rgba(212,175,55,0.2);
            color: var(--gold);
            font-family: Georgia, "Times New Roman", serif;
            font-size: 0.9rem;
        }

        h1 {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(1.8rem, 4vw, 3rem);
            line-height: 1.08;
            color: #fff;
        }

        .lead {
            margin: 0.85rem 0 0;
            max-width: 52rem;
            color: var(--muted);
            line-height: 1.75;
        }

        .meta {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin: 1.5rem 0 1.2rem;
        }

        .meta-card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(212,175,55,0.12);
            border-radius: 18px;
            padding: 14px 16px;
        }

        .meta-card span {
            display: block;
            font-size: 0.72rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.45);
            margin-bottom: 6px;
        }

        .meta-card strong {
            display: block;
            font-size: 1rem;
            color: #fff;
        }

        .status {
            margin-top: 1.35rem;
            border-radius: 22px;
            border: 1px solid rgba(212,175,55,0.14);
            background:
                radial-gradient(circle at 20% 20%, rgba(212,175,55,0.12), transparent 30%),
                rgba(255,255,255,0.02);
            padding: 22px;
            text-align: center;
        }

        .spinner {
            width: 72px;
            height: 72px;
            margin: 0 auto 14px;
            border-radius: 50%;
            border: 4px solid rgba(255,255,255,0.08);
            border-top-color: var(--gold);
            border-right-color: rgba(212,175,55,0.6);
            animation: spin 1s linear infinite;
            box-shadow: 0 0 26px rgba(212,175,55,0.15);
        }

        .status[data-state="success"] .spinner,
        .status[data-state="failed"] .spinner {
            animation: none;
        }

        .status-title {
            margin: 0;
            color: #fff;
            font-size: 1.15rem;
            font-weight: 800;
        }

        .status-text {
            margin: 0.55rem auto 0;
            max-width: 42rem;
            color: var(--muted);
            line-height: 1.7;
        }

        .actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 1.35rem;
        }

        .button,
        .link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 46px;
            padding: 0.8rem 1.2rem;
            border-radius: 12px;
            font-size: 0.95rem;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
            transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
        }

        .button {
            border: 1px solid rgba(212,175,55,0.22);
            background: linear-gradient(135deg, #EACB5B, #D4AF37);
            color: #140f00;
            box-shadow: 0 10px 28px rgba(212,175,55,0.22);
        }

        .link {
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.03);
            color: #fff;
        }

        .button:hover,
        .link:hover {
            transform: translateY(-1px);
        }

        .button:focus-visible,
        .link:focus-visible {
            outline: 2px solid rgba(212,175,55,0.75);
            outline-offset: 2px;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 720px) {
            .meta {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    @php
        $candidate = $payment->vote?->candidate;
        $candidateName = $candidate ? trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? '')) : 'Candidat inconnu';
        $candidateLink = $candidate?->id
            ? rtrim((string) $frontendUrl, '/') . '/candidates/' . $candidate->id
            : rtrim((string) $frontendUrl, '/') . '/candidates';
        $paymentData = [
            'reference' => $payment->reference,
            'payment_id' => $payment->id,
            'vote_id' => $payment->vote?->id,
            'candidate_id' => $payment->vote?->candidate_id,
            'quantity' => $payment->vote?->quantity,
            'amount' => $payment->amount,
        ];
    @endphp

    <main class="shell">
        <div class="brand">
            <div class="brand-mark" aria-hidden="true"><span>MM</span></div>
            <span>Miss &amp; Mister University Bénin 2026</span>
        </div>

        <h1>Paiement sécurisé Kkiapay</h1>
        <p class="lead">
            La fenêtre de paiement s'ouvre uniquement pour la référence générée par le serveur.
            Aucun vote n'est comptabilisé avant confirmation sécurisée.
        </p>

        <section class="meta" aria-label="Informations de paiement">
            <article class="meta-card">
                <span>Référence</span>
                <strong>{{ $payment->reference }}</strong>
            </article>
            <article class="meta-card">
                <span>Montant</span>
                <strong>{{ number_format((float) $payment->amount, 0, ',', ' ') }} {{ $payment->currency }}</strong>
            </article>
            <article class="meta-card">
                <span>Candidat</span>
                <strong>{{ $candidateName }}</strong>
            </article>
        </section>

        @if (!$kkiapayPublicKey)
            <section class="status" data-state="failed">
                <div class="spinner" aria-hidden="true"></div>
                <p class="status-title">Configuration de paiement indisponible</p>
                <p class="status-text">
                    La clé publique Kkiapay n'est pas configurée. Le paiement ne peut pas démarrer tant que
                    l'intégration n'est pas renseignée sur le serveur.
                </p>
                <div class="actions">
                    <a class="link" href="{{ $candidateLink }}">Retour au candidat</a>
                </div>
            </section>
        @else
            <section class="status" data-state="opening">
                <div class="spinner" aria-hidden="true"></div>
                <p class="status-title" data-status-title>Ouverture du paiement sécurisé...</p>
                <p class="status-text" data-status-text>
                    Gardez cette fenêtre ouverte. Le widget Kkiapay va s'afficher pour finaliser votre vote.
                </p>
                <div class="actions">
                    <button class="button" type="button" data-retry>Rouvrir le paiement</button>
                    <a class="link" href="{{ $candidateLink }}">Retour au candidat</a>
                </div>
            </section>
        @endif
    </main>

    <script>
        (function () {
            const payment = @json($paymentData);
            const paymentStatus = @json($payment->status);
            const widgetConfig = {
                amount: Number(payment.amount),
                key: @json($kkiapayPublicKey),
                sandbox: @json($sandbox),
                position: 'center',
                theme: '#D4AF37',
                partnerId: payment.reference,
                data: payment,
            };

            const statusBox = document.querySelector('.status');
            const title = document.querySelector('[data-status-title]');
            const message = document.querySelector('[data-status-text]');
            const retryButton = document.querySelector('[data-retry]');
            const urlState = new URLSearchParams(window.location.search);
            let openedOnce = false;

            const setState = (state, nextTitle, nextMessage) => {
                if (!statusBox) {
                    return;
                }

                statusBox.dataset.state = state;
                if (title && nextTitle) {
                    title.textContent = nextTitle;
                }
                if (message && nextMessage) {
                    message.textContent = nextMessage;
                }
            };

            const openWidget = () => {
                if (typeof window.openKkiapayWidget !== 'function') {
                    setState(
                        'failed',
                        'Widget Kkiapay indisponible',
                        'Le module de paiement n\'a pas pu être chargé. Cliquez sur "Rouvrir le paiement" pour réessayer.'
                    );
                    return;
                }

                openedOnce = true;
                setState(
                    'opening',
                    'Ouverture du paiement sécurisé...',
                    'Le widget Kkiapay s\'ouvre maintenant. Aucun vote ne sera pris en compte avant confirmation.'
                );

                window.openKkiapayWidget(widgetConfig);
            };

            const handleSuccess = () => {
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('payment', 'success');
                nextUrl.searchParams.set('reference', payment.reference);
                window.history.replaceState({}, '', nextUrl.toString());

                setState(
                    'success',
                    'Paiement accepté avec succès',
                    'Merci pour votre soutien. Votre vote sera confirmé automatiquement après validation sécurisée, puis comptabilisé dans le tableau de bord admin.'
                );

                if (retryButton) {
                    retryButton.textContent = 'Rouvrir le paiement';
                }
            };

            const handleFailed = (payload) => {
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('payment', 'failed');
                nextUrl.searchParams.set('reference', payment.reference);
                window.history.replaceState({}, '', nextUrl.toString());

                setState(
                    'failed',
                    'Paiement non finalisé',
                    payload?.message || 'Le paiement a été interrompu ou refusé. Aucun vote n\'a été comptabilisé.'
                );
            };

            window.openPaymentWidget = openWidget;

            if (retryButton) {
                retryButton.addEventListener('click', openWidget);
            }

            if (typeof window.addKkiapayListener === 'function') {
                window.addKkiapayListener('success', handleSuccess);
                window.addKkiapayListener('failed', handleFailed);
            }

            if (urlState.get('payment') === 'success' || paymentStatus === 'succeeded') {
                handleSuccess();
                return;
            }

            if (urlState.get('payment') === 'failed' || paymentStatus === 'failed') {
                handleFailed({ message: 'Le paiement associé à cette référence a déjà échoué. Vous pouvez réessayer.' });
                return;
            }

            window.addEventListener('load', () => {
                if (!openedOnce) {
                    openWidget();
                }
            }, { once: true });
        })();
    </script>
</body>
</html>
