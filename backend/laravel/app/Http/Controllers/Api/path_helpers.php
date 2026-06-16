<?php

if (! function_exists('alogoto_project_base_url')) {
    /**
     * Compute the base URL path for the Alogoto project.  The returned string
     * always ends in a slash and points at the project root or at the special
     * subfolder ("frontend" or "backend") if the current script lives below
     * it.  This avoids duplicating those segments when building more specific
     * URLs.
     */
    function alogoto_project_base_url(): string
    {
        $scriptName = isset($_SERVER['SCRIPT_NAME'])
            ? str_replace('\\', '/', (string) $_SERVER['SCRIPT_NAME'])
            : '';

        // directory containing the current script (no filename)
        $directory = str_replace('\\', '/', dirname($scriptName));

        // if we are running from inside the frontend or backend folder,
        // return the path up to and including that segment; otherwise use the
        // script directory itself.  Always keep a trailing slash.
        if (preg_match('#^(.*/(frontend|backend))/.*#', $directory, $m)) {
            return rtrim($m[1], '/').'/';
        }

        if ($directory === '' || $directory === '/' || $directory === '\\' || $directory === '.') {
            return '/';
        }

        return rtrim($directory, '/').'/';
    }

    /**
     * Helper for the project *root* URL.  This is the base path without any
     * `frontend` or `backend` suffix so that the specialised helpers do not
     * accidentally duplicate those segments.
     */
    function alogoto_project_root_url(): string
    {
        $base = alogoto_project_base_url();

        return preg_replace('#/(frontend|backend)/$#', '/', $base);
    }

    /**
     * Generic helper that appends a path to the project root URL.  The result
     * is an absolute path that begins with a slash.
     */
    function alogoto_url(string $path = ''): string
    {
        $cleanPath = ltrim(str_replace('\\', '/', $path), '/');
        $root = alogoto_project_root_url();

        return rtrim($root, '/').'/'.$cleanPath;
    }

    function frontend_public_url(string $path = ''): string
    {
        return alogoto_url('frontend/public/'.ltrim($path, '/'));
    }

    function frontend_public_asset(string $path = ''): string
    {
        return frontend_public_url('assets/'.ltrim($path, '/'));
    }

    function dashboard_url(string $path = ''): string
    {
        $cleanPath = ltrim(str_replace('\\', '/', $path), '/');
        if (function_exists('route')) {
            $routeMap = [
                'dashboard_admin.php' => 'dashboard.admin',
                'dashboard_porteur.php' => 'dashboard.porteur',
                'dashboard_institution.php' => 'dashboard.institution',
                'projets_admin.php' => 'admin.projects',
                'utilisateurs.php' => 'admin.users',
                'finance.php' => 'admin.finance',
                'litiges.php' => 'admin.disputes',
                'audit_logs.php' => 'admin.audit',
                'messages_admin.php' => 'admin.messages',
                'notifications_admin.php' => 'admin.notifications',
                'profil_admin.php' => 'admin.profile',
                'securite_admin.php' => 'admin.security',
                'parametres.php' => 'admin.settings',
                'mes_projets.php' => 'porteur.projects',
                'remboursements.php' => 'porteur.repayments',
                'notifications.php' => 'porteur.notifications',
                'messages.php' => 'porteur.messages',
                'profil.php' => 'porteur.profile',
                'securite.php' => 'porteur.security',
                'documents.php' => 'porteur.documents',
                'financement.php' => 'porteur.funding',
                'echeancier_remboursement.php' => 'porteur.schedule',
                'parcourir_projets.php' => 'institution.projects',
                'remboursements_institution.php' => 'institution.repayments',
                'notifications_institution.php' => 'institution.notifications',
                'messages_institution.php' => 'institution.messages',
                'profil_institution.php' => 'institution.profile',
                'securite_institution.php' => 'institution.security',
                'portfolio.php' => 'institution.portfolio',
                'analyse_risque.php' => 'institution.risk',
                'entretiens_planifies.php' => 'institution.interviews',
                'investissements.php' => 'institution.investments',
                'validation.php' => 'institution.validation',
            ];
            if (isset($routeMap[$cleanPath])) {
                return route($routeMap[$cleanPath]);
            }
        }

        return alogoto_url('frontend/dashboard/'.$cleanPath);
    }
    function dashboard_asset(string $path = ''): string
    {
        return dashboard_url('assets/'.ltrim($path, '/'));
    }

    function backend_url(string $path = ''): string
    {
        return alogoto_url('backend/public/'.ltrim($path, '/'));
    }
}
