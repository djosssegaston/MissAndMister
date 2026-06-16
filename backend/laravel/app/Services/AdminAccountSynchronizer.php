<?php

namespace App\Services;

use App\Models\Admin;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;

class AdminAccountSynchronizer
{
    public function syncDefinedAccounts(): Collection
    {
        return collect(config('admin.accounts', []))
            ->map(fn ($account) => $this->normalizeConfiguredAccount($account))
            ->filter()
            ->map(fn (array $account) => $this->syncAccount($account))
            ->values();
    }

    private function normalizeConfiguredAccount(mixed $account): ?array
    {
        if (! is_array($account)) {
            return null;
        }

        $email = strtolower(trim((string) ($account['email'] ?? '')));
        $password = (string) ($account['password'] ?? '');

        if ($email === '' || $password === '') {
            return null;
        }

        $role = trim((string) ($account['role'] ?? 'admin'));
        $status = trim((string) ($account['status'] ?? 'active'));

        return [
            'name' => trim((string) ($account['name'] ?? '')) ?: 'Admin',
            'email' => $email,
            'phone' => trim((string) ($account['phone'] ?? '')) ?: '0000000000',
            'password' => $password,
            'role' => in_array($role, ['admin', 'superadmin'], true) ? $role : 'admin',
            'status' => in_array($status, ['active', 'inactive'], true) ? $status : 'active',
        ];
    }

    private function syncAccount(array $account): Admin
    {
        /** @var Admin $admin */
        $admin = Admin::withTrashed()->firstOrNew([
            'email' => $account['email'],
        ]);

        $admin->name = $account['name'];
        $admin->phone = $account['phone'];
        $admin->role = $account['role'];
        $admin->status = $account['status'];

        if (($admin->deleted_at ?? null) !== null) {
            $admin->deleted_at = null;
        }

        if (! $admin->exists || ! Hash::check($account['password'], (string) $admin->password)) {
            $admin->password = Hash::make($account['password']);
        }

        if ($admin->isDirty()) {
            $admin->save();
        }

        return $admin;
    }
}
