<?php

namespace App\Console\Commands;

use App\Models\Candidate;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Console\Command;

class RecoverMissingVote extends Command
{
    protected $signature = 'payments:recover-missing-vote
        {reference : Reference locale du paiement FedaPay}
        {candidate? : ID, public_uid, slug ou public_number du candidat}
        {--dry-run : Verifie seulement la resolution sans ecrire}';

    protected $description = 'Rattache manuellement un paiement FedaPay reussi sans vote au bon candidat, sans doublonner';

    public function handle(PaymentService $payments): int
    {
        $reference = trim((string) $this->argument('reference'));
        $candidateInput = trim((string) $this->argument('candidate'));

        $payment = Payment::query()->with(['vote'])->where('reference', $reference)->first();

        if (!$payment) {
            $this->error('Paiement introuvable pour cette reference.');

            return self::FAILURE;
        }

        $candidate = $candidateInput !== ''
            ? $this->resolveCandidate($candidateInput)
            : $this->resolveCandidateFromPayment($payment);

        if (!$candidate) {
            $this->error('Candidat introuvable. Lance la commande sans placeholder ou passe un vrai ID/public_uid/slug/public_number.');
            $suggestions = $this->suggestCandidatesForPayment($payment);

            if ($suggestions->isNotEmpty()) {
                $this->newLine();
                $this->warn('Suggestions de candidats proches pour ce paiement :');
                $this->table(
                    ['ID', 'Public #', 'Nom', 'Slug', 'Supprime le'],
                    $suggestions->map(static fn (Candidate $candidate) => [
                        $candidate->id,
                        $candidate->public_number,
                        trim(($candidate->first_name ?? '') . ' ' . ($candidate->last_name ?? '')),
                        $candidate->slug,
                        optional($candidate->deleted_at)?->toDateTimeString() ?? '-',
                    ])->all()
                );
                $this->line('Relance ensuite la commande avec l\'ID correct en second argument.');
            }

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

    private function resolveCandidateFromPayment(Payment $payment): ?Candidate
    {
        $candidateId = (int) data_get($payment->meta, 'candidate_id', 0);
        if ($candidateId > 0) {
            $candidate = Candidate::withTrashed()->find($candidateId);
            if ($candidate) {
                return $candidate;
            }
        }

        $candidateName = trim((string) data_get($payment->meta, 'candidate_name', ''));
        if ($candidateName === '') {
            return null;
        }

        $matches = Candidate::withTrashed()
            ->whereRaw("TRIM(CONCAT(first_name, ' ', last_name)) = ?", [$candidateName])
            ->get();

        if ($matches->count() === 1) {
            return $matches->first();
        }

        return null;
    }

    private function suggestCandidatesForPayment(Payment $payment): Collection
    {
        $candidateName = trim((string) data_get($payment->meta, 'candidate_name', ''));
        if ($candidateName === '') {
            return new Collection();
        }

        $tokens = collect(preg_split('/\s+/', $candidateName) ?: [])
            ->map(static fn (string $token) => trim($token))
            ->filter(static fn (string $token) => mb_strlen($token) >= 3)
            ->values();

        if ($tokens->isEmpty()) {
            return new Collection();
        }

        return Candidate::withTrashed()
            ->select(['id', 'public_number', 'first_name', 'last_name', 'slug', 'deleted_at'])
            ->where(function ($query) use ($tokens): void {
                foreach ($tokens as $token) {
                    $query
                        ->orWhere('first_name', 'like', '%' . $token . '%')
                        ->orWhere('last_name', 'like', '%' . $token . '%');
                }
            })
            ->orderByRaw('deleted_at IS NULL DESC')
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->limit(10)
            ->get();
    }
}
