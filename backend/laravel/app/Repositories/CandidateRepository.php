<?php

namespace App\Repositories;

use App\Models\Candidate;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Builder;

class CandidateRepository
{
    public function paginatePublic(int $perPage = 50, ?string $category = null): LengthAwarePaginator
    {
        return $this->publicListQuery($category)
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

    public function listPublic(?string $category = null): Collection
    {
        return $this->publicListQuery($category)
            ->withSum(['votes as votes_count' => function ($q) {
                $q->successful();
            }], 'quantity')
            ->orderBy('category_id')
            ->orderByRaw('CASE WHEN public_number IS NULL THEN 1 ELSE 0 END')
            ->orderBy('public_number')
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();
    }

    public function paginateAll(int $perPage = 100, ?string $category = null, ?string $search = null): LengthAwarePaginator
    {
        return $this->adminListQuery($category, $search)
            ->with('category:id,name')
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

    public function adminSummary(): array
    {
        $summary = Candidate::withTrashed()
            ->leftJoin('categories', 'categories.id', '=', 'candidates.category_id')
            ->selectRaw('COUNT(candidates.id) as total')
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(categories.name, '')) = 'miss' THEN 1 ELSE 0 END) as miss")
            ->selectRaw("SUM(CASE WHEN LOWER(COALESCE(categories.name, '')) = 'mister' THEN 1 ELSE 0 END) as mister")
            ->selectRaw("SUM(CASE WHEN candidates.is_active = 1 OR candidates.status = 'active' THEN 1 ELSE 0 END) as active")
            ->first();

        return [
            'total' => (int) ($summary?->total ?? 0),
            'miss' => (int) ($summary?->miss ?? 0),
            'mister' => (int) ($summary?->mister ?? 0),
            'active' => (int) ($summary?->active ?? 0),
        ];
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

    public function resolveRankInCategory(Candidate $candidate): ?int
    {
        $targetVotes = (int) ($candidate->votes_count ?? 0);

        if (!$candidate->category_id || $targetVotes <= 0) {
            return null;
        }

        $rankedIds = $this->publicBaseQuery()
            ->select([
                'id',
                'category_id',
                'first_name',
                'last_name',
                'public_number',
            ])
            ->where('category_id', $candidate->category_id)
            ->withSum(['votes as votes_count' => function ($query) {
                $query->successful();
            }], 'quantity')
            ->get()
            ->filter(fn (Candidate $item) => (int) ($item->votes_count ?? 0) > 0)
            ->sort(function (Candidate $left, Candidate $right) {
                $leftVotes = (int) ($left->votes_count ?? 0);
                $rightVotes = (int) ($right->votes_count ?? 0);

                if ($leftVotes !== $rightVotes) {
                    return $rightVotes <=> $leftVotes;
                }

                $leftNumber = $left->public_number ?? PHP_INT_MAX;
                $rightNumber = $right->public_number ?? PHP_INT_MAX;

                if ($leftNumber !== $rightNumber) {
                    return $leftNumber <=> $rightNumber;
                }

                return strcasecmp(
                    trim(($left->last_name ?? '') . ' ' . ($left->first_name ?? '')),
                    trim(($right->last_name ?? '') . ' ' . ($right->first_name ?? ''))
                );
            })
            ->pluck('id')
            ->values();

        $position = $rankedIds->search($candidate->id);

        return $position === false ? null : ((int) $position + 1);
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
        return Candidate::with('category:id,name')
            ->where(function (Builder $query) {
                $query->where('status', 'active')->orWhereNull('status');
            })
            ->where(function (Builder $query) {
                $query->where('is_active', true)->orWhereNull('is_active');
            });
    }

    private function adminListQuery(?string $category = null, ?string $search = null): Builder
    {
        return Candidate::withTrashed()
            ->select([
                'id',
                'category_id',
                'first_name',
                'last_name',
                'public_number',
                'public_uid',
                'slug',
                'email',
                'university',
                'age',
                'city',
                'bio',
                'description',
                'photo_path',
                'photo_original_path',
                'photo_variants',
                'photo_processing_status',
                'photo_processing_error',
                'video_path',
                'is_active',
                'status',
                'created_at',
                'deleted_at',
            ])
            ->when(filled($category), function (Builder $query) use ($category) {
                $normalizedCategory = strtolower(trim((string) $category));

                $query->whereHas('category', function (Builder $categoryQuery) use ($normalizedCategory) {
                    $categoryQuery->whereRaw('LOWER(name) = ?', [$normalizedCategory]);
                });
            })
            ->when(filled($search), function (Builder $query) use ($search) {
                $normalizedSearch = trim((string) $search);
                $like = '%' . $normalizedSearch . '%';

                $query->where(function (Builder $searchQuery) use ($like, $normalizedSearch) {
                    $searchQuery
                        ->where('first_name', 'like', $like)
                        ->orWhere('last_name', 'like', $like)
                        ->orWhereRaw("CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) like ?", [$like])
                        ->orWhere('email', 'like', $like)
                        ->orWhere('university', 'like', $like)
                        ->orWhere('city', 'like', $like)
                        ->orWhere('public_uid', 'like', $like)
                        ->orWhere('slug', 'like', $like);

                    if (ctype_digit($normalizedSearch)) {
                        $searchQuery->orWhere('public_number', (int) $normalizedSearch);
                    }
                });
            });
    }

    private function publicListQuery(?string $category = null): Builder
    {
        return $this->publicBaseQuery()
            ->select([
                'id',
                'category_id',
                'first_name',
                'last_name',
                'public_number',
                'public_uid',
                'slug',
                'university',
                'photo_path',
                'photo_variants',
            ])
            ->when(filled($category), function (Builder $query) use ($category) {
                $normalizedCategory = strtolower(trim((string) $category));

                $query->whereHas('category', function (Builder $categoryQuery) use ($normalizedCategory) {
                    $categoryQuery->whereRaw('LOWER(name) = ?', [$normalizedCategory]);
                });
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
