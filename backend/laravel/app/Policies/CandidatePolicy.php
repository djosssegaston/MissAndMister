<?php

namespace App\Policies;

use App\Models\Candidate;
use Illuminate\Auth\Access\Response;

class CandidatePolicy
{
    public function viewAny($user): bool
    {
        return true;
    }

    public function view($user, Candidate $candidate): bool
    {
        return true;
    }

    public function create($user): bool
    {
        return $user?->tokenCan('admin') === true;
    }

    public function update($user, Candidate $candidate): bool
    {
        return $user?->tokenCan('admin') === true;
    }

    public function delete($user, Candidate $candidate): bool
    {
        return $user?->tokenCan('admin') === true;
    }

    public function restore($user, Candidate $candidate): bool
    {
        return $this->delete($user, $candidate);
    }

    public function forceDelete($user, Candidate $candidate): bool
    {
        return false;
    }
}
