<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\Vote;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class AuditFedapayPayments extends Command
{
    protected $signature = 'payments:audit-fedapay {--limit=50 : Nombre maximum de paiements problematiques a afficher}';

    protected $description = 'Audite les paiements FedaPay reussis qui ne sont pas correctement comptabilises dans le dashboard';

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));

        $successfulPaymentsQuery = Payment::query()
            ->where('provider', 'fedapay')
            ->where('status', Payment::STATUS_SUCCEEDED);

        $successfulPaymentsCount = (clone $successfulPaymentsQuery)->count();
        $successfulPaymentsAmount = (float) (clone $successfulPaymentsQuery)->sum('amount');

        $counted = DB::table('payments')
            ->join('votes', function ($join) {
                $join->on('votes.payment_id', '=', 'payments.id')
                    ->whereNull('votes.deleted_at');
            })
            ->where('payments.provider', 'fedapay')
            ->where('payments.status', Payment::STATUS_SUCCEEDED)
            ->where('votes.status', Vote::STATUS_CONFIRMED)
            ->selectRaw('COUNT(DISTINCT payments.id) as payments_count')
            ->selectRaw('COALESCE(SUM(votes.amount), 0) as revenue')
            ->selectRaw('COALESCE(SUM(votes.quantity), 0) as votes_count')
            ->first();

        $voteStats = DB::table('votes')
            ->select('payment_id')
            ->selectRaw('COUNT(*) as all_votes')
            ->selectRaw('SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) as active_votes')
            ->selectRaw('SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as trashed_votes')
            ->whereNotNull('payment_id')
            ->groupBy('payment_id')
            ->get()
            ->keyBy('payment_id');

        $problemRows = [];
        $reasonStats = [];

        Payment::query()
            ->where('provider', 'fedapay')
            ->where('status', Payment::STATUS_SUCCEEDED)
            ->with(['vote'])
            ->orderBy('id')
            ->chunk(500, function ($payments) use ($voteStats, &$problemRows, &$reasonStats, $limit): void {
                foreach ($payments as $payment) {
                    $stats = $voteStats->get($payment->id);
                    $allVotes = (int) ($stats->all_votes ?? 0);
                    $activeVotes = (int) ($stats->active_votes ?? 0);
                    $trashedVotes = (int) ($stats->trashed_votes ?? 0);
                    $activeVote = $payment->vote;

                    $reason = null;

                    if (!$activeVote && $allVotes === 0) {
                        $reason = 'no_vote';
                    } elseif (!$activeVote && $trashedVotes > 0) {
                        $reason = 'soft_deleted_vote_only';
                    } elseif ($activeVote && $activeVote->status !== Vote::STATUS_CONFIRMED) {
                        $reason = 'vote_not_confirmed';
                    } elseif ($activeVote && abs((float) $activeVote->amount - (float) $payment->amount) > 0.01) {
                        $reason = 'amount_mismatch';
                    } elseif ($activeVotes > 1) {
                        $reason = 'multiple_active_votes';
                    }

                    if (!$reason) {
                        continue;
                    }

                    if (!isset($reasonStats[$reason])) {
                        $reasonStats[$reason] = ['count' => 0, 'amount' => 0.0];
                    }

                    $reasonStats[$reason]['count']++;
                    $reasonStats[$reason]['amount'] += (float) $payment->amount;

                    if (count($problemRows) >= $limit) {
                        continue;
                    }

                    $problemRows[] = [
                        'payment_id' => $payment->id,
                        'reference' => $payment->reference,
                        'transaction_id' => (string) ($payment->transaction_id ?? ''),
                        'amount' => (float) $payment->amount,
                        'reason' => $reason,
                        'candidate_name' => (string) (data_get($payment->meta, 'candidate_name') ?? ''),
                        'active_vote_id' => $activeVote?->id,
                        'active_vote_status' => $activeVote?->status,
                        'candidate_id' => $activeVote?->candidate_id ?: data_get($payment->meta, 'candidate_id'),
                        'all_votes' => $allVotes,
                        'active_votes' => $activeVotes,
                        'trashed_votes' => $trashedVotes,
                    ];
                }
            });

        $countedPayments = (int) ($counted->payments_count ?? 0);
        $countedRevenue = (float) ($counted->revenue ?? 0);
        $countedVotes = (int) ($counted->votes_count ?? 0);
        $gapAmount = $successfulPaymentsAmount - $countedRevenue;

        $this->table(
            ['Mesure', 'Valeur'],
            [
                ['Paiements FedaPay succeeds locaux', $successfulPaymentsCount],
                ['Montant succeeds local', number_format($successfulPaymentsAmount, 2, ',', ' ') . ' CFA'],
                ['Paiements comptes dans le dashboard', $countedPayments],
                ['Montant compte dans le dashboard', number_format($countedRevenue, 2, ',', ' ') . ' CFA'],
                ['Votes comptes dans le dashboard', $countedVotes],
                ['Ecart local succeed vs dashboard', number_format($gapAmount, 2, ',', ' ') . ' CFA'],
            ]
        );

        if ($reasonStats !== []) {
            $this->table(
                ['Raison', 'Paiements', 'Montant'],
                collect($reasonStats)
                    ->map(fn (array $stats, string $reason) => [
                        $reason,
                        $stats['count'],
                        number_format((float) $stats['amount'], 2, ',', ' ') . ' CFA',
                    ])
                    ->sortByDesc(fn (array $row) => $row[1])
                    ->values()
                    ->all()
            );
        } else {
            $this->info('Aucun probleme local evident trouve parmi les paiements succeeds.');
        }

        if ($problemRows !== []) {
            $this->table(
                ['Payment ID', 'Reference', 'Transaction', 'Montant', 'Raison', 'Nom candidat', 'Vote actif', 'Statut vote', 'Candidate', 'Votes total', 'Votes actifs', 'Votes suppr.'],
                array_map(static fn (array $row) => [
                    $row['payment_id'],
                    $row['reference'],
                    $row['transaction_id'],
                    number_format($row['amount'], 2, ',', ' '),
                    $row['reason'],
                    $row['candidate_name'] !== '' ? $row['candidate_name'] : '-',
                    $row['active_vote_id'] ?? '-',
                    $row['active_vote_status'] ?? '-',
                    $row['candidate_id'] ?? '-',
                    $row['all_votes'],
                    $row['active_votes'],
                    $row['trashed_votes'],
                ], $problemRows)
            );
        }

        return self::SUCCESS;
    }
}
