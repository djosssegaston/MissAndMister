<?php

namespace App\Repositories;

use App\Models\Candidate;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class CandidateRepository
{
    public function paginatePublic(int $perPage = 15): LengthAwarePaginator
    {
        return Candidate::with('category')
            ->withSum(['votes as votes_count' => function ($q) {
                $q->where('status', 'confirmed');
            }], 'quantity')
            ->where(function ($q) {
                $q->where('status', 'active')->orWhereNull('status');
            })
            ->where('is_active', true)
            ->paginate($perPage);
    }

    public function paginateAll(int $perPage = 15): LengthAwarePaginator
    {
        return Candidate::with('category')
            ->withSum(['votes as votes_count' => function ($q) {
                $q->where('status', 'confirmed');
            }], 'quantity')
            ->paginate($perPage);
    }

    public function find(int $id): ?Candidate
    {
        return Candidate::with('category')->find($id);
    }

    public function findActive(int $id): ?Candidate
    {
        return Candidate::with('category')
            ->withSum(['votes as votes_count' => function ($q) {
                $q->where('status', 'confirmed');
            }], 'quantity')
            ->where(function ($q) {
                $q->where('status', 'active')->orWhereNull('status');
            })
            ->where('is_active', true)
            ->find($id);
    }

    public function create(array $data): Candidate
    {
        if (!isset($data['public_number'])) {
            $next = Candidate::withTrashed()->max('public_number') ?? 0;
            $data['public_number'] = $next + 1;
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
}
