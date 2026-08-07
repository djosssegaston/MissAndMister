<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use App\Models\Candidate;
use App\Models\Payment;
use App\Services\FedaPayService;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;

class DiagnoseMissingVotes extends Command
{
    protected $signature = 'payments:diagnose-missing-votes
        {--references=* : References locales des paiements a diagnostiquer}
        {--limit=50 : Nombre max de paiements succeeds sans vote a scanner si aucune reference n est fournie}
        {--with-remote : Interroge FedaPay pour chaque transaction (plus lent)}';

    protected $description = 'Expose tous les indices (meta, payload, user, logs, transaction FedaPay) permettant d identifier le candidat des paiements FedaPay reussis sans vote';

    public function handle(FedaPayService $fedapay): int
    {
        $references = array_values(array_filter(array_map(
            static fn ($value) => trim((string) $value),
            is_array($this->option('references')) ? $this->option('references') : []
        ), static fn ($value) => $value !== ''));
        $limit = max(1, (int) $this->option('limit'));
        $withRemote = (bool) $this->option('with-remote');

        $payments = $references !== []
            ? $this->resolveByReferences($references)
            : $this->scanPaymentsWithoutVote($limit);

        if ($payments->isEmpty()) {
            $this->warn('Aucun paiement a diagnostiquer.');

            return self::SUCCESS;
        }

        foreach ($payments as $payment) {
            $this->diagnosePayment($payment, $fedapay, $withRemote);
        }

        return self::SUCCESS;
    }

    private function resolveByReferences(array $references): \Illuminate\Support\Collection
    {
        return collect($references)
            ->map(fn (string $reference): ?Payment => Payment::withTrashed()
                ->with(['user', 'vote', 'transactions'])
                ->where('reference', $reference)
                ->first())
            ->filter()
            ->values();
    }

    private function scanPaymentsWithoutVote(int $limit): \Illuminate\Support\Collection
    {
        return Payment::query()
            ->with(['user', 'vote', 'transactions'])
            ->where('provider', 'fedapay')
            ->where('status', Payment::STATUS_SUCCEEDED)
            ->whereDoesntHave('vote')
            ->orderBy('id')
            ->limit($limit)
            ->get();
    }

    private function diagnosePayment(Payment $payment, FedaPayService $fedapay, bool $withRemote): void
    {
        $payment->loadMissing(['user', 'vote', 'transactions']);

        $meta = (array) ($payment->meta ?? []);
        $payload = (array) ($payment->payload ?? []);

        $this->newLine();
        $this->line(str_repeat('=', 72));
        $this->line('Paiement #'.$payment->id.' — '.$payment->reference);
        $this->line(str_repeat('-', 72));

        $this->table(
            ['Champ', 'Valeur'],
            [
                ['reference', $payment->reference],
                ['transaction_id', (string) ($payment->transaction_id ?? '-')],
                ['amount', number_format((float) $payment->amount, 2, ',', ' ').' '.($payment->currency ?? '')],
                ['status', $payment->status],
                ['user_id', (string) ($payment->user_id ?? '-')],
                ['paid_at', optional($payment->paid_at)->toDateTimeString() ?? '-'],
                ['created_at', optional($payment->created_at)->toDateTimeString() ?? '-'],
                ['deleted_at', optional($payment->deleted_at)->toDateTimeString() ?? '-'],
                ['meta candidate_id', (string) (data_get($meta, 'candidate_id') ?? '-')],
                ['meta candidate_name', (string) (data_get($meta, 'candidate_name') ?? '-')],
                ['meta voter_name', (string) (data_get($meta, 'voter_name') ?? '-')],
                ['meta voter_email', (string) (data_get($meta, 'voter_email') ?? '-')],
                ['meta voter_phone', (string) (data_get($meta, 'voter_phone') ?? '-')],
                ['meta ip', (string) (data_get($meta, 'ip') ?? '-')],
                ['meta quantity', (string) (data_get($meta, 'quantity') ?? '-')],
            ]
        );

        $this->diagnoseUser($payment);
        $this->diagnoseActivityLogs($payment);
        $this->diagnosePayload($payload);
        $this->diagnoseTransactions($payment);

        if ($withRemote && $payment->transaction_id) {
            $this->diagnoseRemoteTransaction($fedapay, (string) $payment->transaction_id);
        }
    }

    private function diagnoseUser(Payment $payment): void
    {
        $user = $payment->user;

        if (! $user) {
            $this->line('User : aucun user lie.');
            $this->line('Votes du user : aucun.');

            return;
        }

        $this->table(
            ['Champ', 'Valeur'],
            [
                ['user id', $user->id],
                ['name', (string) ($user->name ?? '-')],
                ['email', (string) ($user->email ?? '-')],
                ['phone', (string) ($user->phone ?? '-')],
                ['candidate_id', (string) ($user->candidate_id ?? '-')],
            ]
        );

        $userVotes = $user->votes()->with(['candidate'])->orderByDesc('id')->limit(10)->get();

        if ($userVotes->isEmpty()) {
            $this->line('Votes du user : aucun.');

            return;
        }

        $this->table(
            ['Vote', 'Candidate', 'Statut', 'Montant', 'Payment', 'Cree le'],
            $userVotes->map(fn ($vote) => [
                $vote->id,
                $vote->candidate_id !== null
                    ? '#'.$vote->candidate_id.' '.trim(($vote->candidate->first_name ?? '').' '.($vote->candidate->last_name ?? ''))
                    : '-',
                $vote->status,
                number_format((float) $vote->amount, 2, ',', ' '),
                (string) ($vote->payment_id ?? '-'),
                optional($vote->created_at)->toDateTimeString() ?? '-',
            ])->all()
        );
    }

    private function diagnoseActivityLogs(Payment $payment): void
    {
        $logs = ActivityLog::query()
            ->withTrashed()
            ->where(function ($query) use ($payment): void {
                $query
                    ->where('subject_type', Payment::class)
                    ->where('subject_id', $payment->id)
                    ->orWhere('meta->payment_id', $payment->id);
            })
            ->orderBy('id')
            ->limit(20)
            ->get();

        if ($logs->isEmpty()) {
            $this->line('Activity logs : aucun.');

            return;
        }

        $this->table(
            ['Log', 'Action', 'Causer', 'Candidate (meta)', 'Meta', 'IP', 'Cree le'],
            $logs->map(fn (ActivityLog $log) => [
                $log->id,
                $log->action,
                $log->causer_type ? '#'.$log->causer_id.' '.class_basename($log->causer_type) : '-',
                (string) (data_get($log->meta, 'candidate_id') ?? '-'),
                $this->compactJson($log->meta),
                (string) ($log->ip_address ?? '-'),
                optional($log->created_at)->toDateTimeString() ?? '-',
            ])->all()
        );
    }

    private function diagnosePayload(array $payload): void
    {
        $fedapay = Arr::get($payload, 'fedapay', []);

        $description = trim((string) (Arr::get($fedapay, 'description') ?: Arr::get($payload, 'description')));
        $customMetadata = Arr::get($fedapay, 'custom_metadata', []);
        $customer = Arr::get($fedapay, 'customer', []);

        $this->table(
            ['Payload', 'Valeur'],
            [
                ['fedapay description', $description !== '' ? $description : '-'],
                ['fedapay custom_metadata', $this->compactJson($customMetadata)],
                ['fedapay customer', $this->compactJson($customer)],
                ['top_level_keys', implode(', ', array_keys($payload))],
            ]
        );

        $candidateName = $this->parseCandidateNameFromDescription($description);
        if ($candidateName !== null) {
            $this->suggestCandidates($candidateName);
        }
    }

    private function diagnoseTransactions(Payment $payment): void
    {
        if ($payment->transactions->isEmpty()) {
            $this->line('Transactions liees : aucune.');

            return;
        }

        $this->table(
            ['Transaction', 'Type', 'Statut', 'Montant', 'Provider ref', 'Cree le'],
            $payment->transactions->map(fn ($transaction) => [
                $transaction->id,
                $transaction->type,
                $transaction->status,
                number_format((float) $transaction->amount, 2, ',', ' '),
                (string) ($transaction->provider_reference ?? '-'),
                optional($transaction->created_at)->toDateTimeString() ?? '-',
            ])->all()
        );
    }

    private function diagnoseRemoteTransaction(FedaPayService $fedapay, string $transactionId): void
    {
        try {
            $transaction = $fedapay->retrieveTransaction($transactionId);
        } catch (\Throwable $exception) {
            $this->line('FedaPay remote : echec de la recuperation ('.$exception->getMessage().').');

            return;
        }

        if (! $transaction) {
            $this->line('FedaPay remote : transaction introuvable.');

            return;
        }

        $description = trim((string) (
            Arr::get($transaction, 'description')
            ?: Arr::get($transaction, 'data.description')
        ));

        $this->table(
            ['FedaPay remote', 'Valeur'],
            [
                ['status', (string) (Arr::get($transaction, 'status') ?? '-')],
                ['amount', (string) (Arr::get($transaction, 'amount') ?? '-')],
                ['description', $description !== '' ? $description : '-'],
                ['custom_metadata', $this->compactJson(
                    Arr::get($transaction, 'custom_metadata') ?: Arr::get($transaction, 'data.custom_metadata')
                )],
                ['customer', $this->compactJson(
                    Arr::get($transaction, 'customer') ?: Arr::get($transaction, 'data.customer')
                )],
                ['created_at', (string) (Arr::get($transaction, 'created_at') ?? '-')],
            ]
        );

        $candidateName = $this->parseCandidateNameFromDescription($description);
        if ($candidateName !== null) {
            $this->suggestCandidates($candidateName);
        }
    }

    private function parseCandidateNameFromDescription(string $description): ?string
    {
        $trimmed = trim($description);

        if (preg_match('/^Vote pour\s+(.+)$/iu', $trimmed, $matches) === 1) {
            $name = trim((string) ($matches[1] ?? ''));

            return $name !== '' ? $name : null;
        }

        return null;
    }

    private function suggestCandidates(string $candidateName): void
    {
        $candidates = Candidate::withTrashed()
            ->select(['id', 'public_number', 'first_name', 'last_name', 'slug', 'deleted_at'])
            ->where(function ($query) use ($candidateName): void {
                $query
                    ->whereRaw('TRIM(CONCAT(first_name, " ", last_name)) = ?', [$candidateName]);
                foreach (preg_split('/\s+/', $candidateName) ?: [] as $token) {
                    $query
                        ->orWhere('first_name', 'like', '%'.trim($token).'%')
                        ->orWhere('last_name', 'like', '%'.trim($token).'%');
                }
            })
            ->orderByRaw('deleted_at IS NULL DESC')
            ->orderBy('first_name')
            ->limit(10)
            ->get();

        if ($candidates->isEmpty()) {
            $this->line('Candidat suggere : aucun match pour "'.$candidateName.'".');

            return;
        }

        $this->table(
            ['Candidat suggere', 'ID', 'Public #', 'Nom', 'Slug', 'Supprime le'],
            $candidates->map(fn (Candidate $candidate) => [
                'candidat',
                $candidate->id,
                (string) ($candidate->public_number ?? '-'),
                trim(($candidate->first_name ?? '').' '.($candidate->last_name ?? '')),
                (string) ($candidate->slug ?? '-'),
                optional($candidate->deleted_at)->toDateTimeString() ?? '-',
            ])->all()
        );
    }

    private function compactJson(mixed $value): string
    {
        if ($value === null || $value === '' || $value === []) {
            return '-';
        }

        $encoded = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        return $encoded !== false ? $encoded : '-';
    }
}
