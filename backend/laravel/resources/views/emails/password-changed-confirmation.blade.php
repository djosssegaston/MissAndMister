<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mot de passe modifie</title>
</head>
<body style="margin:0;padding:0;background:#070707;color:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:linear-gradient(180deg,#121212,#090909);border:1px solid rgba(212,175,55,.25);border-radius:20px;padding:32px;">
            <p style="margin:0 0 12px;color:#d4af37;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Miss & Mister University Benin</p>
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#ffffff;">Mot de passe mis a jour</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d7d7d7;">
                Bonjour {{ $user->name }}, nous vous confirmons que le mot de passe de votre compte a bien ete modifie.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#d7d7d7;">
                Pour votre securite, nous ne transmettons jamais le nouveau mot de passe par email.
            </p>
            <p style="margin:0 0 24px;">
                <a href="{{ $loginUrl }}" style="display:inline-block;padding:14px 22px;background:#d4af37;color:#111111;text-decoration:none;font-weight:700;border-radius:10px;">Se connecter</a>
            </p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#b7b7b7;">
                Si vous n'etes pas a l'origine de cette modification, contactez immediatement l'administration du concours.
            </p>
        </div>
    </div>
</body>
</html>
