<?php

namespace App\Repositories;

use App\Models\Candidate;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class CandidateRepository
{
    public function paginatePublic(int $perPage = 500): LengthAwarePaginator
    {
        return $this->publicBaseQuery()
            ->withSum(['votes as votes_count' => function ($q) {
                $q->successful();
            }], 'quantity')
            ->orderBy('category_id')
            ->orderByRaw('CASE WHEN public_number IS NULL THEN 1 ELSE 0 END')
            ->orderBy('public_number')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate($perPage);
    }

    public function paginateAll(int $perPage = 500): LengthAwarePaginator
    {
        return Candidate::withTrashed()
            ->with('category')
            ->withSum(['votes as votes_count' => function ($q) {
                $q->successful();
            }], 'quantity')
            ->orderBy('category_id')
            ->orderByRaw('CASE WHEN public_number IS NULL THEN 1 ELSE 0 END')
            ->orderBy('public_number')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->paginate($perPage);
    }

    public function find(int $id): ?Candidate
    {
        return Candidate::with('category')->find($id);
    }

    public function findActiveByIdentifier(string $identifier): ?Candidate
    {
        $normalized = trim($identifier);

        return $this->publicBaseQuery()
            ->withSum(['votes as votes_count' => function ($q) {
                $q->successful();
            }], 'quantity')
            ->where(function (Builder $query) use ($normalized) {
                $query->where('public_uid', $normalized)
                    ->orWhere('slug', $normalized);

                if (ctype_digit($normalized)) {
                    $matchingCandidateIds = Candidate::query()
                        ->where('public_number', (int) $normalized)
                        ->pluck('id');

                    if ($matchingCandidateIds->count() === 1) {
                        $query->orWhereKey($matchingCandidateIds->all());
                    }
                }
            })
            ->first();
    }

    public function create(array $data): Candidate
    {
        if (!isset($data['public_number'])) {
            $data['public_number'] = $this->nextPublicNumberForCategory((int) $data['category_id']);
        }
        return Candidate::create($data);
    }

    public function update(Candidate $candidate, array $data): Candidate
    {
        $candidate->update($data);
        return $candidate;
    }

    public function delete(Candidate $candidate): void
    {
        $candidate->update(['status' => 'inactive', 'is_active' => false]);
        $candidate->delete();
    }

    private function publicBaseQuery(): Builder
    {
        return Candidate::with('category')
            ->where(function (Builder $query) {
                $query->where('status', 'active')->orWhereNull('status');
            })
            ->where(function (Builder $query) {
                $query->where('is_active', true)->orWhereNull('is_active');
            });
    }

    private function nextPublicNumberForCategory(int $categoryId): int
    {
        $next = Candidate::withTrashed()
            ->where('category_id', $categoryId)
            ->max('public_number') ?? 0;

        return ((int) $next) + 1;
    }
}
