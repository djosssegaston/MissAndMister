<?php

namespace App\Providers;

use App\Models\Admin;
use App\Models\Candidate;
use App\Models\User;
use App\Models\Vote;
use App\Policies\AdminPolicy;
use App\Policies\CandidatePolicy;
use App\Policies\UserPolicy;
use App\Policies\VotePolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        User::class => UserPolicy::class,
        Candidate::class => CandidatePolicy::class,
        Vote::class => VotePolicy::class,
        Admin::class => AdminPolicy::class,
    ];

    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        $this->registerPolicies();
    }
}
