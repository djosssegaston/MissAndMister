# Deploiement Render Free

## Architecture retenue

- Frontend React/Vite en `Static Site`
- Backend Laravel en `Web Service` Docker
- `QUEUE_CONNECTION=sync`
- `CACHE_STORE=database`
- `SESSION_DRIVER=database`
- `MAIL_MAILER=log`
- Medias images/videos sur Cloudinary

## Fichiers prepares

- `render.yaml`
- `backend/laravel/Dockerfile`
- `backend/laravel/scripts/render-start.sh`

## Variables Render obligatoires

Ces variables sont deja referencees dans `render.yaml`, mais certaines doivent etre renseignees manuellement dans le dashboard Render :

- `DB_PASSWORD`
- `CLOUDINARY_URL`
- `PROD_ADMIN_PASSWORD`
- `KKIAPAY_PUBLIC_KEY`
- `KKIAPAY_PRIVATE_KEY`
- `KKIAPAY_SECRET`
- `KKIAPAY_WEBHOOK_SECRET`

## Base MySQL Railway retenue

Les variables publiques Railway utilisees pour Render sont :

```env
DB_CONNECTION=mysql
DB_HOST=trolley.proxy.rlwy.net
DB_PORT=28518
DB_DATABASE=railway
DB_USERNAME=root
DB_PASSWORD=... a renseigner dans Render
```

Ne pas utiliser l’hote interne Railway `mysql.railway.internal` depuis Render.

## Notes importantes

- Render Free ne permet pas les `Background Workers` ni les `Cron Jobs`.
- Les emails sont gardes en log pour ce premier deploiement.
- Les paiements Kkiapay restent en mode non finalise tant que les vraies cles ne sont pas fournies.
