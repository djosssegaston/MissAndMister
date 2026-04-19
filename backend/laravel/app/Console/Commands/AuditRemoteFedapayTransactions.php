<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\Vote;
use App\Services\FedaPayService;
use App\Services\PaymentService;
use App\Services\ResultService;
use Illuminate\Console\Command;

class AuditRemoteFedapayTransactions extends Command
{
    protected $signature = 'payments:audit-fedapay-remote
        {--limit=50 : Nombre maximum de lignes problematiques a afficher}
        {--pages=20 : Nombre maximum de pages a interroger chez FedaPay}
        {--per-page=100 : Nombre maximum de transactions par page}
        {--debug : Affiche l environnement FedaPay et quelques diagnostics}
        {--recover : Applique le rattrapage local pour les transactions reussies manquantes ou desynchronisees}';

    protected $description = 'Compare les transactions FedaPay live aux paiements locaux et peut rattraper celles manquantes';

    private const SUCCESS_STATUSES = ['approved', 'succeeded', 'successful', 'success', 'paid', 'transferred'];
    private const MAX_DEBUG_STATUS_ROWS = 8;

    public function handle(
        FedaPayService $fedapay,
        PaymentService $payments,
        ResultService $results,
    ): int {
        $limit = max(1, (int) $this->option('limit'));
        $pages = max(1, (int) $this->option('pages'));
        $perPage = max(1, min(200, (int) $this->option('per-page')));
        $recover = (bool) $this->option('recover');
        $debug = (bool) $this->option('debug');

        $seenTransactionIds = [];
        $remoteSuccessful = [];
        $rawTransactionsInspected = 0;
        $pagesInspected = 0;
        $statusHistogram = [];

        for ($page = 1; $page <= $pages; $page++) {
            $batch = $fedapay->searchTransactions([
                'page' => $page,
                'per_page' => $perPage,
            ]);

            if ($batch === []) {
                break;
            }

            $pagesInspected++;
            $rawTransactionsInspected += count($batch);

            foreach ($batch as $transaction) {
                $transactionId = trim((string) data_get($transaction, 'id', ''));
                $status = strtolower(trim((string) data_get($transaction, 'status', '')));
                $statusKey = $status !== '' ? $status : '(empty)';

                if (!isset($statusHistogram[$statusKey])) {
                    $statusHistogram[$statusKey] = 0;
                }

                $statusHistogram[$statusKey]++;

                if (!in_array($status, self::SUCCESS_STATUSES, true)) {
                    continue;
                }

                if ($transactionId !== '' && isset($seenTransactionIds[$transactionId])) {
                    continue;
                }

                if ($transactionId !== '') {
                    $seenTransactionIds[$transactionId] = true;
                }

                $remoteSuccessful[] = $transaction;
            }

            if (count($batch) < $perPage) {
                break;
            }
        }

        $summary = [
            'remote_count' => count($remoteSuccessful),
            'remote_amount' => 0.0,
            'local_ok' => 0,
            'local_missing' => 0,
            'local_not_succeeded' => 0,
            'local_succeeded_no_vote' => 0,
            'recovered' => 0,
        ];
        $problemRows = [];

        foreach ($remoteSuccessful as $transaction) {
            $amount = (float) data_get($transaction, 'amount', 0);
            $summary['remote_amount'] += $amount;

            $transactionId = trim((string) data_get($transaction, 'id', ''));
            $reference = trim((string) (
                data_get($transaction, 'merchant_reference')
                ?: data_get($transaction, 'custom_metadata.payment_reference')
                ?: data_get($transaction, 'reference')
                ?: ''
            ));

            $payment = null;
            if ($transactionId !== '') {
                $payment = Payment::withTrashed()->where('transaction_id', $transactionId)->first();
            }
            if (!$payment && $reference !== '') {
                $payment = Payment::withTrashed()->where('reference', $reference)->first();
            }

            $reason = null;
            $voteStatus = null;

            if (!$payment) {
                $reason = 'local_missing';
                $summary['local_missing']++;
            } else {
                $voteStatus = $payment->vote?->status;

                if ($payment->status !== Payment::STATUS_SUCCEEDED) {
                    $reason = 'local_not_succeeded';
                    $summary['local_not_succeeded']++;
                } elseif (!$payment->vote || $payment->vote->status !== Vote::STATUS_CONFIRMED) {
                    $reason = 'local_succeeded_no_vote';
                    $summary['local_succeeded_no_vote']++;
                } else {
                    $summary['local_ok']++;
                }
            }

            if ($recover && $reason !== null) {
                try {
                    $syncedPayment = $payments->syncRemoteSuccessfulTransaction($transaction);
                    if ($syncedPayment?->status === Payment::STATUS_SUCCEEDED && $syncedPayment->vote?->status === Vote::STATUS_CONFIRMED) {
                        $summary['recovered']++;
                        $reason = null;
                    }
                } catch (\Throwable $exception) {
                    logger()->warning('Remote FedaPay audit recovery failed', [
                        'transaction_id' => $transactionId !== '' ? $transactionId : null,
                        'reference' => $reference !== '' ? $reference : null,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }

            if ($reason !== null && count($problemRows) < $limit) {
                $problemRows[] = [
                    'transaction_id' => $transactionId,
                    'reference' => $reference,
                    'amount' => $amount,
                    'status' => strtolower(trim((string) data_get($transaction, 'status', ''))),
                    'reason' => $reason,
                    'local_payment_id' => $payment?->id,
                    'local_status' => $payment?->status,
                    'vote_status' => $voteStatus,
                    'candidate_name' => (string) (
                        data_get($transaction, 'custom_metadata.candidate_name')
                        ?: data_get($payment?->meta ?? [], 'candidate_name')
                        ?: ''
                    ),
                ];
            }
        }

        if ($recover) {
            $results->calculateAndPersist();
        }

        if ($debug) {
            $this->table(
                ['Diagnostic', 'Valeur'],
                [
                    ['FedaPay environment', $fedapay->environment()],
                    ['FedaPay API base URL', $fedapay->apiBaseUrl()],
                    ['Secret key configured', $fedapay->secretKey() ? 'yes' : 'no'],
                    ['Webhook secret configured', $fedapay->webhookSecret() ? 'yes' : 'no'],
                    ['Pages requested', $pages],
                    ['Per-page requested', $perPage],
                    ['Pages inspected', $pagesInspected],
                    ['Raw remote transactions inspected', $rawTransactionsInspected],
                    ['Recognized success statuses', implode(', ', self::SUCCESS_STATUSES)],
                ]
            );

            if ($statusHistogram !== []) {
                $this->table(
                    ['Statut remote', 'Occurrences'],
                    collect($statusHistogram)
                        ->sortByDesc(fn (int $count) => $count)
                        ->take(self::MAX_DEBUG_STATUS_ROWS)
                        ->map(fn (int $count, string $status) => [$status, $count])
                        ->values()
                        ->all()
                );
            }
        }

        $this->table(
            ['Mesure', 'Valeur'],
            [
                ['Transactions FedaPay live reussies', $summary['remote_count']],
                ['Montant FedaPay live reussi', number_format((float) $summary['remote_amount'], 2, ',', ' ') . ' CFA'],
                ['Paiements locaux OK', $summary['local_ok']],
                ['Paiements locaux manquants', $summary['local_missing']],
                ['Paiements locaux non succeeds', $summary['local_not_succeeded']],
                ['Paiements succeeds sans vote confirme', $summary['local_succeeded_no_vote']],
                ['Paiements recuperes pendant ce run', $summary['recovered']],
            ]
        );

        if ($problemRows !== []) {
            $this->table(
                ['Transaction', 'Reference', 'Montant', 'Statut remote', 'Raison', 'Paiement local', 'Statut local', 'Vote', 'Nom candidat'],
                array_map(static fn (array $row) => [
                    $row['transaction_id'] !== '' ? $row['transaction_id'] : '-',
                    $row['reference'] !== '' ? $row['reference'] : '-',
                    number_format((float) $row['amount'], 2, ',', ' '),
                    $row['status'] !== '' ? $row['status'] : '-',
                    $row['reason'],
                    $row['local_payment_id'] ?? '-',
                    $row['local_status'] ?? '-',
                    $row['vote_status'] ?? '-',
                    $row['candidate_name'] !== '' ? $row['candidate_name'] : '-',
                ], $problemRows)
            );
        } else {
            $this->info('Aucun ecart remote/local detecte sur l\'echantillon FedaPay inspecte.');
        }

        return self::SUCCESS;
    }
}
