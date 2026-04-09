# Upload Video Limits

Pour ce projet, le backend doit etre demarre avec des limites PHP plus hautes que la configuration CLI par defaut.

Commande recommandee:

```bash
composer serve
```

Cette commande lance directement le serveur PHP integre depuis `public/` avec:

- `upload_max_filesize=2048M`
- `post_max_size=2100M`
- `max_execution_time=3600`
- `max_input_time=3600`
- `memory_limit=512M`

Si vous utilisez toute la stack locale:

```bash
composer dev
```

La limite de video autorisee par l'application est de `2 Go max` par defaut.
Elle peut etre ajustee via `VIDEO_UPLOAD_MAX_MB` si vous avez besoin d'une autre valeur.

Si un ancien `php artisan serve` ou `php -S` tourne encore avec `2M` ou `10M`, arretez-le puis relancez le backend avec `composer serve` ou `composer dev`.

Si vous deployez derriere Nginx, ajoutez aussi une limite coherente dans la conf serveur, par exemple:

```nginx
client_max_body_size 2100M;
```

La base de donnees ne stocke pas la video elle-meme: elle conserve seulement le chemin du fichier. La taille maximale depend donc surtout de PHP, du serveur web et de l'espace disque disponible.
