<?php

namespace App\Console\Commands;

use App\Services\FedaPayService;
use App\Services\FedapayVoteReconciliationService;
use Illuminate\Console\Command;

class AuditFedapayCandidateConflicts extends Command
{
    protected $signature = 'payments:audit-fedapay-candidate-conflicts
        {--limit=100 : Nombre maximum de conflits a afficher}
        {--pages=20 : Nombre maximum de pages a interroger chez FedaPay}
        {--per-page=100 : Nombre maximum de transactions par page}
        {--reference=* : Filtre optionnel sur une ou plusieurs references}
        {--transaction-id=* : Filtre optionnel sur un ou plusieurs transaction_id FedaPay}
        {--ignore-reference=* : References FedaPay a exclure}
        {--debug : Affiche quelques diagnostics FedaPay}';

    protected $description = 'Audite en lecture seule les conflits candidat entre FedaPay et la base locale';

    private const SUCCESS_STATUSES = ['approved', 'succeeded', 'successful', 'success', 'paid', 'transferred'];

    public function handle(
        FedaPayService $fedapay,
        FedapayVoteReconciliationService $reconciliation,
    ): int {
        $limit = max(1, (int) $this->option('limit'));
        $pages = max(1, (int) $this->option('pages'));
        $perPage = max(1, min(200, (int) $this->option('per-page')));
        $debug = (bool) $this->option('debug');
        $ignoredReferences = $this->ignoredReferences();
        $referencesFilter = $this->normalizedArrayOption('reference');
        $transactionFilter = $this->normalizedArrayOption('transaction-id');

        $remoteSuccessful = [];
        $pagesInspected = 0;
        $rawTransactionsInspected = 0;
        $statusHistogram = [];
        $conflictTypeHistogram = [];
        $rows = [];

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
                $transactionId = trim((string) (
                    data_get($transaction, 'id')
                    ?: data_get($transaction, 'data.id')
                    ?: data_get($transaction, 'transaction.id')
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

                if ($referencesFilter !== [] && !in_array($reference, $referencesFilter, true)) {
                    continue;
                }

                if ($transactionFilter !== [] && !in_array($transactionId, $transactionFilter, true)) {
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
            'candidate_conflict' => 0,
            'distinct_payments' => 0,
            'distinct_votes' => 0,
            'distinct_remote_candidates' => 0,
            'distinct_local_vote_candidates' => 0,
        ];

        $distinctPayments = [];
        $distinctVotes = [];
        $distinctRemoteCandidates = [];
        $distinctLocalVoteCandidates = [];

        foreach ($remoteSuccessful as $transaction) {
            $inspection = $reconciliation->inspectRemoteSuccessfulTransaction($transaction);

            if (($inspection['issue'] ?? null) !== 'candidate_conflict') {
                continue;
            }

            $summary['candidate_conflict']++;

            if (($inspection['payment']?->id ?? null) !== null) {
                $distinctPayments[(string) $inspection['payment']->id] = true;
            }

            if (($inspection['vote']?->id ?? null) !== null) {
                $distinctVotes[(string) $inspection['vote']->id] = true;
            }

            $remoteCandidateKey = trim((string) (($inspection['remote_candidate_id'] ?? '') . '|' . ($inspection['remote_candidate_name'] ?? '')));
            if ($remoteCandidateKey !== '|') {
                $distinctRemoteCandidates[$remoteCandidateKey] = true;
            }

            $localVoteCandidateKey = trim((string) (($inspection['local_vote_candidate_id'] ?? '') . '|' . ($inspection['local_vote_candidate_name'] ?? '')));
            if ($localVoteCandidateKey !== '|') {
                $distinctLocalVoteCandidates[$localVoteCandidateKey] = true;
            }

            $conflictType = $inspection['conflict_type'] ?: 'candidate_conflict';
            $conflictTypeHistogram[$conflictType] = ($conflictTypeHistogram[$conflictType] ?? 0) + 1;

            if (count($rows) < $limit) {
                $rows[] = [
                    'transaction_id' => $inspection['transaction_id'] ?: '-',
                    'reference' => $inspection['reference'] ?: '-',
                    'amount' => number_format((float) $inspection['amount'], 2, ',', ' '),
                    'status' => $inspection['status'] !== '' ? $inspection['status'] : '-',
                    'payment_id' => $inspection['payment']?->id ?? '-',
                    'vote_id' => $inspection['vote']?->id ?? '-',
                    'match_type' => $inspection['match_type'] ?: '-',
                    'conflict_type' => $conflictType,
                    'remote_candidate_id' => $inspection['remote_candidate_id'] ?? '-',
                    'remote_candidate_name' => $inspection['remote_candidate_name'] ?: '-',
                    'local_vote_candidate_id' => $inspection['local_vote_candidate_id'] ?? '-',
                    'local_vote_candidate_name' => $inspection['local_vote_candidate_name'] ?: '-',
                    'local_meta_candidate_id' => $inspection['local_meta_candidate_id'] ?? '-',
                    'local_meta_candidate_name' => $inspection['local_meta_candidate_name'] ?: '-',
                ];
            }
        }

        $summary['distinct_payments'] = count($distinctPayments);
        $summary['distinct_votes'] = count($distinctVotes);
        $summary['distinct_remote_candidates'] = count($distinctRemoteCandidates);
        $summary['distinct_local_vote_candidates'] = count($distinctLocalVoteCandidates);

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
                    ['Reference filter', count($referencesFilter)],
                    ['Transaction filter', count($transactionFilter)],
                    ['Mode', 'audit-only'],
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

            if ($conflictTypeHistogram !== []) {
                $this->table(
                    ['Type de conflit', 'Occurrences'],
                    collect($conflictTypeHistogram)
                        ->sortByDesc(fn (int $count) => $count)
                        ->map(fn (int $count, string $type) => [$type, $count])
                        ->values()
                        ->all()
                );
            }
        }

        $this->table(
            ['Mesure', 'Valeur'],
            [
                ['Transactions FedaPay reussies inspectees', $summary['remote_successful']],
                ['Conflits candidat detectes', $summary['candidate_conflict']],
                ['Paiements locaux distincts concernes', $summary['distinct_payments']],
                ['Votes locaux distincts concernes', $summary['distinct_votes']],
                ['Candidats remote distincts', $summary['distinct_remote_candidates']],
                ['Candidats locaux distincts', $summary['distinct_local_vote_candidates']],
                ['Mode', 'audit-only'],
            ]
        );

        if ($rows !== []) {
            $this->table(
                [
                    'Transaction',
                    'Reference',
                    'Montant',
                    'Statut remote',
                    'Paiement',
                    'Vote',
                    'Match',
                    'Type conflit',
                    'Remote candidat ID',
                    'Remote candidat',
                    'Vote candidat ID',
                    'Vote candidat',
                    'Meta candidat ID',
                    'Meta candidat',
                ],
                array_map(static fn (array $row) => [
                    $row['transaction_id'],
                    $row['reference'],
                    $row['amount'],
                    $row['status'],
                    $row['payment_id'],
                    $row['vote_id'],
                    $row['match_type'],
                    $row['conflict_type'],
                    $row['remote_candidate_id'],
                    $row['remote_candidate_name'],
                    $row['local_vote_candidate_id'],
                    $row['local_vote_candidate_name'],
                    $row['local_meta_candidate_id'],
                    $row['local_meta_candidate_name'],
                ], $rows)
            );
        } else {
            $this->info('Aucun conflit candidat detecte.');
        }

        logger()->info('FedaPay candidate conflict audit completed', [
            'summary' => $summary,
            'pages_inspected' => $pagesInspected,
            'raw_transactions_inspected' => $rawTransactionsInspected,
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

        return $this->normalizeArrayValues(array_merge(
            $configuredList,
            is_array($optionList) ? $optionList : []
        ));
    }

    private function normalizedArrayOption(string $name): array
    {
        $value = $this->option($name);

        return $this->normalizeArrayValues(is_array($value) ? $value : []);
    }

    private function normalizeArrayValues(array $values): array
    {
        return array_values(array_unique(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            $values
        ), static fn ($value) => $value !== '')));
    }
}
