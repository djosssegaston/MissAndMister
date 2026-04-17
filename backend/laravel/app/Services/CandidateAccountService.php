<?php

namespace App\Services;

use App\Mail\CandidateInvitationMail;
use App\Models\Candidate;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

class CandidateAccountService
{
    public function create(array $data): Candidate
    {
        $plainPassword = $this->normalizePlainPassword($data['password'] ?? null);
        $data['email'] = $this->normalizeNullableString($data['email'] ?? null);
        $data['phone'] = $this->normalizeNullableString($data['phone'] ?? null);

        [$candidate, $user, $plainPassword] = DB::transaction(function () use ($data) {
            $plainPassword = $this->normalizePlainPassword($data['password'] ?? null);

            unset($data['password'], $data['password_confirmation']);

            if (!isset($data['public_number'])) {
                $next = Candidate::withTrashed()->max('public_number') ?? 0;
                $data['public_number'] = $next + 1;
            }

            $candidate = Candidate::create($data);

            $user = null;

            if ($candidate->email && $plainPassword) {
                $user = User::create([
                    'candidate_id' => $candidate->id,
                    'name' => trim($candidate->first_name . ' ' . $candidate->last_name),
                    'email' => $candidate->email,
                    'phone' => $candidate->phone,
                    'password' => Hash::make($plainPassword),
                    'role' => 'candidate',
                    'status' => $candidate->is_active ? 'active' : 'inactive',
                    'must_change_password' => true,
                ]);
            }

            return [$candidate->load(['category', 'user']), $user, $plainPassword];
        });

        if ($user && $plainPassword) {
            $this->sendInvitationEmailSafely($candidate, $user, $plainPassword);
        }

        return $candidate;
    }

    public function update(Candidate $candidate, array $data): Candidate
    {
        if (array_key_exists('email', $data)) {
            $normalizedEmail = $this->normalizeNullableString($data['email']);
            if ($candidate->user && $normalizedEmail === null) {
                unset($data['email']);
            } else {
                $data['email'] = $normalizedEmail;
            }
        }

        if (array_key_exists('phone', $data)) {
            $data['phone'] = $this->normalizeNullableString($data['phone']);
        }

        [$updatedCandidate, $userToNotify, $passwordToSend] = DB::transaction(function () use ($candidate, $data) {
            $plainPassword = $this->normalizePlainPassword($data['password'] ?? null);
            $sendCredentials = false;

            unset($data['password'], $data['password_confirmation']);

            $candidate->update($data);

            $user = $candidate->user;
            if (!$user) {
                if ($candidate->email && $plainPassword) {
                    $user = new User([
                        'candidate_id' => $candidate->id,
                        'role' => 'candidate',
                        'must_change_password' => true,
                    ]);
                    $sendCredentials = true;
                }
            }

            if ($user) {
                $userPayload = [
                    'name' => trim($candidate->first_name . ' ' . $candidate->last_name),
                    'phone' => $candidate->phone,
                    'status' => $candidate->is_active ? 'active' : 'inactive',
                ];

                if ($candidate->email) {
                    $userPayload['email'] = $candidate->email;
                }

                $user->fill($userPayload);

                if ($plainPassword) {
                    $user->password = Hash::make($plainPassword);
                    $user->must_change_password = true;
                    $sendCredentials = true;
                    $user->tokens()->delete();
                }

                $user->save();
            }

            if ($user && !$candidate->is_active) {
                $user->tokens()->delete();
            }

            return [
                $candidate->fresh(['category', 'user']),
                $sendCredentials && $plainPassword ? $user : null,
                $sendCredentials ? $plainPassword : null,
            ];
        });

        if ($userToNotify && $passwordToSend) {
            $this->sendInvitationEmailSafely($updatedCandidate, $userToNotify, $passwordToSend);
        }

        return $updatedCandidate;
    }

    public function syncStatus(Candidate $candidate, bool $isActive): void
    {
        $candidate->is_active = $isActive;
        $candidate->status = $isActive ? 'active' : 'inactive';
        $candidate->save();

        $candidate->user()?->update([
            'status' => $isActive ? 'active' : 'inactive',
        ]);

        if (!$isActive) {
            $candidate->user?->tokens()->delete();
        }
    }

    public function deactivate(Candidate $candidate): void
    {
        $this->syncStatus($candidate, false);
    }

    private function sendInvitationEmail(Candidate $candidate, User $user, string $plainPassword): void
    {
        Mail::to($user->email)->send(new CandidateInvitationMail(
            candidate: $candidate,
            user: $user,
            temporaryPassword: $plainPassword,
            loginUrl: $this->loginUrl(),
        ));
    }

    private function sendInvitationEmailSafely(Candidate $candidate, User $user, string $plainPassword): void
    {
        try {
            $this->sendInvitationEmail($candidate, $user, $plainPassword);
        } catch (Throwable $exception) {
            Log::warning('Candidate invitation email failed', [
                'candidate_id' => $candidate->id,
                'user_id' => $user->id,
                'email' => $user->email,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function loginUrl(): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . '/login';
    }

    private function normalizeNullableString(mixed $value): ?string
    {
        $normalized = trim((string) ($value ?? ''));

        return $normalized !== '' ? $normalized : null;
    }

    private function normalizePlainPassword(mixed $value): ?string
    {
        $normalized = (string) ($value ?? '');

        return $normalized !== '' ? $normalized : null;
    }
}
