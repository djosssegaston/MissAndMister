<?php

namespace App\Providers;

use App\Contracts\CandidateFaceDetector;
use App\Services\CandidateImages\AwsRekognitionCandidateFaceDetector;
use App\Services\CandidateImages\NullCandidateFaceDetector;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiting\Limit;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(CandidateFaceDetector::class, function () {
            $provider = config('candidate_images.face_detection_provider', 'aws');

            return match ($provider) {
                'aws' => class_exists(\Aws\Rekognition\RekognitionClient::class)
                    ? new AwsRekognitionCandidateFaceDetector(config('services.rekognition', []))
                    : new NullCandidateFaceDetector('Le SDK AWS Rekognition n’est pas installe.'),
                'none' => new NullCandidateFaceDetector('La detection de visage est desactivee.'),
                default => new NullCandidateFaceDetector("Le provider de detection [{$provider}] n’est pas supporte."),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Définition des limiteurs de débit manquants
        RateLimiter::for('login', function (Request $request) {
            return [
                Limit::perMinute(5)->by($request->input('email').$request->ip()),
            ];
        });

        RateLimiter::for('api', function (Request $request) {
            return [
                Limit::perMinute(60)->by(optional($request->user())->id ?: $request->ip()),
            ];
        });
    }
}
