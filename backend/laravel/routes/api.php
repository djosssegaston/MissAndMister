<?php

use App\Http\Controllers\Api\AdminBilletterieController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BilletterieController;
use App\Http\Controllers\Api\CandidateController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ClassementExportController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\GalleryController;
use App\Http\Controllers\Api\JSeraiAdminController;
use App\Http\Controllers\Api\JSeraiController;
use App\Http\Controllers\Api\PartnerController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PublicCandidateController;
use App\Http\Controllers\Api\PublicInitController;
use App\Http\Controllers\Api\ResultController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SocialProjectController;
use App\Http\Controllers\Api\StatsController;
use App\Http\Controllers\Api\TicketScanController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VoteController;
use App\Http\Controllers\PublicMediaController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register'])->middleware('throttle:login');
    Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('admin-login', [AuthController::class, 'adminLogin'])->middleware('throttle:login');
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout'])->name('auth.logout');
        Route::get('me', [AuthController::class, 'me'])->name('auth.me');
        Route::post('change-password', [AuthController::class, 'changePassword'])->name('auth.change-password');
    });
});

// Aliases for SPA expectations
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('admin/login', [AuthController::class, 'adminLogin'])->middleware('throttle:login');
Route::middleware('auth:sanctum')->group(function () {
    Route::post('logout', [AuthController::class, 'logout']);
    Route::get('me', [AuthController::class, 'me']);
});

// Public data
Route::prefix('public')->middleware('throttle:public-read')->group(function () {
    Route::get('init-data', [PublicInitController::class, 'show']);
    Route::get('last-update', [PublicInitController::class, 'lastUpdate']);
    Route::get('candidates', [PublicCandidateController::class, 'index']);
    Route::get('candidates/{identifier}', [PublicCandidateController::class, 'show']);
    Route::get('media/{path}', [PublicMediaController::class, 'show'])->where('path', '.*');
    Route::get('stats', [StatsController::class, 'publicStats']);
    Route::get('gallery', [GalleryController::class, 'publicIndex']);
    Route::get('partners', [PartnerController::class, 'publicIndex']);
    Route::get('social-projects', [SocialProjectController::class, 'publicIndex']);
});

// Legacy public endpoints (kept for compatibility)
Route::get('candidates', [CandidateController::class, 'index'])->middleware('throttle:public-read');
Route::get('candidates/{candidate}', [CandidateController::class, 'show'])->middleware('throttle:public-read');
Route::post('votes', [VoteController::class, 'store'])->middleware('throttle:60,1');
Route::post('contact', [ContactController::class, 'store'])->middleware('throttle:5,1');

Route::middleware(['auth:sanctum', 'force_password_change'])->group(function () {
    Route::get('payments/{payment}', [PaymentController::class, 'show']);
    Route::get('profile', [UserController::class, 'profile']);
});

Route::post('payment/webhook', [PaymentController::class, 'webhook'])->middleware('throttle:webhook-fedapay');
Route::middleware(['auth:sanctum', 'throttle:30,1'])->get('payments/{reference}/sync', [PaymentController::class, 'sync']);
Route::get('public/payments/{reference}/sync', [PaymentController::class, 'syncPublic'])->middleware('throttle:10,1');

// J'y serai - public routes
Route::prefix('j-ierai')->middleware('throttle:public-read')->group(function () {
    Route::get('init', [JSeraiController::class, 'init']);
    Route::post('tickets', [JSeraiController::class, 'store'])->middleware('throttle:5,1');
    Route::put('tickets/{ticket}', [JSeraiController::class, 'update']);
    Route::post('tickets/{ticket}/photo', [JSeraiController::class, 'uploadPhoto']);
    Route::post('tickets/{ticket}/generate', [JSeraiController::class, 'regenerate']);
    Route::get('tickets/{ticket}', [JSeraiController::class, 'show']);
    Route::post('tickets/{ticket}/download', [JSeraiController::class, 'download']);
    Route::get('tickets/{ticket}/poster', [JSeraiController::class, 'servePoster']);
});

// Billetterie - public routes
Route::prefix('billetterie')->middleware('throttle:public-read')->group(function () {
    Route::get('events', [BilletterieController::class, 'events']);
    Route::get('events/{event:uuid}', [BilletterieController::class, 'showEvent']);
    Route::get('verify/{ticketCode}', [BilletterieController::class, 'verifyTicket']);
    Route::get('order/{paymentReference}', [BilletterieController::class, 'orderPublic'])->middleware('throttle:30,1');
    Route::post('order/{paymentReference}/resend-email', [BilletterieController::class, 'resendEmail'])->middleware('throttle:5,1');
    Route::post('orders', [BilletterieController::class, 'order'])->middleware('throttle:10,1');
});

Route::middleware(['auth:sanctum', 'force_password_change'])->prefix('billetterie')->group(function () {
    Route::get('orders/{orderId}', [BilletterieController::class, 'orderDetail']);
    Route::get('mes-billets', [BilletterieController::class, 'myTickets']);
});

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
    Route::get('export-classement-pdf', [ClassementExportController::class, '__invoke']);
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
    Route::get('social-projects', [SocialProjectController::class, 'adminIndex']);
    Route::get('social-projects/available-candidates', [SocialProjectController::class, 'availableCandidates']);
    Route::post('social-projects', [SocialProjectController::class, 'store']);
    Route::get('social-projects/{socialProject}', [SocialProjectController::class, 'show']);
    Route::put('social-projects/{socialProject}', [SocialProjectController::class, 'update']);
    Route::delete('social-projects/{socialProject}', [SocialProjectController::class, 'destroy']);
    Route::post('social-projects/{socialProject}/candidate-photo', [SocialProjectController::class, 'uploadCandidatePhoto']);
    Route::delete('social-projects/{socialProject}/candidate-photo', [SocialProjectController::class, 'deleteCandidatePhoto']);

    // J'y serai - admin management
    Route::get('j-ierai/templates', [JSeraiAdminController::class, 'templates']);
    Route::post('j-ierai/templates', [JSeraiAdminController::class, 'storeTemplate']);
    Route::put('j-ierai/templates/{template}', [JSeraiAdminController::class, 'updateTemplate']);
    Route::delete('j-ierai/templates/{template}', [JSeraiAdminController::class, 'destroyTemplate']);
    Route::patch('j-ierai/templates/{template}/activate', [JSeraiAdminController::class, 'activateTemplate']);
    Route::get('j-ierai/stats', [JSeraiAdminController::class, 'stats']);
    Route::get('j-ierai/tickets', [JSeraiAdminController::class, 'tickets']);
    Route::get('j-ierai/tickets/{uuid}', [JSeraiAdminController::class, 'showTicket']);
    Route::get('j-ierai/tickets/{uuid}/download', [JSeraiAdminController::class, 'downloadTicket']);
    Route::delete('j-ierai/tickets/{uuid}', [JSeraiAdminController::class, 'deleteTicket']);

    // Billetterie - admin management
    Route::get('billetterie/events', [AdminBilletterieController::class, 'index']);
    Route::post('billetterie/events', [AdminBilletterieController::class, 'store']);
    Route::get('billetterie/events/{event:uuid}', [AdminBilletterieController::class, 'show']);
    Route::put('billetterie/events/{event:uuid}', [AdminBilletterieController::class, 'update']);
    Route::delete('billetterie/events/{event:uuid}', [AdminBilletterieController::class, 'destroy']);
    Route::post('billetterie/events/{event:uuid}/ticket-types', [AdminBilletterieController::class, 'storeTicketType']);
    Route::put('billetterie/events/{event:uuid}/ticket-types/{typeId}', [AdminBilletterieController::class, 'updateTicketType']);
    Route::delete('billetterie/events/{event:uuid}/ticket-types/{typeId}', [AdminBilletterieController::class, 'destroyTicketType']);
    Route::get('billetterie/orders', [AdminBilletterieController::class, 'orders']);
    Route::get('billetterie/orders/export', [AdminBilletterieController::class, 'exportOrders']);
    Route::post('billetterie/checkin', [AdminBilletterieController::class, 'checkin']);
    Route::get('billetterie/stats', [AdminBilletterieController::class, 'stats']);
    Route::post('billetterie/events/{event:uuid}/ticket-types/{typeId}/template', [AdminBilletterieController::class, 'uploadTicketTemplate']);

    // Ticket scan (QR code verification + confirmation)
    Route::post('ticket-scan/validate', [TicketScanController::class, 'validateTicket'])->middleware('throttle:60,1');
    Route::post('ticket-scan/verify', [TicketScanController::class, 'verify'])->middleware('throttle:60,1');
});

Route::middleware(['auth:sanctum', 'force_password_change', 'role:candidate'])->group(function () {
    Route::get('candidate/dashboard', [CandidateController::class, 'dashboard']);
});

Route::middleware(['auth:sanctum', 'force_password_change', 'role:user'])->group(function () {
    Route::get('user/dashboard', [UserController::class, 'dashboard']);
});

// Public settings (dates, toggles, price, etc.)
Route::get('public/settings', [SettingsController::class, 'public'])->middleware('throttle:public-read');

// Lightweight JSON probe to verify that the API stack returns a valid payload.
Route::get('test', function () {
    return response()->json([
        'ok' => true,
        'service' => 'miss-and-mister-api',
        'timestamp' => now()->toIso8601String(),
    ]);
})->middleware('throttle:public-read');
