<?php

namespace App\Policies;

use App\Models\Vote;
use Illuminate\Auth\Access\Response;

class VotePolicy
{
    public function viewAny($user): bool
    {
        return $user?->tokenCan('admin') === true;
    }

    public function view($user, Vote $vote): bool
    {
        return $user?->tokenCan('admin') || $vote->user_id === $user?->id;
    }

    public function create($user): bool
    {
        return $user !== null;
    }

    public function update($user, Vote $vote): bool
    {
        return $user?->tokenCan('admin') === true;
    }

    public function delete($user, Vote $vote): bool
    {
        return $user?->tokenCan('admin') === true;
    }

    public function restore($user, Vote $vote): bool
    {
        return $this->delete($user, $vote);
    }

    public function forceDelete($user, Vote $vote): bool
    {
        return false;
    }
}
