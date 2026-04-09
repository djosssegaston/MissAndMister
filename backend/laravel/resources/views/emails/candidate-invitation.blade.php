<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Acces candidat</title>
</head>
<body style="margin:0;padding:0;background:#070707;color:#f5f5f5;font-family:Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
        <div style="background:linear-gradient(180deg,#121212,#090909);border:1px solid rgba(212,175,55,.25);border-radius:20px;padding:32px;">
            <p style="margin:0 0 12px;color:#d4af37;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Miss & Mister University Benin</p>
            <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#ffffff;">Votre acces candidat est pret</h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#d7d7d7;">
                Bonjour {{ $user->name }}, votre profil candidat a ete cree par l'administration.
            </p>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#d7d7d7;">
                Connectez-vous avec les informations ci-dessous puis changez obligatoirement votre mot de passe lors de votre premiere connexion.
            </p>

            <div style="background:#0f0f0f;border:1px solid rgba(212,175,55,.18);border-radius:16px;padding:18px 20px;margin:24px 0;">
                <p style="margin:0 0 10px;font-size:14px;color:#ffffff;"><strong>Candidat :</strong> {{ $candidate->first_name }} {{ $candidate->last_name }}</p>
                <p style="margin:0 0 10px;font-size:14px;color:#ffffff;"><strong>Email de connexion :</strong> {{ $user->email }}</p>
                <p style="margin:0;font-size:14px;color:#ffffff;"><strong>Mot de passe temporaire :</strong> {{ $temporaryPassword }}</p>
            </div>

            <p style="margin:0 0 24px;">
                <a href="{{ $loginUrl }}" style="display:inline-block;padding:14px 22px;background:#d4af37;color:#111111;text-decoration:none;font-weight:700;border-radius:10px;">Acceder au site</a>
            </p>

            <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#b7b7b7;">
                Pour des raisons de securite, ce mot de passe temporaire ne doit etre utilise qu'une seule fois.
            </p>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#b7b7b7;">
                Si vous n'etes pas a l'origine de cette creation de compte, contactez immediatement l'organisation.
            </p>
        </div>
    </div>
</body>
</html>
