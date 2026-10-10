# Site de la maison de Croÿ

Site familial de la maison de Croÿ (prononcer « croui ») : raconter l’histoire, se repérer dans l’arbre, enrichir le contenu avec la famille.
Public : la famille, de l’adolescent au grand-parent, surtout sur téléphone.

**Le cahier des charges complet fait foi : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).** Relis la section concernée avant chaque étape.

@AGENTS.md

## Règles absolues

1. **Le site est livré vide : tout le contenu est écrit par la famille**, depuis le dashboard. N’écris aucun texte historique, biographie ni anecdote, ne reprends rien de Wikipédia ni d’ailleurs. La section 2 du cahier des charges sert seulement à comprendre le sujet et à dimensionner le design : rien n’en est publié. Pour tester, un jeu de démonstration **visiblement fictif** (famille « Exemple »), signalé par un bandeau et supprimable en un clic. Chaque page reste belle vide (invitation à contribuer, jamais de texte de remplissage).
2. **Vie privée** : une personne vivante n’est jamais visible du public ni des moteurs de recherche (« Personne vivante », sans nom ni date). La règle est appliquée **dans la base** (RLS), pas seulement dans l’interface.
3. **Rien ne se publie sans validation** d’un administrateur. Tout changement est journalisé et réversible.
4. **Une étape à la fois** (section 8). Avant : un court plan. Après : vérifier le critère « terminé quand », commit, montrer le résultat, bilan. Depuis le 10 octobre 2026, Baudouin autorise à **enchaîner les étapes sans attendre sa validation** (un commit poussé et un bilan par étape) ; ne s’arrêter que pour ce qui exige les fichiers, les clés ou une décision de la famille.
5. Pose une question plutôt que de supposer, surtout sur le contenu historique.

## Avancement (section 8)

- [x] 1. Fondations : Next.js, TypeScript, Tailwind, i18n, lint, tests, CI
- [x] 2. Système de design (page `/fr/style`, clair et sombre, mobile et ordinateur)
- [x] 3. Base de données et sécurité (migrations, RLS, tests vie privée)
- [x] 4. Outils de saisie et jeu de démonstration fictif (assistant de démarrage, saisie dans l’arbre, import GEDCOM)
- [x] 5. Page d’accueil (direction A, ouverture, chapitres sur la carte, titres, anecdotes, portes d’entrée)
- [ ] 6. Arbre généalogique
- [ ] 7. Armoiries et branches
- [ ] 8. Histoires, puis page Photos (section 6.5)
- [ ] 9. Lieux et événements
- [ ] 10. Comptes famille et contributions
- [ ] 11. Dashboard administrateur
- [ ] 12. Traductions, finitions, mise en ligne

## Décisions de la famille (10 octobre 2026)

- **Écran d’ouverture : direction A « Monument »** (prototype `docs/prototypes/ouverture.html`) : écu et nom centrés. Titres en **Bodoni Moda**, texte en **Atkinson Hyperlegible Next**.
- **Base de données : Postgres local d’abord**, migrations compatibles Supabase dans `supabase/migrations`. Le projet Supabase sera créé plus tard.
- **Vie privée** : une personne est traitée comme vivante (invisible du public) tant qu’elle n’a ni date de décès ni case « décédée » cochée, **sauf si elle est née il y a plus de 100 ans**.
- **Premier administrateur** : l’adresse est dans la variable d’environnement `ADMIN_EMAILS`, jamais dans le code.
- **Accroche par défaut** sous le nom : « Neuf siècles d’une famille européenne » et « se prononce croui » (mots de la famille, modifiables dans le dashboard).
- **Armoiries dessinées pour le projet** : Croÿ, Croÿ-Renty et Hongrie ancienne (Árpád, fascé de gueules et d’argent de huit pièces) ; la famille peut les remplacer par ses fichiers.
- **Ascendance hongroise** : le site assume la position de la famille, chaque maillon affiche sa preuve, le débat historique est mentionné en une phrase. Ne jamais écrire la lignée soi-même.
- **Pas encore de nom de domaine** : adresse provisoire jusqu’à l’étape 12.
- man8rove.com (inspiration pour l’arbre) est bloqué depuis le conteneur : attendre les captures annotées de la famille.

## Commandes

```bash
npm run dev          # serveur de développement, http://localhost:3000 (redirige vers /fr)
npm run check        # lint + types + format + tests unitaires : à lancer avant chaque commit
npm run build        # build de production
npm run test:e2e     # tests Playwright (380 px et 1440 px) sur le build de production
npm run format       # formate tout le code
npm run test:db      # règles d’accès et vie privée, sur un vrai Postgres (TEST_DATABASE_URL)
npm run db:reset     # local seulement : recrée la base de DATABASE_URL depuis les migrations
npm run db:migrate   # applique les migrations manquantes
```

Postgres local dans le conteneur : `pg_ctlcluster 16 main start` (utilisateur `postgres`, mot de passe `postgres`).

Dans un conteneur où Chromium est déjà installé (sans `playwright install`) :
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.

Tests de bout en bout avec la base (comme la CI) : exporter `DATABASE_URL` (locale), `ADMIN_EMAILS=admin@example.org`, `AUTH_DEV_LINKS=on`, `AUTH_LINKS_PER_HOUR=1000`, `E2E_RESET_DATABASE=on`, `NEXT_PUBLIC_SITE_URL=http://localhost:3100`, puis `npm run build` et `npm run test:e2e`. La base est remise à zéro au début.

## Pile technique

Next.js 16 (App Router, Turbopack, `proxy.ts` remplace `middleware.ts`) · React 19 · TypeScript strict · Tailwind CSS 4 (configuration en CSS, `app/globals.css`) · next-intl 4 · Vitest · Playwright + axe · ESLint · Prettier.
À venir : Supabase (Postgres, lien magique, stockage, RLS), Motion et GSAP ScrollTrigger, D3 (arbre), MapLibre GL (carte), Resend (e-mails), Vercel (hébergement, région `cdg1`).

Next.js 16 diffère de ce que tu connais peut-être : lis le guide concerné dans `node_modules/next/dist/docs/` avant d’utiliser une API.

## Organisation du code

```
app/
  [locale]/            layout racine réel (<html lang>), une page par langue
    (public)/          accueil, arbre, armoiries, branches, titres, histoires,
                       photos, lieux-et-evenements, recherche, contribuer
    (public)/connexion connexion par lien magique
    (membre)/compte    espace membre
    (admin)/admin      tableau de bord
  layout.tsx           simple passe-plat ; not-found.tsx = 404 de dernier recours
components/ui/         composants de base : bouton, carte, pastille, champ, panneau
                       latéral, menu, pied de page, transition, état vide, terme expliqué
components/heraldique/ écus en SVG (Croÿ, Croÿ-Renty, Hongrie ancienne, écu vide)
lib/design/            polices, palette, contrastes
lib/i18n/              langues, adresses traduites, navigation, chargement des textes
lib/site.ts            URL publique, indexation
lib/db/                accès à Postgres sous le rôle du visiteur (withViewer)
lib/auth/              sessions, liens de connexion, droits
lib/data/              requêtes par sujet (famille, lieux, tableau de bord)
lib/genealogie/        dates floues, noms, règle des vivants, GEDCOM
lib/demo/              famille « Exemple » fictive
components/admin/      écrans du tableau de bord
supabase/migrations/   schéma, règles d’accès (RLS), journal
scripts/db.mjs         applique les migrations
messages/              fr.json, en.json, de.json : textes de l’interface
docs/                  cahier des charges
tests/unit, tests/e2e, tests/db (vie privée, sur Postgres)
proxy.ts               détection de langue et préfixe /fr /en /de
```

## Conventions

- **Langues** : `fr` (référence, par défaut), `en`, `de`. Toutes les adresses sont préfixées.
  Les noms de dossiers sous `app/[locale]` sont les adresses françaises ; leurs traductions sont dans `lib/i18n/routing.ts` (`/fr/arbre`, `/en/family-tree`, `/de/stammbaum`). Ajouter toute nouvelle page dans `pathnames`.
- **Liens et navigation** : toujours `Link`, `redirect`, `useRouter`… de `@/lib/i18n/navigation`, jamais de `next/link` sous `app/[locale]`.
- **Pages et layouts** : première ligne `const locale = await resolveLocale(params);` (`lib/i18n/server.ts`) pour valider la langue et permettre le rendu statique.
- **Deux sortes de textes** : l’interface (menus, boutons) dans `messages/*.json`, avec les mêmes clés dans les trois langues (un test le vérifie) ; les contenus (biographies, histoires) dans la base, modifiables depuis le dashboard. Une clé manquante retombe sur le français.
- **Typographie française** : apostrophe typographique `’`, guillemets « » avec espaces insécables, espace fine insécable avant `; : ! ?`. Allemand : „ “.
- **Ton** : narratif, direct, chaleureux, vouvoiement simple. Pas de majuscules partout ni de latin décoratif. Une légende est présentée comme une légende ; une date incertaine porte « vers ».
- **Code** : identifiants et commentaires en anglais ; commentaires rares, pour le _pourquoi_. Messages de commit en anglais, à l’impératif.
- **Traductions EN/DE** : tout texte traduit par l’IA reste « à relire » par la famille (y compris les segments d’adresse).

## Base de données (étape 3)

- Migrations SQL dans `supabase/migrations` (une par changement, jamais modifiée une fois poussée). `supabase/local/bootstrap.sql` recrée en local ce que Supabase fournit (rôles `anon`, `authenticated`, `service_role`, `auth.uid()`).
- **Chaque requête du site passe par `withViewer()` (`lib/db`)** : transaction sous le rôle `anon` (visiteur) ou `authenticated` (compte), donc les règles RLS s’appliquent. `withSystem()` (rôle propriétaire) seulement pour les tâches techniques, jamais pour lire un contenu affiché.
- Règle des vivants : `app.is_living()`. Le public ne voit ni la personne, ni ses liens, photos, histoires, événements, sources ou titres. Dans l’arbre public, `public.tree_people()` la rend « Personne vivante » (id et branche seulement).
- Membres : lisent tout ce qui est publié (vivants compris), écrivent leurs brouillons d’histoires, leurs photos en attente et leurs propositions. Administrateurs : tout. Un compte désactivé redevient visiteur.
- Toute écriture passe dans `audit_log` (qui, quoi, avant, après) par trigger.
- Comptes, sessions et liens de connexion dans le schéma `private`, illisible par le site. Les comptes sont gérés par le site (lien magique envoyé par Resend), pas par Supabase Auth : tout reste testable en local ; Supabase héberge Postgres et les fichiers.
- Toute nouvelle table : RLS activée, politique explicite, test dans `tests/db`.

## Comptes et tableau de bord (étape 4, complétés à l’étape 10)

- Connexion par lien magique : `/fr/connexion` → e-mail (Resend) → `/fr/connexion/confirmer` → un clic (les antivirus qui ouvrent les liens ne les consomment pas). Session dans un cookie httpOnly, haché en base.
- Peut recevoir un lien : `ADMIN_EMAILS`, un membre actif, une invitation, une demande d’accès approuvée. La réponse est la même pour une adresse inconnue.
- Sans `RESEND_API_KEY`, en local ou en test avec `AUTH_DEV_LINKS=on`, le lien s’affiche à l’écran ; jamais sur Vercel.
- Trois niveaux : `proxy.ts` (cookie absent → connexion), `requireAdmin()` / `requireMember()` côté serveur, RLS en base.
- Tableau de bord `/fr/admin` : assistant de démarrage, saisie de l’arbre (une personne au centre, « + » parent, conjoint, enfant), import GEDCOM (analyse puis import), données de démonstration.
- Jeu de démonstration : `lib/demo/dataset.ts`, famille « Exemple » visiblement fictive, `is_demo` partout, bandeau sur chaque page, suppression en un clic.
- Formulaires : `useFormAction()` (`lib/hooks`) garde la saisie quand le serveur renvoie une erreur.
- Dates floues : `lib/genealogie/dates.ts` lit « 1890 », « vers 1890 », « 12 mars 1890 », « um 1890 », les dates GEDCOM, et les écrit dans chaque langue.

## Page d’accueil (étape 5)

- Tout son contenu vient du tableau de bord (`/fr/admin/accueil`) : lignes sous le nom, résumé, chiffres (libres ou calculés par `public.home_counts()`), chapitres (avec prologue), anecdotes (histoires `anecdote = true`). Une rubrique vide n’apparaît pas.
- Ouverture : `components/accueil/opening.tsx`. Le script de `<head>` (`openingScript`) décide avant l’affichage ; `html.intro` masque la page, `html.intro-motion` joue. Moins de 3 s, une fois par session (`sessionStorage`), accélérée par un clic, fondu simple avec mouvement réduit. Les éléments marqués `data-intro-hide` (menu, bandeau) attendent la fin.
- Carte d’Europe : SVG statique `public/carte/europe.json` (Natural Earth, domaine public), généré par `node scripts/build-europe-map.mjs`, chargé à l’approche des chapitres ; projection côté serveur dans `lib/carte/project.ts`. Plus léger que MapLibre (réservé à la page Lieux).
- Les textes de contenu français passent par `typeset()` (`lib/typography.ts`) : espaces fines et guillemets corrects même si la famille tape des espaces ordinaires.
- Les tests de bout en bout tournent en mouvement réduit par défaut ; l’ouverture a ses propres tests (`home.spec.ts`).

## Système de design (étape 2)

- Jetons dans `app/globals.css` : couleurs sémantiques (`paper`, `paper-2`, `ink`, `ink-muted`, `hairline`, `croy`, `croy-deep`, `croy-text`), échelle de texte (`text-caption` à `text-monument`), `ease-out` / `ease-in-out` / `ease-drawer`, durées `--duration-press|fast|base|slow`, point de rupture `nav` (1360 px).
- Jamais de couleur en dur dans un composant : passer par les jetons, pour que le thème sombre suive. `croy-text` pour le petit texte rouge (le rouge Croÿ échoue sur fond encre).
- Thème : automatique, clair ou sombre (`data-theme` sur `<html>`, mémorisé dans le navigateur).
- La page `/fr/style` montre tout ; la mettre à jour quand un composant de base change.
- Les textes français suivent la typographie (espace fine insécable avant `; : ! ?`, insécables dans « ») : un test le vérifie.

## Identité visuelle (section 3)

- Deux couleurs seulement, celles du blason : blanc `#FFFFFF` (70 % de la surface) et rouge Croÿ `#C8102E` ; rouge profond `#8E0B20` ; encre `#141414` ; gris `#F4F4F2`. Mode sombre : fond encre, rouge identique.
- Contrastes : le rouge sur blanc passe (5,9:1), mais **le rouge sur encre échoue en petit corps (3,1:1)** ; le gris `#8A8A86` du cahier échoue sur blanc en petit corps (3,5:1) — d’où `--ink-muted: #5f5f5b`.
- Motif signature : les trois fasces (trois bandes rouges horizontales) ; le tréma du ÿ en deux points rouges.
- Titres : serif d’affichage contemporaine, jusqu’à 18 vw sur « Croÿ » (vérifier le glyphe ÿ). Texte : sans-serif lisible, 18 px min. sur ordinateur, 16 px sur mobile. Chiffres tabulaires.
- Mouvement : 200 à 600 ms, déclenché par une action ou le défilement ; respect strict de `prefers-reduced-motion` ; 60 i/s sur téléphone moyen.
- Interdits : parchemin, dorures, gothique, cadres ornés, sceaux, cuir, trois colonnes façon encyclopédie, carrousels automatiques. Une seule section entièrement rouge par page au maximum.
- Pour le design et les animations, utiliser les skills `apple-design`, `impeccable` et ceux d’animation (`animate`, `improve-animations`, `find-animation-opportunities`, `emil-design-eng`).

## Qualité attendue

Mobile d’abord · vérifier chaque page à 380 px et 1440 px dans un navigateur · navigation complète au clavier · pas de régression axe (tests e2e) · première page en moins de 2,5 s sur mobile · aucune clé secrète dans le code (voir `.env.example`) · tests pour tout ce qui touche aux droits d’accès et à la vie privée.

Indexation : désactivée partout tant que `SITE_INDEXING` ne vaut pas `on` (mise en ligne, étape 12). Les pages de personnes vivantes et l’espace membre restent toujours exclus.
