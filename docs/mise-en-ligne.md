# Mise en ligne

Ce qu’il reste à faire pour que le site soit en ligne sur son nom de domaine, avec une sauvegarde chaque nuit (étape 12, « terminé quand »).
Le code est prêt ; ces étapes demandent des comptes et des clés qui appartiennent à la famille.
Aucune clé ne doit être écrite dans le code ni envoyée par e-mail : elles se collent directement dans Vercel et GitHub.

## 1. Nom de domaine — décision de la famille

Choisir et acheter le nom (par exemple chez OVH, Gandi ou directement chez Vercel).
Il servira aussi à l’adresse d’envoi des e-mails (`site@le-domaine`).

## 2. Supabase : la base et les fichiers

1. Créer un projet sur [supabase.com](https://supabase.com), région **Paris (eu-west-3)** ou Francfort. Noter le mot de passe de la base dans un coffre.
2. _Storage_ → créer un bucket **privé** nommé `fichiers`.
3. Récupérer :
   - l’adresse **Transaction pooler** (port 6543) → `DATABASE_URL` pour Vercel, suivie de `?sslmode=require` ;
   - l’adresse **Direct** ou **Session pooler** (port 5432) → pour les migrations et la sauvegarde ;
   - _Project URL_ → `SUPABASE_URL` ; clé _service_role_ → `SUPABASE_SERVICE_ROLE_KEY`.
4. Créer les tables, depuis un ordinateur où le projet est installé :

   ```bash
   DATABASE_URL="<adresse directe>" npm run db:migrate
   ```

   Les règles de vie privée (RLS) sont dans ces migrations : rien d’autre à configurer.

## 3. Resend : les e-mails

1. Créer un compte sur [resend.com](https://resend.com), ajouter le domaine et copier chez le registraire les enregistrements DNS demandés (SPF, DKIM).
2. Créer une clé d’API → `RESEND_API_KEY`. Adresse d’envoi → `EMAIL_FROM`, par exemple `Maison de Croÿ <site@le-domaine>`.

## 4. Vercel : le site

1. Importer le dépôt GitHub dans [vercel.com](https://vercel.com). La région `cdg1` (Paris) est déjà fixée par `vercel.json`.
2. Variables d’environnement de **Production** :

   | Variable                    | Valeur                                                     |
   | --------------------------- | ---------------------------------------------------------- |
   | `NEXT_PUBLIC_SITE_URL`      | `https://le-domaine` (sans barre finale)                   |
   | `DATABASE_URL`              | adresse _Transaction pooler_ + `?sslmode=require`          |
   | `ADMIN_EMAILS`              | adresse(s) du ou des premiers administrateurs              |
   | `RESEND_API_KEY`            | clé Resend                                                 |
   | `EMAIL_FROM`                | adresse d’envoi                                            |
   | `SUPABASE_URL`              | adresse du projet                                          |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé _service_role_                                         |
   | `SUPABASE_BUCKET`           | `fichiers`                                                 |
   | `DEEPL_API_KEY`             | facultatif : traductions proposées (toujours « à relire ») |
   | `SITE_INDEXING`             | `off` jusqu’au jour de l’ouverture, puis `on`              |

   Ne jamais définir `AUTH_DEV_LINKS` sur Vercel.

3. _Settings_ → _Domains_ : ajouter le nom de domaine et suivre les instructions DNS.
4. Ouvrir `https://le-domaine/fr/connexion` avec l’adresse de `ADMIN_EMAILS` : le lien arrive par e-mail.

## 5. Sauvegarde de chaque nuit

Le dépôt contient déjà la tâche (`.github/workflows/backup.yml`). Elle attend deux secrets, dans GitHub → _Settings_ → _Secrets and variables_ → _Actions_ :

- `BACKUP_DATABASE_URL` : l’adresse **directe** ou _Session pooler_ de Supabase ;
- `BACKUP_PASSPHRASE` : une longue phrase secrète, gardée **hors de GitHub** par deux personnes de la famille. Sans elle, une sauvegarde est illisible, y compris pour vous.

Puis _Actions_ → _Sauvegarde_ → _Run workflow_ une première fois, et vérifier qu’une copie `croy-AAAA-MM-JJ.dump.gpg` apparaît dans le résultat. Chaque copie est gardée 35 jours.

La copie contient la base (personnes, textes, comptes, journal). Les photos elles-mêmes restent dans Supabase Storage : gardez aussi les originaux de votre côté. Le tableau de bord (_Import et export_) permet en plus de télécharger à tout moment l’arbre en GEDCOM et une sauvegarde complète en JSON.

### Restaurer une copie

```bash
gpg --decrypt croy-AAAA-MM-JJ.dump.gpg > croy.dump
pg_restore --clean --if-exists --no-owner --dbname "<adresse directe>" croy.dump
```

## 6. Le jour de l’ouverture

1. Dans le tableau de bord, _Démonstration_ → supprimer la famille « Exemple ».
2. Suivre le _Guide_ du tableau de bord (deux pages, imprimable).
3. Passer `SITE_INDEXING` à `on` dans Vercel et redéployer.

Le site est alors en ligne : les moteurs de recherche reçoivent le plan du site (`/sitemap.xml`), sans aucune personne vivante.
