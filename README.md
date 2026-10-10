# Maison de Croÿ

Le site de la famille : son histoire, son arbre généalogique, ses armoiries et ses lieux, en français, en anglais et en allemand.

- Cahier des charges : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md)
- Notes pour Claude Code et conventions : [`CLAUDE.md`](CLAUDE.md)

## Démarrer

Prérequis : Node.js 22 ou plus récent.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir http://localhost:3000 : le site redirige vers `/fr`, `/en` ou `/de` selon la langue du navigateur.

## Commandes utiles

| Commande           | Rôle                                                        |
| ------------------ | ----------------------------------------------------------- |
| `npm run dev`      | Serveur de développement                                    |
| `npm run check`    | Lint, types, format et tests unitaires                      |
| `npm run build`    | Build de production                                         |
| `npm run test:e2e` | Tests de bout en bout (mobile 380 px et ordinateur 1440 px) |
| `npm run format`   | Formater le code                                            |

Avant les tests de bout en bout, installer une fois le navigateur : `npx playwright install chromium`, puis `npm run build`.

## Intégration continue

Chaque envoi sur GitHub lance [`.github/workflows/ci.yml`](.github/workflows/ci.yml) : lint, types, format, tests unitaires, build et tests de bout en bout (dont un contrôle d’accessibilité automatique).

## Déploiement sur Vercel

1. Sur [vercel.com](https://vercel.com), « Add New… → Project », puis importer ce dépôt GitHub. Vercel reconnaît Next.js : aucun réglage de build n’est nécessaire.
2. Dans « Settings → Environment Variables », ajouter les variables de [`.env.example`](.env.example) si besoin. Laisser `SITE_INDEXING` absent ou à `off` jusqu’à la mise en ligne officielle.
3. Chaque branche et chaque pull request reçoit alors son propre lien de prévisualisation ; la branche principale part en production.

Les serveurs tournent à Paris (`cdg1`, voir [`vercel.json`](vercel.json)), au plus près de la famille.
