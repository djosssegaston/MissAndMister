<?php

namespace App\Console\Commands;

use App\Services\FedaPayService;
use App\Services\FedapayVoteReconciliationService;
use App\Services\PublicApiPayloadService;
use App\Services\ResultService;
use Illuminate\Console\Command;

class ReconcileMissingFedapayVotes extends Command
{
    protected $signature = 'payments:reconcile-missing-fedapay-votes
        {--limit=50 : Nombre maximum de lignes problematiques a afficher}
        {--pages=20 : Nombre maximum de pages a interroger chez FedaPay}
        {--per-page=100 : Nombre maximum de transactions par page}
        {--ignore-reference=* : References FedaPay a exclure}
        {--apply : Applique la reconciliation. Sans cette option, la commande reste en dry-run}
        {--debug : Affiche quelques diagnostics FedaPay}';

    protected $description = 'Compare les transactions FedaPay reussies aux paiements/votes locaux et reconcilie uniquement les votes manquants ou non confirmes';

    private const SUCCESS_STATUSES = ['approved', 'succeeded', 'successful', 'success', 'paid', 'transferred'];

    public function handle(
        FedaPayService $fedapay,
        FedapayVoteReconciliationService $reconciliation,
        ResultService $results,
        PublicApiPayloadService $publicApi,
    ): int {
        $limit = max(1, (int) $this->option('limit'));
        $pages = max(1, (int) $this->option('pages'));
        $perPage = max(1, min(200, (int) $this->option('per-page')));
        $apply = (bool) $this->option('apply');
        $debug = (bool) $this->option('debug');
        $ignoredReferences = $this->ignoredReferences();

        $remoteSuccessful = [];
        $pagesInspected = 0;
        $rawTransactionsInspected = 0;
        $statusHistogram = [];

        for ($page = 1; $page <= $pages; $page++) {
            $transactions = $fedapay->searchTransactions([
                'page' => $page,
                'per_page' => $perPage,
            ]);

            if ($transactions === []) {
                break;
            }

            $pagesInspected++;
            $rawTransactionsInspected += count($transactions);

            foreach ($transactions as $transaction) {
                $status = strtolower(trim((string) data_get($transaction, 'status', '')));
                $reference = trim((string) (
                    data_get($transaction, 'merchant_reference')
                    ?: data_get($transaction, 'custom_metadata.payment_reference')
                    ?: data_get($transaction, 'reference')
                    ?: ''
                ));

                $statusKey = $status !== '' ? $status : '(empty)';
                $statusHistogram[$statusKey] = ($statusHistogram[$statusKey] ?? 0) + 1;

                if (!in_array($status, self::SUCCESS_STATUSES, true)) {
                    continue;
                }

                if ($reference !== '' && in_array($reference, $ignoredReferences, true)) {
                    continue;
                }

                $remoteSuccessful[] = $transaction;
            }

            if (count($transactions) < $perPage) {
                break;
            }
        }

        $summary = [
            'remote_successful' => count($remoteSuccessful),
            'ok' => 0,
            'local_missing_payment' => 0,
            'local_missing_payment_fuzzy_match' => 0,
            'local_missing_vote' => 0,
            'local_vote_not_confirmed' => 0,
            'local_not_succeeded' => 0,
            'candidate_conflict' => 0,
            'applied' => 0,
            'payment_created' => 0,
            'payment_confirmed' => 0,
            'vote_created' => 0,
            'vote_confirmed' => 0,
            'source_tagged' => 0,
            'partial' => 0,
        ];

        $rows = [];

        foreach ($remoteSuccessful as $transaction) {
            $inspection = $reconciliation->inspectRemoteSuccessfulTransaction($transaction);
            $issue = $inspection['issue'];

            if ($issue === 'ok') {
                $summary['ok']++;
                continue;
            }

            if (isset($summary[$issue])) {
                $summary[$issue]++;
            }

            $result = $inspection;

            if ($apply) {
                $result = $reconciliation->reconcileRemoteSuccessfulTransaction($transaction);

                if (($result['applied'] ?? false) === true) {
                    $summary['applied']++;
                    $summary['payment_created'] += (int) ($result['payment_created'] ?? false);
                    $summary['payment_confirmed'] += (int) ($result['payment_confirmed'] ?? false);
                    $summary['vote_created'] += (int) ($result['vote_created'] ?? false);
                    $summary['vote_confirmed'] += (int) ($result['vote_confirmed'] ?? false);
                    $summary['source_tagged'] += (int) ($result['source_tagged'] ?? false);

                    if (($result['outcome'] ?? '') !== 'reconciled') {
                        $summary['partial']++;
                    }
                }
            }

            if (count($rows) < $limit) {
                $rows[] = [
                    'transaction_id' => $inspection['transaction_id'] ?: '-',
                    'reference' => $inspection['reference'] ?: '-',
                    'amount' => number_format((float) $inspection['amount'], 2, ',', ' '),
                    'status' => $inspection['status'] !== '' ? $inspection['status'] : '-',
                    'issue' => $issue,
                    'match_type' => $inspection['match_type'],
                    'payment_id' => $result['payment']?->id ?? $inspection['payment']?->id ?? '-',
                    'payment_status' => $result['payment']?->status ?? $inspection['payment']?->status ?? '-',
                    'vote_id' => $result['vote']?->id ?? $inspection['vote']?->id ?? '-',
                    'vote_status' => $result['vote']?->status ?? $inspection['vote']?->status ?? '-',
                    'candidate_id' => $result['vote']?->candidate_id ?? $inspection['vote']?->candidate_id ?? $inspection['candidate_id'] ?? '-',
                    'outcome' => $apply ? ($result['outcome'] ?? '-') : 'dry-run',
                ];
            }
        }

        if ($apply && $summary['applied'] > 0) {
            $results->calculateAndPersist();
            $publicApi->invalidateVotingData();
        }

        if ($debug) {
            $this->table(
                ['Diagnostic', 'Valeur'],
                [
                    ['FedaPay environment', $fedapay->environment()],
                    ['FedaPay API base URL', $fedapay->apiBaseUrl()],
                    ['Pages requested', $pages],
                    ['Per-page requested', $perPage],
                    ['Pages inspected', $pagesInspected],
                    ['Raw remote transactions inspected', $rawTransactionsInspected],
                    ['Ignored references', count($ignoredReferences)],
                    ['Mode', $apply ? 'apply' : 'dry-run'],
                ]
            );

            if ($statusHistogram !== []) {
                $this->table(
                    ['Statut remote', 'Occurrences'],
                    collect($statusHistogram)
                        ->sortByDesc(fn (int $count) => $count)
                        ->map(fn (int $count, string $status) => [$status, $count])
                        ->values()
                        ->all()
                );
            }
        }

        $this->table(
            ['Mesure', 'Valeur'],
            [
                ['Transactions FedaPay reussies inspectees', $summary['remote_successful']],
                ['Transactions deja synchronisees', $summary['ok']],
                ['Paiements locaux manquants', $summary['local_missing_payment'] + $summary['local_missing_payment_fuzzy_match']],
                ['Votes locaux manquants', $summary['local_missing_vote']],
                ['Votes locaux non confirmes', $summary['local_vote_not_confirmed']],
                ['Paiements locaux non succeeds', $summary['local_not_succeeded']],
                ['Conflits candidat', $summary['candidate_conflict']],
                ['Corrections appliquees', $summary['applied']],
                ['Paiements crees', $summary['payment_created']],
                ['Paiements confirmes', $summary['payment_confirmed']],
                ['Votes crees', $summary['vote_created']],
                ['Votes confirmes', $summary['vote_confirmed']],
                ['Votes marques source=reconciliation', $summary['source_tagged']],
                ['Corrections partielles', $summary['partial']],
                ['Mode', $apply ? 'apply' : 'dry-run'],
            ]
        );

        if ($rows !== []) {
            $this->table(
                ['Transaction', 'Reference', 'Montant', 'Statut remote', 'Probleme', 'Match', 'Paiement', 'Statut paiement', 'Vote', 'Statut vote', 'Candidat', 'Outcome'],
                array_map(static fn (array $row) => [
                    $row['transaction_id'],
                    $row['reference'],
                    $row['amount'],
                    $row['status'],
                    $row['issue'],
                    $row['match_type'],
                    $row['payment_id'],
                    $row['payment_status'],
                    $row['vote_id'],
                    $row['vote_status'],
                    $row['candidate_id'],
                    $row['outcome'],
                ], $rows)
            );
        } else {
            $this->info('Aucun ecart detecte.');
        }

        logger()->info('FedaPay remote reconciliation command completed', [
            'mode' => $apply ? 'apply' : 'dry-run',
            'summary' => $summary,
        ]);

        return self::SUCCESS;
    }

    private function ignoredReferences(): array
    {
        $configured = config('services.fedapay.audit_ignore_references', '');
        $configuredList = is_array($configured)
            ? $configured
            : (preg_split('/[\s,;]+/', (string) $configured) ?: []);
        $optionList = $this->option('ignore-reference');

        return array_values(array_unique(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            array_merge($configuredList, is_array($optionList) ? $optionList : [])
        ), static fn ($value) => $value !== '')));
    }
}
