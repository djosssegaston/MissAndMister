<?php

namespace App\Services;

use App\Mail\CandidateInvitationMail;
use App\Models\Candidate;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class CandidateAccountService
{
    public function create(array $data): Candidate
    {
        return DB::transaction(function () use ($data) {
            $plainPassword = $data['password'];

            unset($data['password'], $data['password_confirmation']);

            if (!isset($data['public_number'])) {
                $next = Candidate::withTrashed()->max('public_number') ?? 0;
                $data['public_number'] = $next + 1;
            }

            $candidate = Candidate::create($data);

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

            $this->sendInvitationEmail($candidate, $user, $plainPassword);

            return $candidate->load(['category', 'user']);
        });
    }

    public function update(Candidate $candidate, array $data): Candidate
    {
        return DB::transaction(function () use ($candidate, $data) {
            $plainPassword = $data['password'] ?? null;
            $sendCredentials = false;

            unset($data['password'], $data['password_confirmation']);

            $candidate->update($data);

            $user = $candidate->user;
            if (!$user) {
                if (!$candidate->email || !$plainPassword) {
                    throw ValidationException::withMessages([
                        'email' => 'Un candidat doit avoir un email et un mot de passe temporaire pour recevoir son accès.',
                    ]);
                }

                $user = new User([
                    'candidate_id' => $candidate->id,
                    'role' => 'candidate',
                    'must_change_password' => true,
                ]);
                $sendCredentials = true;
            }

            $user->fill([
                'name' => trim($candidate->first_name . ' ' . $candidate->last_name),
                'email' => $candidate->email,
                'phone' => $candidate->phone,
                'status' => $candidate->is_active ? 'active' : 'inactive',
            ]);

            if ($plainPassword) {
                $user->password = Hash::make($plainPassword);
                $user->must_change_password = true;
                $sendCredentials = true;
                $user->tokens()->delete();
            }

            $user->save();

            if (!$candidate->is_active) {
                $user->tokens()->delete();
            }

            if ($sendCredentials && $plainPassword) {
                $this->sendInvitationEmail($candidate, $user, $plainPassword);
            }

            return $candidate->fresh(['category', 'user']);
        });
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

    private function loginUrl(): string
    {
        return rtrim((string) config('app.frontend_url'), '/') . '/login';
    }
}
