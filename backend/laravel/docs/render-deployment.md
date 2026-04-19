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
- `FEDAPAY_PUBLIC_KEY`
- `FEDAPAY_SECRET_KEY`
- `FEDAPAY_WEBHOOK_SECRET`
- `FEDAPAY_ENVIRONMENT`
- `FEDAPAY_READ_MODEL_WARM_ENABLED`

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
- Les paiements FedaPay restent inactifs tant que les clés publiques, secrètes et de webhook ne sont pas fournies.
- Les clés FedaPay sont désormais gérées uniquement côté serveur via `.env` / Render, plus via le dashboard admin.
- En production mutualisée ou lente, laissez `FEDAPAY_READ_MODEL_WARM_ENABLED=false` pour éviter de lancer des réconciliations FedaPay pendant les requêtes HTTP normales.
