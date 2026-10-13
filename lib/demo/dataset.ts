/**
 * The demonstration family « Exemple » (cahier des charges, step 4).
 *
 * Entirely fictional and meant to look it: invented names (Exemple, Modèle,
 * Essai, Témoin…), places marked « lieu fictif », texts that say they are
 * examples. It exercises every part of the site: six generations, living
 * people (shown to visitors as « Personne vivante »), remarriage-free and
 * unknown-parent cases, an extinct branch, titles and their holders, events,
 * stories and a source. Every row carries is_demo, so it goes in one click.
 */

type D = {
  date: string;
  precision: "day" | "month" | "year" | "about" | "before" | "after";
};
const day = (date: string): D => ({ date, precision: "day" });
const year = (y: number): D => ({ date: `${y}-01-01`, precision: "year" });
const about = (y: number): D => ({ date: `${y}-01-01`, precision: "about" });

export const demoPlaces = [
  {
    key: "exempleville",
    name: "Exempleville (lieu fictif)",
    lat: 49.95,
    lng: 2.3,
    kind: "town",
    country: "FR",
    visitable: false,
  },
  {
    key: "chateau",
    name: "Château d’Exemple (lieu fictif)",
    lat: 50.45,
    lng: 4.2,
    kind: "castle",
    country: "BE",
    visitable: true,
  },
  {
    key: "modelebourg",
    name: "Modèlebourg (lieu fictif)",
    lat: 51.85,
    lng: 7.25,
    kind: "town",
    country: "DE",
    visitable: false,
  },
  {
    key: "essai",
    name: "Essai-sur-Mer (lieu fictif)",
    lat: 48.65,
    lng: -2.0,
    kind: "town",
    country: "FR",
    visitable: false,
  },
] as const;

export const demoBranches = [
  {
    key: "ainee",
    name: "Branche aînée (exemple)",
    founder: "charles",
    state: "extant",
    color: "#c8102e",
    description:
      "Branche d’exemple issue de Charles Exemple. Elle sert à tester l’affichage des branches.",
  },
  {
    key: "cadette",
    name: "Branche cadette (exemple)",
    founder: "emile",
    state: "extinct",
    extinctMale: 1999,
    color: "#8a8a86",
    description:
      "Branche d’exemple éteinte en 1999, pour tester l’affichage des branches éteintes.",
    fate: "Exemple : le titre de baron de Modèlebourg s’éteint avec elle.",
    last: "gaston",
  },
  {
    key: "rameau",
    name: "Rameau d’Hélène (exemple)",
    founder: "helene",
    parent: "ainee",
    state: "extant",
    color: "#d94f66",
    description:
      "Rameau d’exemple, issu de la branche aînée, pour tester le schéma des branches.",
  },
] as const;

type DemoPerson = {
  key: string;
  given: string;
  surname: string;
  sex: "female" | "male";
  birth?: D;
  birthPlace?: string;
  death?: D;
  deathPlace?: string;
  branch?: string;
  originFamily?: string;
  bio?: string;
};

export const demoPeople: DemoPerson[] = [
  {
    key: "albert",
    given: "Albert",
    surname: "Exemple",
    sex: "male",
    birth: day("1850-04-02"),
    birthPlace: "exempleville",
    death: year(1921),
    deathPlace: "chateau",
    bio: "Personnage fictif, premier ancêtre de la famille d’exemple. Sa biographie sert à tester la mise en page : il plante un verger à Exempleville et le transmet à ses enfants.",
  },
  {
    key: "berthe",
    given: "Berthe",
    surname: "Modèle",
    sex: "female",
    birth: about(1856),
    death: day("1930-11-14"),
    originFamily: "Modèle",
    bio: "Personnage fictif. Biographie d’exemple, pour vérifier qu’un texte court s’affiche bien sur une fiche.",
  },
  {
    key: "charles",
    given: "Charles",
    surname: "Exemple",
    sex: "male",
    birth: day("1880-02-20"),
    birthPlace: "exempleville",
    death: year(1944),
    branch: "ainee",
  },
  {
    key: "diane",
    given: "Diane",
    surname: "Exemple",
    sex: "female",
    birth: year(1882),
    death: year(1970),
  },
  {
    key: "emile",
    given: "Émile",
    surname: "Exemple",
    sex: "male",
    birth: day("1887-09-03"),
    death: day("1960-01-05"),
    deathPlace: "modelebourg",
    branch: "cadette",
  },
  {
    key: "denise",
    given: "Denise",
    surname: "Essai",
    sex: "female",
    birth: year(1884),
    death: year(1960),
    originFamily: "Essai",
  },
  {
    key: "edmond",
    given: "Edmond",
    surname: "Témoin",
    sex: "male",
    birth: year(1879),
    death: year(1950),
    originFamily: "Témoin",
  },
  {
    key: "fanny",
    given: "Fanny",
    surname: "Maquette",
    sex: "female",
    birth: year(1890),
    death: year(1975),
    originFamily: "Maquette",
  },
  {
    key: "francois",
    given: "François",
    surname: "Exemple",
    sex: "male",
    birth: day("1910-05-17"),
    birthPlace: "essai",
    death: year(1985),
    branch: "ainee",
  },
  {
    key: "helene",
    given: "Hélène",
    surname: "Exemple",
    sex: "female",
    birth: year(1912),
    death: year(2005),
    branch: "rameau",
  },
  {
    key: "igor",
    given: "Igor",
    surname: "Témoin",
    sex: "male",
    birth: year(1908),
    death: year(1990),
  },
  {
    key: "gaston",
    given: "Gaston",
    surname: "Exemple",
    sex: "male",
    birth: year(1915),
    birthPlace: "modelebourg",
    death: year(1999),
    branch: "cadette",
  },
  {
    key: "gabrielle",
    given: "Gabrielle",
    surname: "Fictif",
    sex: "female",
    birth: year(1913),
    death: year(2001),
    originFamily: "Fictif",
  },
  {
    key: "jacques",
    given: "Jacques",
    surname: "Exemple",
    sex: "male",
    birth: day("1938-03-08"),
    death: day("2019-07-30"),
    branch: "ainee",
    bio: "Personnage fictif. Sa fiche d’exemple montre un titre porté, un mariage et des enfants encore en vie.",
  },
  {
    key: "juliette",
    given: "Juliette",
    surname: "Brouillon",
    sex: "female",
    birth: year(1941),
    originFamily: "Brouillon",
  },
  {
    key: "karine",
    given: "Karine",
    surname: "Exemple",
    sex: "female",
    birth: year(1945),
    branch: "ainee",
  },
  {
    key: "laurent",
    given: "Laurent",
    surname: "Exemple",
    sex: "male",
    birth: day("1968-11-02"),
    branch: "ainee",
  },
  {
    key: "marie",
    given: "Marie",
    surname: "Exemple",
    sex: "female",
    birth: year(1971),
    branch: "ainee",
  },
  {
    key: "noe",
    given: "Noé",
    surname: "Exemple",
    sex: "male",
    birth: year(2002),
    branch: "ainee",
  },
];

export const demoUnions = [
  {
    key: "albert-berthe",
    a: "albert",
    b: "berthe",
    date: day("1878-06-10"),
    place: "exempleville",
  },
  {
    key: "charles-denise",
    a: "charles",
    b: "denise",
    date: year(1908),
    place: "essai",
  },
  { key: "diane-edmond", a: "diane", b: "edmond", date: year(1905) },
  {
    key: "emile-fanny",
    a: "emile",
    b: "fanny",
    date: year(1912),
    place: "modelebourg",
  },
  {
    key: "francois-gabrielle",
    a: "francois",
    b: "gabrielle",
    date: year(1936),
  },
  { key: "jacques-juliette", a: "jacques", b: "juliette", date: year(1966) },
] as const;

/** child: [parents' union, or a single parent]. */
export const demoChildren: {
  child: string;
  union?: string;
  parent?: string;
  certainty?: "attested" | "tradition";
}[] = [
  { child: "charles", union: "albert-berthe" },
  { child: "diane", union: "albert-berthe" },
  { child: "emile", union: "albert-berthe", certainty: "tradition" },
  { child: "francois", union: "charles-denise" },
  { child: "helene", union: "charles-denise" },
  { child: "igor", union: "diane-edmond" },
  { child: "gaston", union: "emile-fanny" },
  { child: "jacques", union: "francois-gabrielle" },
  { child: "karine", union: "francois-gabrielle" },
  { child: "laurent", union: "jacques-juliette" },
  { child: "marie", union: "jacques-juliette" },
  // The other parent is not recorded: a case the tree must handle.
  { child: "noe", parent: "laurent" },
];

export const demoTitles = [
  {
    key: "exempleville",
    name: "Seigneur d’Exempleville (titre d’exemple)",
    created: year(1702),
    creator: "Un souverain d’exemple",
    branch: "ainee",
    holders: [
      { person: "albert", rank: 1, from: year(1878), to: year(1921) },
      { person: "charles", rank: 2, from: year(1921), to: year(1944) },
      { person: "francois", rank: 3, from: year(1944), to: year(1985) },
      { person: "jacques", rank: 4, from: year(1985), to: year(2019) },
    ],
  },
  {
    key: "modelebourg",
    name: "Baron de Modèlebourg (titre d’exemple)",
    created: year(1803),
    creator: "Un prince d’exemple",
    branch: "cadette",
    holders: [
      { person: "emile", rank: 1, from: year(1912), to: year(1960) },
      { person: "gaston", rank: 2, from: year(1960), to: year(1999) },
    ],
  },
] as const;

export const demoEvents = [
  {
    key: "verger",
    kind: "acquisition",
    title: "Le verger d’Exempleville (événement d’exemple)",
    date: year(1879),
    place: "exempleville",
    people: ["albert"],
  },
  {
    key: "bataille",
    kind: "battle",
    title: "Bataille d’exemple",
    date: year(1914),
    place: "modelebourg",
    people: ["emile"],
  },
  {
    key: "extinction",
    kind: "extinction",
    title: "Extinction de la branche cadette (exemple)",
    date: year(1999),
    place: "modelebourg",
    people: ["gaston"],
  },
  {
    key: "reunion",
    kind: "other",
    title: "Réunion de famille (exemple)",
    date: day("2010-07-14"),
    place: "chateau",
    people: ["karine", "laurent"],
  },
] as const;

export const demoStories = [
  {
    key: "verger",
    title: "Le verger d’Albert (histoire d’exemple)",
    excerpt:
      "Une histoire d’exemple, écrite pour tester la page des histoires et la mise en page de lecture.",
    body: [
      "Ceci est une histoire d’exemple. Elle a été écrite pour vérifier la mise en page : un titre, quelques paragraphes, des personnes liées dans la marge.",
      "Dans cette fiction, Albert Exemple plante un verger à Exempleville. Ses enfants y jouent, ses petits-enfants y récoltent les pommes.",
      "Cette histoire disparaîtra avec les autres données de démonstration, dès que la famille aura commencé à écrire les siennes.",
    ].join("\n\n"),
    era: [1879, 1921],
    themes: ["daily"],
    people: ["albert", "berthe"],
    places: ["exempleville"],
    events: ["verger"],
    featured: true,
  },
  {
    key: "mariage",
    title: "Un mariage à Essai-sur-Mer (histoire d’exemple)",
    excerpt:
      "Histoire d’exemple sur un mariage fictif, pour tester les filtres par thème et par époque.",
    body: "Histoire d’exemple. Charles Exemple et Denise Essai, deux personnages inventés, se marient à Essai-sur-Mer. Le texte s’arrête là : il sert seulement à remplir la page pour la tester.",
    era: [1908, 1908],
    themes: ["love"],
    people: ["charles", "denise"],
    places: ["essai"],
    events: [],
    featured: false,
  },
  {
    key: "reunion",
    title: "La réunion de 2010 (histoire d’exemple)",
    excerpt:
      "Histoire d’exemple qui cite des personnes vivantes : seuls les membres connectés la voient.",
    body: "Histoire d’exemple. Elle cite des personnes vivantes de la famille fictive ; elle n’est donc visible que des membres connectés, jamais du public.",
    era: [2010, 2010],
    themes: ["daily"],
    people: ["karine", "laurent"],
    places: ["chateau"],
    events: ["reunion"],
    featured: false,
  },
] as const;

export const demoSources: {
  key: string;
  title: string;
  kind: "archive" | "document" | "book";
  reference: string;
  repository: string;
  transcription: string;
  translation?: string;
  people: string[];
  /** Parent-child links this source proves: [parent, child]. */
  filiations?: [string, string][];
}[] = [
  {
    key: "registre",
    title: "Registre paroissial d’Exempleville (source d’exemple)",
    kind: "archive",
    reference: "Exemple, registre 1850, folio 12",
    repository: "Archives d’exemple",
    transcription:
      "Texte d’exemple : « L’an mil huit cent cinquante, le deux avril, est né Albert… » (transcription fictive)",
    people: ["albert"],
  },
  {
    key: "bapteme-charles",
    title: "Acte de baptême de Charles Exemple (source d’exemple)",
    kind: "document",
    reference: "Exemple, registre 1880, folio 3",
    repository: "Archives d’exemple",
    transcription:
      "Texte d’exemple : « Charles, fils d’Albert Exemple et de Berthe Modèle… » (transcription fictive)",
    people: ["charles"],
    filiations: [
      ["albert", "charles"],
      ["berthe", "charles"],
    ],
  },
  {
    key: "livre-de-famille",
    title: "Livre de famille d’exemple",
    kind: "book",
    reference: "Exemple, pages 1 à 4",
    repository: "Collection d’exemple",
    transcription:
      "Texte d’exemple : quelques lignes fictives d’un livre de famille, pour tester l’onglet « Preuves ».",
    translation:
      "Example text: a few fictional lines, to test a translation next to the transcription.",
    people: [],
    filiations: [
      ["charles", "francois"],
      ["francois", "jacques"],
    ],
  },
  {
    // About living people: visible to members only, like any such source.
    key: "livret-recent",
    title: "Livret de famille récent (source d’exemple)",
    kind: "document",
    reference: "Exemple, livret 1966",
    repository: "Papiers de famille d’exemple",
    transcription: "Texte d’exemple, visible des seuls membres connectés.",
    people: [],
    filiations: [
      ["jacques", "laurent"],
      ["laurent", "noe"],
    ],
  },
];

/** Fictional arms, so that the tree and the arms page show their shields. */
export const demoArms: {
  key: string;
  builtin: "exemple" | "exemple-modele";
  kind: "family" | "alliance" | "commune";
  name: string;
  blazon: string;
  explanation: string;
  period?: [number, number | null];
  branch?: string;
  person?: string;
  family?: string;
  people?: string[];
}[] = [
  {
    key: "exemple",
    builtin: "exemple",
    kind: "family",
    name: "Armoiries d’exemple de la famille Exemple",
    blazon: "D’argent à la bande de gueules (blason d’exemple)",
    explanation:
      "Un fond blanc traversé d’une bande rouge en diagonale. Armoiries inventées pour la démonstration.",
    period: [1850, null],
    branch: "ainee",
    person: "albert",
  },
  {
    key: "modele",
    builtin: "exemple-modele",
    kind: "alliance",
    name: "Armoiries d’exemple de la famille Modèle",
    blazon: "D’argent au chef de gueules (blason d’exemple)",
    explanation:
      "Un fond blanc dont le haut est rouge. Armoiries inventées pour la démonstration.",
    family: "Modèle",
    people: ["berthe"],
  },
  {
    key: "commune",
    builtin: "exemple",
    kind: "commune",
    name: "Armoiries d’exemple de la commune d’Exempleville",
    blazon: "D’argent à la bande de gueules (blason d’exemple)",
    explanation:
      "Une commune fictive qui a repris les armes de la famille Exemple.",
  },
];

/** Where the demonstration tree opens. */
export const demoEntryPoints = [
  { person: "albert", label: "Depuis Albert (exemple)", isDefault: true },
  {
    person: "emile",
    label: "Depuis la branche cadette (exemple)",
    isDefault: false,
  },
] as const;

/** A lineage to show link by link, as the family will do from Hungary. */
export const demoLineages = [
  {
    start: "albert",
    // Ends with someone the public may see, so that visitors can try it too.
    end: "jacques",
    title: "D’Albert à Jacques (lignée d’exemple)",
    intro:
      "Lignée d’exemple, inventée pour essayer la démonstration : chaque maillon affiche sa preuve.",
  },
] as const;

/** Home page of the demonstration: chapters over the fictional places. */
export const demoSummary =
  "Ceci est un résumé d’exemple : il montre où la famille racontera, en trois ou quatre phrases, d’où elle vient.\nLa famille « Exemple » est inventée : ses dates, ses lieux et ses titres servent à essayer la page.\nElle disparaîtra en un clic, dès que la vraie famille aura écrit son propre résumé.";

export const demoChapters = [
  {
    key: "prologue",
    prologue: true,
    dateLabel: "Avant 1850",
    title: "Un prologue d’exemple",
    body: "Texte d’exemple. Ici, la famille racontera ses origines, avant le premier chapitre.",
    era: null,
    place: null,
    zoom: 1,
  },
  {
    key: "exempleville",
    prologue: false,
    dateLabel: "1850",
    title: "Exempleville (chapitre d’exemple)",
    body: "Chapitre d’exemple. Albert Exemple naît dans un village inventé et y plante un verger.",
    era: [1850, 1880],
    place: "exempleville",
    zoom: 5,
  },
  {
    key: "modelebourg",
    prologue: false,
    dateLabel: "1912",
    title: "Le baronnage de Modèlebourg (exemple)",
    body: "Chapitre d’exemple. Émile s’installe à Modèlebourg ; la carte se déplace avec lui.",
    era: [1900, 1960],
    place: "modelebourg",
    zoom: 4.5,
  },
  {
    key: "chateau",
    prologue: false,
    dateLabel: "1936",
    title: "Le château d’Exemple (exemple)",
    body: "Chapitre d’exemple. Le château devient le lieu des réunions de famille.",
    era: [1930, 1990],
    place: "chateau",
    zoom: 5,
  },
  {
    key: "aujourdhui",
    prologue: false,
    dateLabel: "Aujourd’hui",
    title: "Une famille d’exemple",
    body: "Chapitre d’exemple. La famille vit aujourd’hui un peu partout en Europe : la carte s’élargit.",
    era: [1990, 2026],
    place: null,
    zoom: 1,
  },
] as const;

export const demoFigures = [
  { auto: "people", label: "personnes dans l’arbre d’exemple" },
  { auto: "generations", label: "générations" },
  { auto: "places", label: "lieux d’exemple" },
  { value: 2, label: "titres d’exemple" },
] as const;

export const demoAnecdotes = [
  {
    key: "pomme",
    title: "La pomme d’or (anecdote d’exemple)",
    excerpt:
      "Anecdote d’exemple : chaque automne, la plus belle pomme du verger était offerte au plus jeune de la famille.",
  },
  {
    key: "cheval",
    title: "Le cheval qui savait compter (anecdote d’exemple)",
    excerpt:
      "Anecdote d’exemple, inventée pour tester les cartes rouges de « Le saviez-vous ? ».",
  },
  {
    key: "portrait",
    title: "Le portrait retrouvé (anecdote d’exemple)",
    excerpt:
      "Anecdote d’exemple : un portrait oublié dans un grenier, retrouvé des années plus tard.",
  },
] as const;
