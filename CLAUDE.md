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
- [x] 6. Arbre généalogique (vues, recherche, curseur du temps, filtres, lien de parenté, démonstration des lignées, fiche personne)
- [x] 7. Armoiries et branches (blason expliqué pas à pas, galerie et comparaison, rivière des branches, cartes, communes, page par branche)
- [x] 8. Histoires (magazine, lecture, écriture et validation), puis page Photos (mur, albums, visionneuse, envoi groupé, visages, propositions)
- [x] 9. Lieux et événements (carte MapLibre, frise, liaison dans les deux sens, lecture, page par lieu, saisie)
- [x] 10. Comptes famille et contributions (invitations, demandes d’accès, page Contribuer, propositions, espace membre, e-mails)
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

Next.js 16 (App Router, Turbopack, `proxy.ts` remplace `middleware.ts`) · React 19 · TypeScript strict · Tailwind CSS 4 (configuration en CSS, `app/globals.css`) · next-intl 4 · D3 (arbre) · MapLibre GL (carte) · sharp (images) · Vitest · Playwright + axe · ESLint · Prettier.
À venir : Supabase (Postgres, stockage), Resend (e-mails), Vercel (hébergement, région `cdg1`).

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

## Contributions et membres (étape 10)

- `/fr/contribuer` (statique) : explication en trois temps ; visiteur → demande d’accès (`access_requests`, e-mail aux administrateurs) ; membre → formulaire guidé en trois étapes (quoi, sur qui ou sur quoi, contenu avec source et pièces jointes). Photos et histoires renvoient à leurs propres formulaires. Le navigateur choisit le formulaire d’après le cookie `croy_membre`.
- Propositions : table `suggestions` ; sortes et contenu dans `lib/contributions/kinds.ts` (`correction`, `person`, `place`, `event`, `claim` = « C’est moi »). Pièces jointes : `POST /api/propositions/piece` → `media` en brouillon sous `propositions/`, visibles de l’auteur et des administrateurs seulement.
- E-mails : `lib/contributions/notify.ts` (aux administrateurs dans leur langue, confirmation au membre, décision avec le mot de l’administrateur, invitation et accès accepté avec un lien valable 7 jours). Chaque e-mail est consigné dans `private.emails` (jamais lisible par le site ; les jetons de connexion y sont masqués) : c’est là que les tests vérifient l’envoi.
- Espace membre `/fr/compte` : moi dans l’arbre (« C’est moi », ma place, mes ancêtres, ma branche), mes propositions avec leur état et la réponse, mon profil (nom, langue des e-mails).
- Tableau de bord : `/fr/admin/propositions` (file d’attente, détail, accepter ou refuser avec un mot ; accepter « C’est moi » relie le compte à la personne ; les autres propositions s’appliquent à la main dans l’écran concerné), `/fr/admin/membres` (demandes d’accès, invitations, rôles, désactivation ; un administrateur ne peut ni se rétrograder ni se désactiver). Les adresses viennent de `public.admin_members()`, réservée aux administrateurs.
- Tests : `tests/db/contributions.test.ts`, `tests/e2e/contribute.spec.ts` (le « terminé quand » : un membre propose une correction, l’administrateur reçoit l’e-mail).

## Page d’accueil (étape 5)

- Tout son contenu vient du tableau de bord (`/fr/admin/accueil`) : lignes sous le nom, résumé, chiffres (libres ou calculés par `public.home_counts()`), chapitres (avec prologue), anecdotes (histoires `anecdote = true`). Une rubrique vide n’apparaît pas.
- Ouverture : `components/accueil/opening.tsx`. Le script de `<head>` (`openingScript`) décide avant l’affichage ; `html.intro` masque la page, `html.intro-motion` joue. Moins de 3 s, une fois par session (`sessionStorage`), accélérée par un clic, fondu simple avec mouvement réduit. Les éléments marqués `data-intro-hide` (menu, bandeau) attendent la fin.
- Carte d’Europe : SVG statique `public/carte/europe.json` (Natural Earth, domaine public), généré par `node scripts/build-europe-map.mjs`, chargé à l’approche des chapitres ; projection côté serveur dans `lib/carte/project.ts`. Plus léger que MapLibre (réservé à la page Lieux).
- Les textes de contenu français passent par `typeset()` (`lib/typography.ts`) : espaces fines et guillemets corrects même si la famille tape des espaces ordinaires.
- Les tests de bout en bout tournent en mouvement réduit par défaut ; l’ouverture a ses propres tests (`home.spec.ts`).

## Arbre (étape 6)

- Page `/fr/arbre` statique ; l’arbre arrive en un fichier compact : `/api/arbre/{langue}` (public, sans les vivants, régénéré par `contentChanged()`) ou `/api/arbre/{langue}/membres` (membres, jamais en cache). Format : `lib/data/tree.ts` (personnes par index).
- Logique pure et testée : `lib/genealogie/layout.ts` (positions), `tree-model.ts` (recherche, curseur du temps, filtres, point de départ), `relationship.ts` (« Quel est le lien ? » en FR/EN/DE), `lib/search/normalize.ts` (Croÿ/Croy/Crouy, accents).
- Dessin : `components/arbre/tree-canvas.tsx` (SVG + d3-zoom, seules les cartes proches de l’écran sont dessinées, cartes réduites en vue lointaine, flèches du clavier). Page : `tree-app.tsx` ; l’état est dans l’adresse (`vue`, `depuis`, `personne`, `annee`, `lien`).
- Fiche : panneau latéral (non modal sur ordinateur) et page `/fr/arbre/[personne]`, construite d’avance pour le public ; un membre qui ouvre un vivant la charge dans le navigateur, jamais indexée.
- Points d’entrée et lignées à démontrer (certitude et preuves de chaque maillon) : `/fr/admin/lignees`. Une source qui touche un vivant reste invisible du public (RLS).
- Écus dans l’arbre : `<symbol>` par armoiries (`ShieldArt`) ; `exemple` et `exemple-modele` sont fictifs, réservés à la démonstration.
- Tests : `tests/e2e/tree.spec.ts` sert lui-même un arbre de 2 000 personnes (`syntheticTree`), indépendamment de la base.

## Armoiries et branches (étape 7)

- Page `/fr/armoiries` statique : blason expliqué pas à pas (`components/armoiries/blazon-explainer.tsx`, textes d’interface validés : Croÿ, Croÿ-Renty), galerie des armoiries de la famille et des familles alliées avec comparaison (différences calculées au pixel près, donc valables aussi pour les SVG déposés plus tard), rivière des branches (`lib/genealogie/river.ts`), une carte par branche (subsistantes puis éteintes) avec lien vers l’arbre, armoiries des communes.
- Page `/fr/branches/[branche]` : présentation, fondateur, dernier représentant, devenir des titres et des terres, personnes de la branche.
- Saisie : `/fr/admin/armoiries` (branches et armoiries, dessins intégrés ; dépôt de SVG à l’étape 8). Sortes d’armoiries : `family`, `alliance`, `commune`.
- Les armoiries propres à une personne vivante restent invisibles du public (RLS).
- Le contenu réel des branches (section 2) n’est jamais saisi par Claude : la famille l’entre ; le « terminé quand » est vérifié sur la famille « Exemple ».
- Composants communs du tableau de bord : `components/admin/admin-kit.tsx` (choix d’une personne dans l’arbre, traductions, sections, suppression).

## Histoires (étape 8a)

- `/fr/histoires` (magazine : une à la une, cartes de tailles variées, filtres personne, branche, époque, thème, langue d’origine) et `/fr/histoires/[histoire]` (lecture, personnes en marge avec leur fiche au survol, lieux et événements, histoires voisines). Pages statiques pour le public ; les membres reçoivent aussi les histoires qui citent des vivants (`/api/histoires/{langue}`, `/api/histoire/[slug]`).
- Écriture : `/fr/compte/histoires` (mes histoires), `/nouvelle`, `/[id]` ; brouillon puis « Envoyer pour validation » (`pending`). Publication par un administrateur : `/fr/admin/histoires`. La base refuse qu’un membre publie ou modifie une histoire publiée.
- Une histoire apparaît d’elle-même sur la fiche de chaque personne citée (`story_people`) : test en base et de bout en bout.
- Les tableaux d’énumérations Postgres reviennent en texte brut : les lire avec `::text[]`. Un même paramètre utilisé pour une énumération et une comparaison doit être typé (`$7::public.content_status`).

## Photos (étape 8b)

- Fichiers : `lib/storage` (dossier local `STORAGE_DIR`, `.data/fichiers` par défaut, ou Supabase Storage si `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`). Clés vérifiées par `isSafeKey`.
- Tout fichier passe par `/fichiers/[...chemin]` : la route lit la ligne `media` sous le rôle du visiteur (RLS), donc une photo en attente ou d’une personne vivante n’est jamais servie au public. `?l=` (160, 320, 640, 1280, 2048) renvoie une copie WebP redimensionnée, gardée dans `tailles/`.
- Envoi : `/fr/compte/photos` (plusieurs à la fois, allégées dans le navigateur, métadonnées retirées au serveur, 3 200 px max.) → `POST /api/photos/envoi`. Un membre envoie en attente ; un administrateur publie directement.
- `/fr/photos` : mur justifié (`lib/photos/justify.ts`), filtres, visages ; `/fr/photos/[photo]` (visionneuse, cadres des visages au survol des noms, « Qui est-ce ? », demande de retrait → `suggestions`) ; `/fr/photos/albums/[album]` et diaporama.
- Administration `/fr/admin/photos` : photos à valider, propositions de noms et demandes de retrait, albums ; `/fr/admin/photos/[photo]` : description et visages (glisser sur l’image pour entourer un visage).
- Une histoire peut porter des photos (`story_media`, la première sert de couverture).
- Démonstration : images dessinées par `lib/demo/photos.ts` (silhouettes, aucune vraie personne), supprimées avec leurs copies.

## Lieux et événements (étape 9)

- `/fr/lieux-et-evenements` : carte et frise côte à côte (carte en haut sur téléphone). Un lieu touché ouvre sa carte (photo, période, « se visite aujourd’hui », événements, personnes, histoires) et marque ses événements dans la frise des deux points rouges ; un événement fait voler la carte vers son lieu. Filtres siècle, branche, type ; onglet « Lieux » ; « Lecture » parcourt les événements datés dans l’ordre, les lieux s’allument un à un. L’état est dans l’adresse (`lieu`, `evenement`, `vue`).
- Carte : `components/carte/map-view.tsx` (MapLibre GL, chargé à la demande). Fond dessiné par nous, sans serveur de tuiles ni clé : `public/carte/fond.json` (1:50m) puis `fond-detail.json` (1:10m) au-delà du zoom 5, générés par `node scripts/build-map-background.mjs` (Natural Earth). Couleurs lues dans les jetons, thème sombre compris. Le conteneur de `MapView` doit être positionné.
- Logique pure et testée : `lib/carte/timeline.ts` (siècles, filtres, ordre de lecture), `lib/carte/coordinates.ts` (coordonnées collées depuis une carte en ligne).
- Données : `lib/data/places.ts` (`/api/lieux/{langue}` public et régénéré, `/api/lieux/{langue}/membres`, `/api/lieu/[slug]`). Un événement qui touche un vivant, ou un vivant lié à un lieu, reste réservé aux membres (RLS).
- `/fr/lieux/[lieu]` : description, visite, événements, personnes liées, nées et mortes sur place, histoires, photos (`media.place_id`), petite carte de situation.
- Saisie : `/fr/admin/lieux` (lieux placés d’un clic sur la carte ou par coordonnées collées, événements à date floue, personnes, branche). Aides communes des formulaires : `lib/admin/form.ts`.
- Tests : `tests/e2e/places.spec.ts` vérifie le « terminé quand » (Azincourt ↔ 1415) sur des données de test saisies par le tableau de bord.

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
