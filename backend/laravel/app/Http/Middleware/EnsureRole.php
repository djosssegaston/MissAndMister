<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $role = $user->role ?? null;
        $expectedRoles = !empty($roles) ? $roles : [$role];
        $roleAllowed = in_array($role, $expectedRoles, true)
            || ($role === 'superadmin' && in_array('admin', $expectedRoles, true));

        if (!$role || (!$roleAllowed && !empty($expectedRoles))) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // If the token carries abilities, ensure they include the role
        $token = $user->currentAccessToken();
        if ($token && !empty($token->abilities)) {
            $tokenAllows = !empty(array_intersect($token->abilities, $expectedRoles))
                || in_array('superadmin', $token->abilities, true);

            if (!$tokenAllows) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        return $next($request);
    }
}
