<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Requests\ChangePasswordRequest;
use App\Mail\PasswordChangedConfirmationMail;
use App\Models\Admin;
use App\Models\ActivityLog;
use App\Repositories\UserRepository;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AuthController extends Controller
{
    public function __construct(private UserRepository $users)
    {
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $this->users->create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'role' => 'user',
            'password' => Hash::make($data['password']),
            'status' => 'active',
            'must_change_password' => false,
        ]);

        $token = $this->issueSingleSessionToken($user, 'auth_token', [$user->role]);
        $this->logSecurity($user, 'login_success', ['role' => $user->role]);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'candidate_id' => $user->candidate_id ?? null,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'must_change_password' => false,
            ],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        return $this->authenticate($request->validated());
    }

    public function adminLogin(LoginRequest $request): JsonResponse
    {
        $credentials = array_merge($request->validated(), ['scope' => 'admin']);

        return $this->authenticate($credentials);
    }

    public function logout(): JsonResponse
    {
        $user = request()->user();
        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
            $this->logSecurity($user, 'logout', []);
        }

        return response()->json(['message' => 'Logged out']);
    }

    public function me(): JsonResponse
    {
        $user = request()->user();
        return response()->json([
            'id' => $user->id,
            'candidate_id' => $user->candidate_id ?? null,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ?? 'user',
            'status' => $user->status ?? 'active',
            'must_change_password' => $user->must_change_password ?? false,
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (!Hash::check($request->input('current_password'), $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 422);
        }

        $user->password = Hash::make($request->input('password'));
        $user->must_change_password = false;
        $user->save();
        $user->tokens()->delete();

        $token = $user->createToken('auth_token', [$user->role ?? 'user'])->plainTextToken;

        $this->logSecurity($user, 'password_changed', ['guard' => $user->role ?? 'user']);

        try {
            if ($user->email) {
                Mail::to($user->email)->send(new PasswordChangedConfirmationMail(
                    user: $user,
                    loginUrl: rtrim((string) config('app.frontend_url'), '/') . '/login',
                ));
            }
        } catch (\Throwable $exception) {
            Log::warning('Password confirmation email failed', [
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $exception->getMessage(),
            ]);
        }

        return response()->json([
            'message' => 'Password updated successfully',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'candidate_id' => $user->candidate_id ?? null,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role ?? 'user',
                'status' => $user->status ?? 'active',
                'must_change_password' => false,
            ],
        ]);
    }

    private function logSecurity($user, string $action, array $meta = []): void
    {
        $payload = [
            'causer_id' => $user?->id,
            'causer_type' => $user ? get_class($user) : null,
            'action' => $action,
            'ip_address' => request()->ip(),
            'meta' => $meta,
            'status' => 'active',
        ];

        app()->terminating(static function () use ($payload): void {
            try {
                ActivityLog::create($payload);
            } catch (\Throwable $exception) {
                Log::warning('Security log write skipped', [
                    'action' => $payload['action'] ?? null,
                    'error' => $exception->getMessage(),
                ]);
            }
        });
    }

    private function issueSingleSessionToken(object $account, string $tokenName, array $abilities): string
    {
        $account->tokens()->delete();

        return $account->createToken($tokenName, $abilities)->plainTextToken;
    }

    private function authenticate(array $credentials): JsonResponse
    {
        $credentials['email'] = strtolower(trim((string) ($credentials['email'] ?? '')));
        $scope = $credentials['scope'] ?? 'user';

        if ($scope === 'admin') {
            $admin = Admin::where('email', $credentials['email'])->first();

            if (!$admin || !Hash::check($credentials['password'], $admin->password)) {
                $this->logSecurity($admin ?? new Admin(['id' => null, 'role' => 'admin']), 'login_failed', ['guard' => 'admin']);
                return response()->json(['message' => 'Invalid credentials'], 401);
            }

            if ($admin->status !== 'active') {
                return response()->json(['message' => 'Account inactive'], 403);
            }

            $abilities = $admin->role === 'superadmin' ? ['admin', 'superadmin'] : [$admin->role];
            $token = $this->issueSingleSessionToken($admin, 'admin_token', $abilities);
            $this->logSecurity($admin, 'login_success', ['guard' => 'admin']);

            return response()->json([
                'token' => $token,
                'user' => [
                    'id' => $admin->id,
                    'name' => $admin->name,
                    'email' => $admin->email,
                    'role' => $admin->role,
                ],
            ]);
        }

        $user = $this->users->findByEmail($credentials['email']);

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            $this->logSecurity($user ?? new Admin(['id' => null, 'role' => 'user']), 'login_failed', ['guard' => 'user']);
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'Account inactive'], 403);
        }

        $token = $this->issueSingleSessionToken($user, 'auth_token', [$user->role]);
        $this->logSecurity($user, 'login_success', ['role' => $user->role]);

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'candidate_id' => $user->candidate_id ?? null,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'must_change_password' => $user->must_change_password,
            ],
        ]);
    }
}
