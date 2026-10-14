import { getSession, viewerOf } from "@/lib/auth/session";
import { withViewer, type Query } from "@/lib/db";
import { formatFuzzyDate, type DatePrecision } from "@/lib/genealogie/dates";
import {
  buildGedcom,
  toCsv,
  type ExportTree,
} from "@/lib/genealogie/gedcom-export";

/**
 * Exports of the dashboard (section 7, « Import et export »): the tree as
 * GEDCOM, people, places and events as CSV, and every content as JSON.
 * Administrators only; never cached.
 */
export const dynamic = "force-dynamic";

const FILES = {
  "arbre.ged": "text/vnd.familysearch.gedcom; charset=utf-8",
  "personnes.csv": "text/csv; charset=utf-8",
  "lieux.csv": "text/csv; charset=utf-8",
  "evenements.csv": "text/csv; charset=utf-8",
  "sauvegarde.json": "application/json; charset=utf-8",
} as const;
type File = keyof typeof FILES;

/** Every table of contents, for the backup (accounts stay private). */
const BACKUP = [
  "branches",
  "branches_i18n",
  "places",
  "places_i18n",
  "people",
  "people_i18n",
  "unions",
  "parent_child",
  "titles",
  "titles_i18n",
  "people_titles",
  "arms",
  "arms_i18n",
  "albums",
  "albums_i18n",
  "media",
  "media_i18n",
  "media_people",
  "events",
  "events_i18n",
  "event_people",
  "place_people",
  "stories",
  "stories_i18n",
  "story_people",
  "story_places",
  "story_events",
  "story_media",
  "sources",
  "person_sources",
  "union_sources",
  "filiation_sources",
  "lineages",
  "lineages_i18n",
  "tree_entry_points",
  "tree_entry_points_i18n",
  "home_i18n",
  "home_figures",
  "home_figures_i18n",
  "home_chapters",
  "home_chapters_i18n",
  "suggestions",
  "access_requests",
  "invitations",
  "profiles",
];

type DateRow = { date: string | null; precision: DatePrecision | null };
const fuzzy = ({ date, precision }: DateRow) =>
  date && precision ? { date: date.slice(0, 10), precision } : null;
const written = (row: DateRow) => {
  const value = fuzzy(row);
  return value ? formatFuzzyDate(value, "fr") : "";
};

const PLACE_NAME = (column: string) =>
  `(select name from public.places_i18n i where i.place_id = ${column} and i.locale = 'fr')`;

async function tree(q: Query): Promise<ExportTree> {
  const people = await q<{
    id: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    sex: "female" | "male" | "unknown";
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    birth_place: string | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    death_place: string | null;
    deceased: boolean;
  }>(
    `select p.id, p.given_names, p.surname, p.epithet, p.sex, p.birth_date::text, p.birth_precision,
            ${PLACE_NAME("p.birth_place_id")} as birth_place,
            p.death_date::text, p.death_precision, ${PLACE_NAME("p.death_place_id")} as death_place,
            p.deceased
     from public.people p where not p.is_demo order by p.birth_date nulls last, p.surname`,
  );
  const unions = await q<{
    id: string;
    partner_a: string;
    partner_b: string | null;
    marriage_date: string | null;
    marriage_precision: DatePrecision | null;
    place: string | null;
  }>(
    `select u.id, u.partner_a, u.partner_b, u.marriage_date::text, u.marriage_precision,
            ${PLACE_NAME("u.place_id")} as place
     from public.unions u where not u.is_demo`,
  );
  const filiations = await q<{ parent_id: string; child_id: string }>(
    "select parent_id, child_id from public.parent_child",
  );
  return {
    people: people.map((p) => ({
      id: p.id,
      givenNames: p.given_names,
      surname: p.surname,
      epithet: p.epithet,
      sex: p.sex,
      birth: fuzzy({ date: p.birth_date, precision: p.birth_precision }),
      birthPlace: p.birth_place,
      death: fuzzy({ date: p.death_date, precision: p.death_precision }),
      deathPlace: p.death_place,
      deceased: p.deceased,
    })),
    unions: unions.map((u) => ({
      id: u.id,
      a: u.partner_a,
      b: u.partner_b,
      marriage: fuzzy({
        date: u.marriage_date,
        precision: u.marriage_precision,
      }),
      marriagePlace: u.place,
    })),
    filiations: filiations.map((f) => ({
      parent: f.parent_id,
      child: f.child_id,
    })),
  };
}

async function build(q: Query, file: File): Promise<string> {
  switch (file) {
    case "arbre.ged":
      return buildGedcom(await tree(q));
    case "personnes.csv": {
      const rows = await q<Record<string, unknown> & DateRow>(
        `select p.slug, p.given_names, p.surname, p.epithet, p.sex,
                p.birth_date::text as birth_date, p.birth_precision,
                ${PLACE_NAME("p.birth_place_id")} as birth_place,
                p.death_date::text as death_date, p.death_precision,
                ${PLACE_NAME("p.death_place_id")} as death_place, p.deceased,
                (select name from public.branches_i18n b where b.branch_id = p.branch_id and b.locale = 'fr') as branch,
                p.status
         from public.people p where not p.is_demo order by p.surname, p.given_names`,
      );
      return toCsv(
        [
          "slug",
          "given_names",
          "surname",
          "epithet",
          "sex",
          "birth",
          "birth_place",
          "death",
          "death_place",
          "deceased",
          "branch",
          "status",
        ],
        rows.map((r) => ({
          ...r,
          birth: written({
            date: r.birth_date as string | null,
            precision: r.birth_precision as DatePrecision | null,
          }),
          death: written({
            date: r.death_date as string | null,
            precision: r.death_precision as DatePrecision | null,
          }),
        })),
      );
    }
    case "lieux.csv":
      return toCsv(
        [
          "slug",
          "name",
          "kind",
          "lat",
          "lng",
          "country_code",
          "period_start",
          "period_end",
          "visitable",
          "description",
          "status",
        ],
        await q(
          `select p.slug, i.name, p.kind, p.lat, p.lng, p.country_code, p.period_start,
                  p.period_end, p.visitable, i.description, p.status
           from public.places p left join public.places_i18n i on i.place_id = p.id and i.locale = 'fr'
           where not p.is_demo order by i.name`,
        ),
      );
    case "evenements.csv": {
      const rows = await q<Record<string, unknown>>(
        `select e.slug, i.title, e.kind, e.event_date::text as date, e.event_precision as precision,
                ${PLACE_NAME("e.place_id")} as place, i.description, e.status
         from public.events e left join public.events_i18n i on i.event_id = e.id and i.locale = 'fr'
         where not e.is_demo order by e.event_date nulls last`,
      );
      return toCsv(
        ["slug", "title", "kind", "date", "place", "description", "status"],
        rows.map((r) => ({
          ...r,
          date: written({
            date: r.date as string | null,
            precision: r.precision as DatePrecision | null,
          }),
        })),
      );
    }
    case "sauvegarde.json": {
      const backup: Record<string, unknown[]> = {};
      for (const table of BACKUP)
        backup[table] = await q(`select * from public.${table}`);
      return JSON.stringify(
        { exportedAt: new Date().toISOString(), tables: backup },
        null,
        1,
      );
    }
  }
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/export/[fichier]">,
) {
  const session = await getSession();
  if (!session || session.role !== "admin")
    return new Response(null, { status: 403 });
  const { fichier } = await ctx.params;
  if (!(fichier in FILES)) return new Response(null, { status: 404 });
  const file = fichier as File;
  const body = await withViewer(viewerOf(session), (q) => build(q, file));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": FILES[file],
      "Content-Disposition": `attachment; filename="croy-${stamp}-${file}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
