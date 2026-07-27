<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForcePasswordChange
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        // Enforce for any non-admin account flagged for first-login password rotation
        if ($user && in_array($user->role ?? null, ['user', 'candidate'], true) && ($user->must_change_password ?? false)) {
            // Allow the user to reach the password change and logout/me endpoints
            if ($request->routeIs('auth.change-password', 'auth.logout', 'auth.me')
                || in_array($request->route()?->getActionMethod() ?? '', ['logout', 'me'], true)
                || $request->is('api/logout', 'api/auth/logout')
            ) {
                return $next($request);
            }

            return response()->json([
                'message' => 'Password change required',
            ], 403);
        }

        return $next($request);
    }
}
