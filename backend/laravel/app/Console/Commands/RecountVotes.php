<?php

namespace App\Console\Commands;

use App\Models\Payment;
use App\Models\Result;
use App\Models\Vote;
use App\Services\PublicApiPayloadService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecountVotes extends Command
{
    protected $signature = 'votes:recount
        {--provider=* : Fournisseurs de paiement a compter (ex: fedapay). Vide = tous les votes confirmes}
        {--dry-run : Affiche le recomptage sans modifier la table des resultats}
        {--limit=0 : Nombre maximum de candidats a recalculer (0 = tous)}';

    protected $description = 'Recompte les votes confirmes par candidat et met a jour la table des resultats';

    public function handle(PublicApiPayloadService $publicApi): int
    {
        $providers = array_values(array_filter($this->option('provider')));
        $dryRun = (bool) $this->option('dry-run');
        $limit = max(0, (int) $this->option('limit'));

        $candidateIds = $this->candidateIdsWithVotes();

        $this->info('Recomptage des votes confirmes par candidat...');

        $aggregates = $this->aggregateVotes($candidateIds, $providers);

        $rows = [];
        $updated = 0;

        foreach ($aggregates as $aggregate) {
            $candidateId = (int) $aggregate->candidate_id;
            $categoryId = $aggregate->category_id !== null ? (int) $aggregate->category_id : null;
            $totalVotes = (int) $aggregate->total_votes;
            $totalAmount = (float) $aggregate->total_amount;

            $current = Result::query()
                ->where('candidate_id', $candidateId)
                ->first();

            $currentVotes = $current ? (int) $current->total_votes : 0;

            if (! $dryRun) {
                Result::updateOrCreate(
                    ['candidate_id' => $candidateId],
                    [
                        'category_id' => $categoryId,
                        'total_votes' => $totalVotes,
                        'total_amount' => $totalAmount,
                        'status' => 'published',
                    ]
                );

                if ($currentVotes !== $totalVotes) {
                    $updated++;
                }
            }

            $rows[] = [
                $candidateId,
                $categoryId ?? '-',
                $totalVotes,
                number_format($totalAmount, 2, ',', ' '),
                $currentVotes,
                $currentVotes !== $totalVotes ? 'OUI' : 'non',
            ];
        }

        $this->table(
            ['Candidat ID', 'Categorie', 'Votes confirmes', 'Montant', 'Votes avant', 'Modifie'],
            $rows
        );

        $this->info(sprintf(
            'Candidats recalculés: %d (%d modifiés%s).',
            count($rows),
            $updated,
            $dryRun ? ' - dry-run, aucune écriture' : ''
        ));

        if (! $dryRun) {
            $publicApi->invalidateVotingData();
            $this->info('Table des resultats synchronisee et cache public invalide.');
        }

        return self::SUCCESS;
    }

    private function candidateIdsWithVotes(): array
    {
        return Vote::query()
            ->select('candidate_id')
            ->distinct()
            ->pluck('candidate_id')
            ->all();
    }

    private function aggregateVotes(array $candidateIds, array $providers): \Illuminate\Support\Collection
    {
        $query = DB::table('votes')
            ->leftJoin('payments', 'payments.id', '=', 'votes.payment_id')
            ->join('candidates', 'candidates.id', '=', 'votes.candidate_id')
            ->selectRaw('votes.candidate_id, candidates.category_id, SUM(votes.quantity) as total_votes, SUM(votes.amount) as total_amount')
            ->where('votes.status', Vote::STATUS_CONFIRMED)
            ->where(function ($query) {
                $query
                    ->whereNull('votes.payment_id')
                    ->orWhere('payments.status', Payment::STATUS_SUCCEEDED);
            });

        if ($providers !== []) {
            $query->whereIn('payments.provider', $providers);
        }

        if ($candidateIds !== []) {
            $query->whereIn('votes.candidate_id', $candidateIds);
        }

        return $query
            ->groupBy('votes.candidate_id', 'candidates.category_id')
            ->get();
    }
}
