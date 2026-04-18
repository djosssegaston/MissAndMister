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
    protected $signature = 'payments:reconcile-fedapay {--limit=200 : Nombre maximum de paiements a verifier} {--recent-hours=2160 : Anciennete maximale des paiements echoues a recontroler}';

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

        $this->info("Reconciliation FedaPay en cours (limit={$limit}, recent-hours={$recentHours})...");

        $stats = $payments->reconcileUnsettledFedapayPayments($limit, $recentHours);
        $payments->reconcileSuccessfulAssociations(max($limit * 2, 250));
        $results->calculateAndPersist();

        $this->table(
            ['Inspectes', 'Confirmes', 'Echoues', 'En traitement', 'Votes reparés'],
            [[
                $stats['inspected'] ?? 0,
                $stats['confirmed'] ?? 0,
                $stats['failed'] ?? 0,
                $stats['processing'] ?? 0,
                $stats['vote_repairs'] ?? 0,
            ]]
        );

        $this->info('Reconciliation FedaPay terminee.');

        return self::SUCCESS;
    }
}
