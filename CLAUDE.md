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
- [ ] 2. Système de design (page « style », clair et sombre, mobile et ordinateur)
- [ ] 3. Base de données et sécurité (Supabase, RLS, tests vie privée)
- [ ] 4. Outils de saisie et jeu de démonstration fictif (assistant de démarrage, saisie dans l’arbre)
- [ ] 5. Page d’accueil (proposer d’abord deux directions pour l’écran d’ouverture)
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
```

Dans un conteneur où Chromium est déjà installé (sans `playwright install`) :
`PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run test:e2e`.

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
    (membre)/compte    espace membre (à venir)
    (admin)/admin      dashboard (à venir)
    connexion/         (à venir)
  layout.tsx           simple passe-plat ; not-found.tsx = 404 de dernier recours
components/ui/         composants de base
lib/i18n/              langues, adresses traduites, navigation, chargement des textes
lib/site.ts            URL publique, indexation
messages/              fr.json, en.json, de.json : textes de l’interface
docs/                  cahier des charges
tests/unit, tests/e2e
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
