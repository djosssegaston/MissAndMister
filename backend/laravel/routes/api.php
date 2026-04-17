<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CandidateController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\GalleryController;
use App\Http\Controllers\Api\PartnerController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ResultController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VoteController;
use App\Http\Controllers\Api\PublicCandidateController;
use App\Http\Controllers\PublicMediaController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:login');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('change-password', [AuthController::class, 'changePassword'])->name('auth.change-password');
    });
});

// Aliases for SPA expectations
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::middleware('auth:sanctum')->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
});

// Public data
Route::prefix('public')->group(function () {
    Route::get('candidates', [PublicCandidateController::class, 'index']);
    Route::get('candidates/{identifier}', [PublicCandidateController::class, 'show']);
    Route::get('media/{path}', [PublicMediaController::class, 'show'])->where('path', '.*');
    Route::get('stats', [StatsController::class, 'publicStats']);
    Route::get('gallery', [GalleryController::class, 'publicIndex']);
    Route::get('partners', [PartnerController::class, 'publicIndex']);
});

// Legacy public endpoints (kept for compatibility)
Route::get('candidates', [CandidateController::class, 'index']);
Route::get('candidates/{candidate}', [CandidateController::class, 'show']);
Route::post('votes', [VoteController::class, 'store'])->middleware('throttle:60,1');

Route::middleware(['auth:sanctum', 'force_password_change'])->group(function () {
    Route::get('payments/{payment}', [PaymentController::class, 'show']);
    Route::get('profile', [UserController::class, 'profile']);
});

Route::post('payment/webhook', [PaymentController::class, 'webhook']);
Route::get('payments/{reference}/sync', [PaymentController::class, 'sync']);

// Admin-only routes
Route::middleware(['auth:sanctum', 'role:admin,superadmin'])->prefix('admin')->group(function () {
    Route::get('candidates', [CandidateController::class, 'adminIndex']);
    Route::apiResource('candidates', CandidateController::class)->only(['store', 'update', 'destroy']);
    Route::post('candidates/{candidate}/photo', [CandidateController::class, 'uploadPhoto']);
    Route::post('candidates/{candidate}/video', [CandidateController::class, 'uploadVideo']);
    Route::patch('candidates/{candidate}/status', [CandidateController::class, 'toggleStatus']);
    Route::get('gallery', [GalleryController::class, 'adminIndex']);
    Route::post('gallery', [GalleryController::class, 'store']);
    Route::put('gallery/{galleryItem}', [GalleryController::class, 'update']);
    Route::delete('gallery/{galleryItem}', [GalleryController::class, 'destroy']);
    Route::get('partners', [PartnerController::class, 'adminIndex']);
    Route::post('partners', [PartnerController::class, 'store']);
    Route::put('partners/{partnerLogo}', [PartnerController::class, 'update']);
    Route::delete('partners/{partnerLogo}', [PartnerController::class, 'destroy']);
    Route::apiResource('categories', CategoryController::class)->only(['index', 'store', 'update', 'destroy']);
    Route::get('payments', [PaymentController::class, 'index']);
    Route::get('votes', [VoteController::class, 'index']);
    Route::get('votes/export', [VoteController::class, 'export']);
    Route::get('votes/{id}', [VoteController::class, 'show']);
    Route::patch('votes/{id}', [VoteController::class, 'update']);
    Route::delete('votes/{id}', [VoteController::class, 'destroy']);
    Route::get('users', [UserController::class, 'adminIndex']);
    Route::patch('users/{user}/status', [UserController::class, 'updateStatus']);
    Route::delete('users/{user}', [UserController::class, 'destroy']);
    Route::get('stats', [StatsController::class, 'index']);
    Route::get('dashboard/stats', [StatsController::class, 'index']);
    Route::get('results/export', [ResultController::class, 'export']);
    Route::apiResource('results', ResultController::class)->only(['index', 'store', 'update']);
    Route::apiResource('settings', SettingsController::class)->only(['index', 'store', 'update']);
    Route::get('activity', [AdminController::class, 'activity']);
});

Route::middleware(['auth:sanctum', 'force_password_change', 'role:candidate'])->group(function () {
    Route::get('candidate/dashboard', [CandidateController::class, 'dashboard']);
});

Route::middleware(['auth:sanctum', 'force_password_change', 'role:user'])->group(function () {
    Route::get('user/dashboard', [UserController::class, 'dashboard']);
});

// Public settings (dates, toggles, price, etc.)
Route::get('public/settings', [SettingsController::class, 'public']);
