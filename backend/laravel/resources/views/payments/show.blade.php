<!doctype html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Paiement sécurisé | Miss & Mister</title>
    <script src="{{ $fedapayScriptUrl }}"></script>
    <style>
        :root {
            color-scheme: dark;
            --gold: #D4AF37;
            --gold-soft: rgba(212, 175, 55, 0.16);
            --bg: #050505;
            --panel: rgba(10, 10, 10, 0.94);
            --panel-strong: rgba(16, 14, 7, 0.96);
            --text: rgba(255, 255, 255, 0.9);
            --muted: rgba(255, 255, 255, 0.58);
            --line: rgba(212, 175, 55, 0.16);
        }

        * { box-sizing: border-box; }

        html, body {
            margin: 0;
            min-height: 100%;
            background:
                radial-gradient(circle at 15% 20%, rgba(212,175,55,0.14), transparent 24%),
                radial-gradient(circle at 85% 12%, rgba(255,255,255,0.05), transparent 18%),
                linear-gradient(180deg, #030303, #0a0a0a 56%, #030303);
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
            width: min(100%, 900px);
            background: linear-gradient(180deg, rgba(14, 12, 7, 0.96), rgba(6, 6, 6, 0.96));
            border: 1px solid rgba(212,175,55,0.18);
            border-radius: 30px;
            padding: clamp(24px, 4vw, 42px);
            box-shadow: 0 35px 90px rgba(0,0,0,0.56);
            position: relative;
            overflow: hidden;
        }

        .shell::before {
            content: "";
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            padding: 1px;
            background: linear-gradient(135deg, rgba(212,175,55,0.36), transparent 32%, rgba(212,175,55,0.08));
            pointer-events: none;
            -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
                    mask-composite: exclude;
        }

        .hero {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 22px;
        }

        .brand {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.74);
            font-size: 0.78rem;
            font-weight: 700;
        }

        .brand-mark {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at 30% 28%, rgba(255,255,255,0.16), transparent 42%),
                conic-gradient(from 0deg, rgba(212,175,55,0), rgba(212,175,55,0.92), rgba(212,175,55,0));
            padding: 2px;
            box-shadow: 0 0 24px rgba(212,175,55,0.18);
        }

        .brand-mark span {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            display: grid;
            place-items: center;
            background: #0b0b0b;
            border: 1px solid rgba(212,175,55,0.2);
            color: var(--gold);
            font-family: Georgia, "Times New Roman", serif;
            font-size: 0.92rem;
        }

        .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0.55rem 0.85rem;
            border-radius: 999px;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(212,175,55,0.14);
            color: rgba(255,255,255,0.8);
            font-size: 0.78rem;
            font-weight: 700;
        }

        .status-pill::before {
            content: "";
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: var(--gold);
            box-shadow: 0 0 14px rgba(212,175,55,0.5);
        }

        h1 {
            margin: 0;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(1.95rem, 4vw, 3.25rem);
            line-height: 1.06;
            color: #fff;
            max-width: 18ch;
        }

        .lead {
            margin: 0.9rem 0 0;
            max-width: 64rem;
            color: var(--muted);
            line-height: 1.8;
            font-size: 0.98rem;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 14px;
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
            color: rgba(255,255,255,0.46);
            margin-bottom: 6px;
        }

        .meta-card strong {
            display: block;
            font-size: 1rem;
            color: #fff;
            word-break: break-word;
        }

        .panel {
            margin-top: 1.25rem;
            border-radius: 24px;
            border: 1px solid rgba(212,175,55,0.14);
            background:
                radial-gradient(circle at 20% 20%, rgba(212,175,55,0.12), transparent 32%),
                rgba(255,255,255,0.02);
            padding: clamp(20px, 3vw, 28px);
        }

        .status {
            text-align: center;
        }

        .spinner {
            width: 76px;
            height: 76px;
            margin: 0 auto 16px;
            border-radius: 50%;
            border: 4px solid rgba(255,255,255,0.08);
            border-top-color: var(--gold);
            border-right-color: rgba(212,175,55,0.62);
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
            font-size: 1.18rem;
            font-weight: 800;
        }

        .status-text {
            margin: 0.65rem auto 0;
            max-width: 48rem;
            color: var(--muted);
            line-height: 1.72;
        }

        .actions {
            display: flex;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
            margin-top: 1.4rem;
        }

        .button,
        .link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 48px;
            padding: 0.82rem 1.2rem;
            border-radius: 12px;
            font-size: 0.96rem;
            font-weight: 800;
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

        .footnote {
            margin-top: 1rem;
            font-size: 0.85rem;
            color: rgba(255,255,255,0.5);
            text-align: center;
        }

        .badge-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: center;
            margin-top: 12px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 0.42rem 0.7rem;
            border-radius: 999px;
            border: 1px solid rgba(212,175,55,0.12);
            background: rgba(255,255,255,0.03);
            color: rgba(255,255,255,0.7);
            font-size: 0.74rem;
            font-weight: 700;
        }

        .badge svg {
            flex: none;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        @media (max-width: 780px) {
            .grid {
                grid-template-columns: 1fr;
            }

            h1 {
                max-width: none;
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
        $quantity = (int) ($payment->vote?->quantity ?? 1);
        $paymentData = [
            'reference' => $payment->reference,
            'payment_id' => $payment->id,
            'vote_id' => $payment->vote?->id,
            'candidate_id' => $payment->vote?->candidate_id,
            'quantity' => $quantity,
            'amount' => $payment->amount,
            'transaction_id' => $payment->transaction_id,
        ];
        $paymentState = $payment->status === 'succeeded'
            ? 'success'
            : ($payment->status === 'failed' ? 'failed' : 'opening');
        $paymentDescription = $candidateName !== 'Candidat inconnu'
            ? 'Vote sécurisé pour ' . $candidateName
            : 'Paiement sécurisé Miss & Mister University Bénin 2026';
    @endphp

    <main class="shell">
        <div class="hero">
            <div class="brand">
                <div class="brand-mark" aria-hidden="true"><span>MM</span></div>
                <span>Miss &amp; Mister University Bénin 2026</span>
            </div>
            <div class="status-pill">
                <span>Paiement chiffré et vérifié côté serveur</span>
            </div>
        </div>

        <h1>Paiement sécurisé FedaPay</h1>
        <p class="lead">
            La transaction est créée par le serveur avec une référence unique, puis confirmée uniquement après un retour
            FedaPay signé. Aucun vote n’est validé sans paiement réussi, et l’admin conserve le dernier mot sur les cas suspects.
        </p>

        <section class="grid" aria-label="Informations de paiement">
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

        @if (!$fedapayConfigured || !$fedapayPublicKey || !$payment->transaction_id)
            <section class="panel status" data-state="failed">
                <div class="spinner" aria-hidden="true"></div>
                <p class="status-title">Configuration FedaPay indisponible</p>
                <p class="status-text">
                    La clé publique, la clé secrète ou l’identifiant de transaction n’est pas encore disponible.
                    Le paiement ne peut pas démarrer tant que la configuration sécurisée n’est pas complète.
                </p>
                <div class="actions">
                    <a class="link" href="{{ $candidateLink }}">Retour au candidat</a>
                </div>
            </section>
        @else
            <section class="panel status" data-state="{{ $paymentState }}">
                <div class="spinner" aria-hidden="true"></div>
                <p class="status-title" data-status-title>
                    @if($payment->status === 'succeeded')
                        Paiement accepté avec succès
                    @elseif($payment->status === 'failed')
                        Paiement refusé ou interrompu
                    @else
                        Ouverture du paiement sécurisé...
                    @endif
                </p>
                <p class="status-text" data-status-text>
                    @if($payment->status === 'succeeded')
                        Merci pour votre soutien. Votre vote est maintenant enregistré et comptabilisé après confirmation du serveur.
                    @elseif($payment->status === 'failed')
                        Le paiement n’a pas abouti. Aucun vote n’a été comptabilisé.
                    @else
                        Gardez cette fenêtre ouverte. Le widget FedaPay va s’ouvrir pour finaliser le vote de manière sécurisée.
                    @endif
                </p>

                <div class="actions">
                    @if($payment->status !== 'succeeded')
                        <button
                            class="button"
                            type="button"
                            id="fedapay-pay-btn"
                            data-public-key="{{ $fedapayPublicKey }}"
                            data-environment="{{ $fedapayEnvironment }}"
                            data-transaction-id="{{ $payment->transaction_id }}"
                            data-transaction-amount="{{ (int) round($payment->amount) }}"
                            data-transaction-description="{{ $paymentDescription }}"
                            data-currency-iso="{{ $payment->currency }}"
                            data-button-text="Payer"
                            data-widget-description="Vote sécurisé Miss & Mister University Bénin 2026"
                        >
                            Payer
                        </button>
                    @endif
                    <a class="link" href="{{ $candidateLink }}">Retour au candidat</a>
                </div>

                <div class="badge-row" aria-hidden="true">
                    <span class="badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l8 5v5c0 5.5-3.8 9.9-8 10-4.2-.1-8-4.5-8-10V7l8-5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
                        Webhook signé
                    </span>
                    <span class="badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 1.5a10.5 10.5 0 1 0 10.5 10.5A10.5 10.5 0 0 0 12 1.5Z" stroke="currentColor" stroke-width="1.6"/><path d="M8 12l2.7 2.7L16 9.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        Vote confirmé après approbation
                    </span>
                </div>
            </section>
        @endif

        <p class="footnote">
            Référence transaction : <strong>{{ $payment->transaction_id ?? '—' }}</strong>
        </p>
    </main>

    <script>
        (() => {
            const payment = @json($paymentData);
            const status = @json($payment->status);
            const syncUrl = @json(url('/api/payments/' . $payment->reference . '/sync'));
            const fedapayPublicKey = @json($fedapayPublicKey);
            const fedapayEnvironment = @json($fedapayEnvironment);
            const paymentDescription = @json($paymentDescription);
            const statusBox = document.querySelector('.status');
            const title = document.querySelector('[data-status-title]');
            const message = document.querySelector('[data-status-text]');
            const button = document.getElementById('fedapay-pay-btn');
            const urlState = new URLSearchParams(window.location.search);
            let initialized = false;
            let syncTimer = null;
            let syncInFlight = false;
            let syncAttempts = 0;

            const setState = (nextState, nextTitle, nextMessage) => {
                if (!statusBox) {
                    return;
                }

                statusBox.dataset.state = nextState;

                if (title && nextTitle) {
                    title.textContent = nextTitle;
                }

                if (message && nextMessage) {
                    message.textContent = nextMessage;
                }
            };

            const setButtonState = (disabled, label = null) => {
                if (!button) {
                    return;
                }

                button.disabled = disabled;
                button.setAttribute('aria-busy', disabled ? 'true' : 'false');

                if (label) {
                    button.textContent = label;
                }
            };

            const updateUrlState = (value) => {
                const nextUrl = new URL(window.location.href);
                nextUrl.searchParams.set('payment', value);
                nextUrl.searchParams.set('reference', payment.reference);
                window.history.replaceState({}, '', nextUrl.toString());
            };

            const markSuccess = () => {
                updateUrlState('success');

                setState(
                    'success',
                    'Paiement accepté avec succès',
                    'Merci pour votre soutien. Le vote a été confirmé côté serveur et sera bien pris en compte dans les tableaux de bord.'
                );

                if (button) {
                    button.remove();
                }
            };

            const markFailed = (payload = {}) => {
                updateUrlState('failed');

                setState(
                    'failed',
                    'Paiement non finalisé',
                    payload?.message || 'Le paiement a été interrompu ou refusé. Aucun vote n’a été comptabilisé.'
                );

                initialized = false;
                setButtonState(false, 'Payer');
            };

            const markProcessing = (nextMessage = 'Le paiement a été transmis à FedaPay. Nous vérifions sa confirmation côté serveur...') => {
                updateUrlState('processing');
                setState(
                    'opening',
                    'Paiement en attente de confirmation',
                    nextMessage
                );
                setButtonState(true, 'Vérification...');
            };

            const stopSyncLoop = () => {
                if (syncTimer) {
                    window.clearInterval(syncTimer);
                    syncTimer = null;
                }
            };

            const parseSyncPayload = (payload) => {
                if (!payload || typeof payload !== 'object') {
                    return {};
                }

                if (payload.payment && typeof payload.payment === 'object') {
                    return payload.payment;
                }

                return payload;
            };

            const syncPaymentStatus = async () => {
                if (syncInFlight) {
                    return;
                }

                syncInFlight = true;

                try {
                    const response = await fetch(syncUrl, {
                        headers: {
                            Accept: 'application/json',
                        },
                    });

                    const payload = await response.json().catch(() => ({}));
                    const syncedPayment = parseSyncPayload(payload);
                    const paymentStatus = String(syncedPayment.payment_status || '').toLowerCase();
                    const voteStatus = String(syncedPayment.vote_status || '').toLowerCase();

                    if (response.ok && paymentStatus === 'succeeded' && voteStatus === 'confirmed') {
                        stopSyncLoop();
                        markSuccess();
                        return;
                    }

                    if (paymentStatus === 'failed' || voteStatus === 'failed') {
                        stopSyncLoop();
                        markFailed({ message: payload?.message || 'Le paiement a été refusé ou annulé. Aucun vote n’a été comptabilisé.' });
                        return;
                    }

                    syncAttempts += 1;

                    if (syncAttempts >= 12) {
                        stopSyncLoop();
                        setState(
                            'opening',
                            'Paiement en attente de confirmation',
                            'La transaction est encore en cours de vérification. Laissez cette page ouverte quelques instants, la confirmation sera appliquée dès réception côté serveur.'
                        );
                    }
                } catch (error) {
                    syncAttempts += 1;

                    if (syncAttempts >= 12) {
                        stopSyncLoop();
                        setState(
                            'opening',
                            'Vérification temporairement indisponible',
                            'Le paiement est peut-être encore en cours. Patientez puis actualisez cette page pour relancer la vérification serveur.'
                        );
                        setButtonState(false, 'Vérifier à nouveau');
                    }
                } finally {
                    syncInFlight = false;
                }
            };

            const startSyncLoop = () => {
                stopSyncLoop();
                syncAttempts = 0;
                void syncPaymentStatus();
                syncTimer = window.setInterval(syncPaymentStatus, 2500);
            };

            const initCheckout = () => {
                if (!button || initialized) {
                    if (urlState.get('payment') === 'processing') {
                        startSyncLoop();
                    }
                    return;
                }

                if (!window.FedaPay || typeof window.FedaPay.init !== 'function') {
                    markFailed({ message: 'Le module FedaPay n’a pas pu être chargé. Réessayez dans quelques secondes.' });
                    return;
                }

                try {
                    initialized = true;
                    setButtonState(true, 'Ouverture...');

                    const widget = window.FedaPay.init('#fedapay-pay-btn', {
                        public_key: fedapayPublicKey,
                        environment: fedapayEnvironment,
                        locale: 'fr',
                        transaction: {
                            id: Number(payment.transaction_id),
                            amount: Number(payment.amount),
                            description: paymentDescription,
                            custom_metadata: payment,
                        },
                        onComplete: (reason, transaction) => {
                            const transactionStatus = String(transaction?.status || '').toLowerCase();

                            if (
                                reason === window.FedaPay.CHECKOUT_COMPLETED
                                || transactionStatus === 'approved'
                                || transactionStatus === 'success'
                                || transactionStatus === 'succeeded'
                            ) {
                                markProcessing();
                                startSyncLoop();
                                return;
                            }

                            if (reason === window.FedaPay.DIALOG_DISMISSED) {
                                markFailed({ message: 'La fenêtre de paiement a été fermée avant la validation finale.' });
                                return;
                            }

                            if (transactionStatus === 'canceled' || transactionStatus === 'cancelled' || transactionStatus === 'declined' || transactionStatus === 'failed') {
                                markFailed({ message: 'Le paiement a été refusé ou annulé.' });
                                return;
                            }

                            markProcessing();
                            startSyncLoop();
                        },
                    });

                    if (widget && typeof widget.open === 'function') {
                        widget.open();
                        return;
                    }

                    button.click();
                } catch (error) {
                    initialized = false;
                    markFailed({ message: error?.message || 'Impossible d’ouvrir le widget FedaPay pour le moment.' });
                }
            };

            window.openPaymentWidget = initCheckout;

            if (button) {
                button.addEventListener('click', (event) => {
                    if (!initialized) {
                        event.preventDefault();
                        initCheckout();
                    }
                });
            }

            if (urlState.get('payment') === 'success' || status === 'succeeded') {
                markSuccess();
                return;
            }

            if (urlState.get('payment') === 'failed' || status === 'failed') {
                markFailed({ message: 'Le paiement associé à cette référence a déjà échoué. Vous pouvez relancer la collecte.' });
                return;
            }

            if (urlState.get('payment') === 'processing' || ['processing', 'pending'].includes(String(status).toLowerCase())) {
                markProcessing();
                startSyncLoop();
                return;
            }

            window.addEventListener('load', () => {
                initCheckout();
            }, { once: true });
        })();
    </script>
</body>
</html>
