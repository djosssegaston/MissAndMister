<?php

namespace App\Console\Commands;

use App\Services\PaymentService;
use App\Services\ResultService;
use Illuminate\Console\Command;

class ReconcileFedapayPayments extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'payments:reconcile-fedapay {--limit=200 : Nombre maximum de paiements a verifier par passe} {--recent-hours=2160 : Anciennete maximale des paiements echoues a recontroler} {--passes=1 : Nombre maximum de passes consecutives a executer}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Recontrole les paiements FedaPay recents et repare les votes non synchronises';

    /**
     * Execute the console command.
     */
    public function handle(PaymentService $payments, ResultService $results): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $recentHours = max(1, (int) $this->option('recent-hours'));
        $passes = max(1, (int) $this->option('passes'));

        $this->info("Reconciliation FedaPay en cours (limit={$limit}, recent-hours={$recentHours}, passes={$passes})...");

        $totals = [
            'inspected' => 0,
            'confirmed' => 0,
            'failed' => 0,
            'processing' => 0,
            'vote_repairs' => 0,
        ];

        for ($pass = 1; $pass <= $passes; $pass++) {
            $stats = $payments->reconcileUnsettledFedapayPayments($limit, $recentHours);
            $payments->reconcileSuccessfulAssociations(max($limit * 2, 250));

            foreach (array_keys($totals) as $key) {
                $totals[$key] += (int) ($stats[$key] ?? 0);
            }

            $inspected = (int) ($stats['inspected'] ?? 0);

            $this->line("Passe {$pass}: inspectes={$inspected}, confirmes=" . ($stats['confirmed'] ?? 0) . ", echoues=" . ($stats['failed'] ?? 0) . ", en_traitement=" . ($stats['processing'] ?? 0) . ", votes_repares=" . ($stats['vote_repairs'] ?? 0));

            if ($inspected < $limit) {
                break;
            }
        }

        $results->calculateAndPersist();

        $this->table(
            ['Inspectes', 'Confirmes', 'Echoues', 'En traitement', 'Votes reparés'],
            [[
                $totals['inspected'] ?? 0,
                $totals['confirmed'] ?? 0,
                $totals['failed'] ?? 0,
                $totals['processing'] ?? 0,
                $totals['vote_repairs'] ?? 0,
            ]]
        );

        $this->info('Reconciliation FedaPay terminee.');

        return self::SUCCESS;
    }
}
