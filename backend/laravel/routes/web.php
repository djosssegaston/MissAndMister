<?php

use App\Http\Controllers\PaymentPageController;
use App\Http\Controllers\PublicMediaController;
use Illuminate\Support\Facades\Route;

Route::get('/payments/{reference}', [PaymentPageController::class, 'show'])->name('payments.show');
Route::match(['GET', 'POST'], '/payments/{reference}/callback', [PaymentPageController::class, 'callback'])->name('payments.callback');
Route::get('/storage/{path}', [PublicMediaController::class, 'show'])
    ->where('path', '.*')
    ->name('storage.public');

Route::get('/', function () {
    return view('welcome');
});
