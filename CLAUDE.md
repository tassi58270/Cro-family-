# Site de la maison de Croÿ

Site familial de la maison de Croÿ (prononcer « croui ») : raconter l’histoire, se repérer dans l’arbre, enrichir le contenu avec la famille.
Public : la famille, de l’adolescent au grand-parent, surtout sur téléphone.

**Le cahier des charges complet fait foi : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md).** Relis la section concernée avant chaque étape.

@AGENTS.md

## Règles absolues

1. **N’invente aucun fait** : ni personne, ni date, ni titre, ni blason, ni anecdote. Seuls les repères de la section 2 du cahier des charges servent de contenu de départ, au statut « à valider par la famille ». S’il manque une information, laisse un champ vide signalé.
2. **Vie privée** : une personne vivante n’est jamais visible du public ni des moteurs de recherche (« Personne vivante », sans nom ni date). La règle est appliquée **dans la base** (RLS), pas seulement dans l’interface.
3. **Rien ne se publie sans validation** d’un administrateur. Tout changement est journalisé et réversible.
4. **Une étape à la fois** (section 8). Avant : un court plan. Après : vérifier le critère « terminé quand », commit, montrer le résultat, bilan, puis **attendre la validation** avant l’étape suivante.
5. Pose une question plutôt que de supposer, surtout sur le contenu historique.

## Avancement (section 8)

- [x] 1. Fondations : Next.js, TypeScript, Tailwind, i18n, lint, tests, CI
- [ ] 2. Système de design (page « style », clair et sombre, mobile et ordinateur)
- [ ] 3. Base de données et sécurité (Supabase, RLS, tests vie privée)
- [ ] 4. Données de départ (≥ 15 personnes, 10 titres, 13 branches, 12 lieux, 4 anecdotes)
- [ ] 5. Page d’accueil (proposer d’abord deux directions pour l’écran d’ouverture)
- [ ] 6. Arbre généalogique
- [ ] 7. Armoiries et branches
- [ ] 8. Histoires
- [ ] 9. Lieux et événements
- [ ] 10. Comptes famille et contributions
- [ ] 11. Dashboard administrateur
- [ ] 12. Traductions, finitions, mise en ligne

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
                       lieux-et-evenements, recherche, contribuer
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
