<?php

use App\Http\Controllers\PaymentPageController;
use Illuminate\Support\Facades\Route;

Route::get('/payments/{reference}', [PaymentPageController::class, 'show'])->name('payments.show');

Route::get('/', function () {
    return view('welcome');
});
