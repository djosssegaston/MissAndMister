# Deploiement Vercel + LWS

Ce projet peut etre deploye avec :

- `frontend/missandmisterfront` sur `Vercel`
- `backend/laravel` sur `LWS`
- `MySQL` sur `LWS`
- medias en stockage local sur `LWS`

## 1. Frontend sur Vercel

Racine du projet Vercel :

- `frontend/missandmisterfront`

Variables d'environnement a definir sur Vercel :

- `VITE_API_URL=https://api.votre-domaine.com/api`
- `VITE_API_TIMEOUT_MS=15000`
- `VITE_MAX_VIDEO_UPLOAD_MB=100`

Le fichier `vercel.json` du frontend gere :

- le build `Vite`
- la sortie `dist`
- la rewrite SPA vers `index.html`

## 2. Backend Laravel sur LWS

Le backend doit etre deploye depuis :

- `backend/laravel`

### Points importants

- le dossier public a exposer est `backend/laravel/public`
- si LWS ne permet pas de pointer directement le domaine vers `public`, le fichier `.htaccess` a la racine Laravel redirige vers `public/`
- apres deploiement, il faut executer :

```bash
php artisan key:generate --show
php artisan migrate --force
php artisan storage:link
php artisan app:bootstrap-production --ansi
php artisan config:clear
php artisan cache:clear
```

### Variables d'environnement minimales

Voir le fichier :

- `backend/laravel/.env.lws.example`

Les variables sensibles a renseigner manuellement :

- `APP_KEY`
- `DB_HOST`
- `DB_PORT`
- `DB_DATABASE`
- `DB_USERNAME`
- `DB_PASSWORD`
- `FEDAPAY_PUBLIC_KEY`
- `FEDAPAY_SECRET_KEY`
- `FEDAPAY_WEBHOOK_SECRET`
- `PROD_ADMIN_PASSWORD`
- `STAFF_ADMIN_PASSWORD`

### Cron recommande

Si tu veux garder les taches Laravel disponibles sur LWS :

```bash
php /chemin/vers/backend/laravel/artisan schedule:run >> /dev/null 2>&1
```

Frequence recommandee :

- toutes les 5 minutes

## 3. Medias locaux sur LWS

Ce projet sait deja fonctionner avec des medias locaux.

Reglages recommandes :

- `MEDIA_DRIVER=local`
- `FILESYSTEM_DISK=public`
- `CANDIDATE_IMAGE_DISK=public`

Les chemins locaux publics utilises sont ensuite exposes via :

- `/storage/...`

### Attention

Avec jusqu'a `170` candidats, les videos locales peuvent rapidement alourdir :

- l'espace disque
- les sauvegardes
- le temps d'upload
- la bande passante

Pour limiter les ralentissements :

- garder des videos courtes
- rester en `mp4`
- compresser avant upload
- surveiller la taille du dossier `storage/app/public/candidates/videos`

## 4. FedaPay

A mettre a jour apres migration :

- URL frontend
- URL backend
- URL callback
- URL webhook

Webhook backend attendu :

```text
https://api.votre-domaine.com/api/payment/webhook
```

## 5. Architecture recommandee

- `www.votre-domaine.com` -> Vercel frontend
- `api.votre-domaine.com` -> LWS backend Laravel

Cette separation est la plus propre pour :

- CORS
- FedaPay
- evolution future
- maintenance du projet
