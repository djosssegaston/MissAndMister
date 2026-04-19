<?php

namespace App\Console\Commands;

use App\Models\Candidate;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Console\Command;

class RecoverMissingVote extends Command
{
    protected $signature = 'payments:recover-missing-vote
        {reference : Reference locale du paiement FedaPay}
        {candidate : ID, public_uid, slug ou public_number du candidat}
        {--dry-run : Verifie seulement la resolution sans ecrire}';

    protected $description = 'Rattache manuellement un paiement FedaPay reussi sans vote au bon candidat, sans doublonner';

    public function handle(PaymentService $payments): int
    {
        $reference = trim((string) $this->argument('reference'));
        $candidateInput = trim((string) $this->argument('candidate'));
        $candidate = $this->resolveCandidate($candidateInput);

        if (!$candidate) {
            $this->error('Candidat introuvable pour cet identifiant.');

            return self::FAILURE;
        }

        $payment = Payment::query()->with(['vote'])->where('reference', $reference)->first();

        if (!$payment) {
            $this->error('Paiement introuvable pour cette reference.');

            return self::FAILURE;
        }

        if ($this->option('dry-run')) {
            $this->table(
                ['Champ', 'Valeur'],
                [
                    ['reference', $reference],
                    ['payment_id', $payment->id],
                    ['candidate_id', $candidate->id],
                    ['candidate_name', trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''))],
                    ['payment_status', $payment->status],
                    ['vote_status', $payment->vote?->status ?? 'missing'],
                ]
            );

            return self::SUCCESS;
        }

        $payment = $payments->recoverMissingVote($reference, (int) $candidate->id);

        $payment->refresh()->loadMissing(['vote']);

        $this->table(
            ['Champ', 'Valeur'],
            [
                ['reference', $payment->reference],
                ['payment_id', $payment->id],
                ['payment_status', $payment->status],
                ['vote_id', $payment->vote?->id ?? 'missing'],
                ['vote_status', $payment->vote?->status ?? 'missing'],
                ['candidate_id', $payment->vote?->candidate_id ?? $candidate->id],
                ['candidate_name', trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? ''))],
                ['amount', (float) $payment->amount],
            ]
        );

        return self::SUCCESS;
    }

    private function resolveCandidate(string $input): ?Candidate
    {
        if ($input === '') {
            return null;
        }

        $query = Candidate::withTrashed();

        if (ctype_digit($input)) {
            $numeric = (int) $input;

            return (clone $query)
                ->whereKey($numeric)
                ->orWhere('public_number', $numeric)
                ->first();
        }

        return $query->where('public_uid', $input)
            ->orWhere('slug', $input)
            ->first();
    }
}
