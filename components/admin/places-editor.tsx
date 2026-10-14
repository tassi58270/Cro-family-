"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  deleteEvent,
  deletePlace,
  saveEvent,
  savePlace,
  type PlaceFormState,
} from "@/app/[locale]/(admin)/admin/lieux/actions";
import { MapView, type MapApi } from "@/components/carte/map-view";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/chip";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import { SidePanel } from "@/components/ui/side-panel";
import type { AdminEvent, AdminPlace } from "@/lib/data/admin-places";
import { EVENT_KINDS, PLACE_KINDS } from "@/lib/data/place-types";
import { formatCoordinates, parseCoordinates } from "@/lib/carte/coordinates";
import { formatFuzzyDate, parseFuzzyDate } from "@/lib/genealogie/dates";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import {
  AdminSection,
  DeleteButton,
  FormFooter,
  PeoplePicker,
  Translations,
  TreeProvider,
  useFormWords,
  useSaved,
} from "./admin-kit";

const initial: PlaceFormState = { status: "idle" };
const NONE: ReadonlySet<string> = new Set();

type Panel =
  { kind: "place"; item?: AdminPlace } | { kind: "event"; item?: AdminEvent };

function CoordinatesField({
  defaultValue,
  error,
}: {
  defaultValue: string;
  error?: string;
}) {
  const t = useTranslations("admin.places");
  const tMap = useTranslations("places");
  const [value, setValue] = useState(defaultValue);
  const map = useRef<MapApi | null>(null);
  const point = parseCoordinates(value);
  const points = useMemo(
    () =>
      point
        ? [{ id: "lieu", name: t("here"), lat: point[0], lng: point[1] }]
        : [],
    // Recomputed from the text only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [point?.[0], point?.[1]],
  );
  return (
    <div className="grid gap-3">
      <TextField
        label={t("coordinates")}
        hint={t("coordinatesHint")}
        name="coordinates"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={error}
        inputMode="decimal"
      />
      <div className="relative h-64 overflow-hidden rounded-xs border border-hairline">
        <MapView
          className="absolute inset-0"
          points={points}
          active={points.length ? "lieu" : null}
          dimmed={NONE}
          onSelect={() => {}}
          onPick={(lat, lng) => setValue(formatCoordinates(lat, lng))}
          onReady={() => map.current?.fit()}
          apiRef={map}
          labels={{
            map: t("pickOnMap"),
            loading: tMap("mapLoading"),
            unavailable: tMap("mapUnavailable"),
            credit: tMap("mapCredit"),
          }}
        />
      </div>
      <p className="text-caption text-ink-muted">{t("pickOnMap")}</p>
    </div>
  );
}

function PlaceForm({
  item,
  locale,
  onSaved,
}: {
  item?: AdminPlace;
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.places");
  const tKinds = useTranslations("places.placeKinds");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(savePlace, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  const [visitable, setVisitable] = useState(item?.visitable ?? false);
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("name")}
        name="name_fr"
        defaultValue={item?.texts.fr.name}
        error={error("name_fr")}
      />
      <SelectField
        label={t("kind")}
        name="kind"
        defaultValue={item?.kind ?? "town"}
      >
        {PLACE_KINDS.map((k) => (
          <option key={k} value={k}>
            {tKinds(k)}
          </option>
        ))}
      </SelectField>
      <CoordinatesField
        defaultValue={
          item?.lat != null && item.lng != null
            ? formatCoordinates(item.lat, item.lng)
            : ""
        }
        error={error("coordinates")}
      />
      <TextField
        label={t("country")}
        hint={t("countryHint")}
        name="country"
        maxLength={2}
        defaultValue={item?.country ?? ""}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField
          label={t("periodStart")}
          name="periodStart"
          inputMode="numeric"
          defaultValue={item?.periodStart ?? ""}
          error={error("periodStart")}
        />
        <TextField
          label={t("periodEnd")}
          name="periodEnd"
          inputMode="numeric"
          defaultValue={item?.periodEnd ?? ""}
          error={error("periodEnd")}
        />
      </div>
      <TextArea
        label={t("description")}
        hint={t("descriptionHint")}
        name="description_fr"
        rows={5}
        defaultValue={item?.texts.fr.description}
      />
      <Checkbox
        name="visitable"
        label={t("visitable")}
        checked={visitable}
        onChange={(event) => setVisitable(event.target.checked)}
      />
      {visitable && (
        <TextArea
          label={t("visitInfo")}
          hint={t("visitInfoHint")}
          name="visit_info_fr"
          rows={3}
          defaultValue={item?.texts.fr.visit_info}
        />
      )}
      <PeoplePicker
        name="people"
        label={t("people")}
        hint={t("peopleHint")}
        initialIds={item?.people ?? []}
        locale={locale}
      />
      <Checkbox
        name="published"
        label={t("published")}
        hint={t("publishedHint")}
        defaultChecked={item ? item.published : true}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("name")}
              name={`name_${l}`}
              defaultValue={item?.texts[l].name}
            />
            <TextArea
              label={t("description")}
              name={`description_${l}`}
              rows={3}
              defaultValue={item?.texts[l].description}
            />
            <TextArea
              label={t("visitInfo")}
              name={`visit_info_${l}`}
              rows={2}
              defaultValue={item?.texts[l].visit_info}
            />
          </fieldset>
        ))}
      </Translations>
      <FormFooter
        pending={pending}
        state={state}
        save={words.save}
        error={words.error}
      />
    </form>
  );
}

function EventForm({
  item,
  places,
  branches,
  locale,
  onSaved,
}: {
  item?: AdminEvent;
  places: AdminPlace[];
  branches: { id: string; name: string }[];
  locale: string;
  onSaved: () => void;
}) {
  const t = useTranslations("admin.places");
  const tKinds = useTranslations("places.kinds");
  const tLang = useTranslations("common.languages");
  const [state, onSubmit, pending] = useFormAction(saveEvent, initial);
  useSaved(state, onSaved);
  const words = useFormWords();
  const [date, setDate] = useState(
    item?.date ? formatFuzzyDate(item.date, locale) : "",
  );
  const parsed = date.trim() ? parseFuzzyDate(date) : null;
  const error = (field: string) =>
    state.errors?.[field] ? t(`errors.${state.errors[field]}`) : undefined;
  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextField
        label={t("eventTitle")}
        name="title_fr"
        defaultValue={item?.texts.fr.title}
        error={error("title_fr")}
      />
      <TextField
        label={t("date")}
        name="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        hint={
          parsed
            ? t("understood", { date: formatFuzzyDate(parsed, locale) })
            : t("dateHint")
        }
        error={
          error("date") ??
          (date.trim() && !parsed ? t("errors.date") : undefined)
        }
      />
      <SelectField
        label={t("kind")}
        name="kind"
        defaultValue={item?.kind ?? "other"}
      >
        {EVENT_KINDS.map((k) => (
          <option key={k} value={k}>
            {tKinds(k)}
          </option>
        ))}
      </SelectField>
      <SelectField
        label={t("place")}
        name="place"
        defaultValue={item?.placeId ?? ""}
      >
        <option value="">{t("none")}</option>
        {places.map((p) => (
          <option key={p.id} value={p.id}>
            {p.texts.fr.name || p.slug}
          </option>
        ))}
      </SelectField>
      {branches.length > 0 && (
        <SelectField
          label={t("branch")}
          name="branch"
          defaultValue={item?.branchId ?? ""}
        >
          <option value="">{t("none")}</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </SelectField>
      )}
      <PeoplePicker
        name="people"
        label={t("eventPeople")}
        hint={t("eventPeopleHint")}
        initialIds={item?.people ?? []}
        locale={locale}
      />
      <TextArea
        label={t("description")}
        name="description_fr"
        rows={4}
        defaultValue={item?.texts.fr.description}
      />
      <Checkbox
        name="published"
        label={t("published")}
        hint={t("publishedHint")}
        defaultChecked={item ? item.published : true}
      />
      <Translations label={words.translations}>
        {(["en", "de"] as const).map((l) => (
          <fieldset key={l} lang={l} className="grid gap-4">
            <legend className="mb-2 text-caption font-medium text-ink-muted">
              {tLang(l)}
            </legend>
            <TextField
              label={t("eventTitle")}
              name={`title_${l}`}
              defaultValue={item?.texts[l].title}
            />
            <TextArea
              label={t("description")}
              name={`description_${l}`}
              rows={3}
              defaultValue={item?.texts[l].description}
            />
          </fieldset>
        ))}
      </Translations>
      <FormFooter
        pending={pending}
        state={state}
        save={words.save}
        error={words.error}
      />
    </form>
  );
}

/** Places and events: what the map and the timeline show (6.6). */
export function PlacesEditor({
  places,
  events,
  branches,
  locale,
}: {
  places: AdminPlace[];
  events: AdminEvent[];
  branches: { id: string; name: string }[];
  locale: string;
}) {
  const t = useTranslations("admin.places");
  const tKinds = useTranslations("places.kinds");
  const tPlaceKinds = useTranslations("places.placeKinds");
  const tCommon = useTranslations("admin.lineages");
  const router = useRouter();
  const [panel, setPanel] = useState<Panel | null>(null);
  const savedAndClose = () => {
    setPanel(null);
    router.refresh();
  };
  const placeName = (id: string | null) => {
    const p = places.find((x) => x.id === id);
    return p ? p.texts.fr.name || p.slug : null;
  };

  return (
    <TreeProvider locale={locale}>
      <div className="grid gap-12">
        <header className="grid gap-2">
          <h1 className="font-display text-title">{t("title")}</h1>
          <p className="max-w-2xl text-ink-muted">{t("intro")}</p>
        </header>

        <AdminSection
          id="lieux"
          title={t("placesTitle")}
          intro={t("placesIntro")}
          action={
            <Button
              variant="secondary"
              onClick={() => setPanel({ kind: "place" })}
            >
              {t("addPlace")}
            </Button>
          }
        >
          {places.length ? (
            <ul className="grid border-t border-hairline">
              {places.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
                >
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">
                      {p.texts.fr.name || p.slug}
                    </span>
                    <span className="text-caption text-ink-muted">
                      {[
                        tPlaceKinds(p.kind),
                        p.lat === null ? t("notOnMap") : null,
                        t("eventCount", {
                          count: events.filter((e) => e.placeId === p.id)
                            .length,
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {!p.published && (
                    <StatusChip status="draft">{t("draft")}</StatusChip>
                  )}
                  {p.isDemo && (
                    <StatusChip status="draft">
                      {tCommon("demoBadge")}
                    </StatusChip>
                  )}
                  <button
                    type="button"
                    className="link min-h-11 text-caption font-medium"
                    onClick={() => setPanel({ kind: "place", item: p })}
                  >
                    {tCommon("edit")}
                  </button>
                  <DeleteButton
                    action={deletePlace}
                    id={p.id}
                    label={tCommon("delete")}
                    confirm={tCommon("confirmDelete")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("noPlaces")}</p>
          )}
        </AdminSection>

        <AdminSection
          id="evenements"
          title={t("eventsTitle")}
          intro={t("eventsIntro")}
          action={
            <Button
              variant="secondary"
              onClick={() => setPanel({ kind: "event" })}
            >
              {t("addEvent")}
            </Button>
          }
        >
          {events.length ? (
            <ul className="grid border-t border-hairline">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-hairline py-3 max-sm:[&>*:first-child]:basis-full"
                >
                  <span className="grid min-w-0 flex-1 grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-3">
                    <span className="font-display text-croy-text tabular-nums">
                      {e.date
                        ? e.date.date.slice(0, 4).replace(/^0+/, "")
                        : "—"}
                    </span>
                    <span className="grid">
                      <span className="font-medium">
                        {e.texts.fr.title || e.slug}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {[tKinds(e.kind), placeName(e.placeId)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>
                  {!e.published && (
                    <StatusChip status="draft">{t("draft")}</StatusChip>
                  )}
                  {e.isDemo && (
                    <StatusChip status="draft">
                      {tCommon("demoBadge")}
                    </StatusChip>
                  )}
                  <button
                    type="button"
                    className="link min-h-11 text-caption font-medium"
                    onClick={() => setPanel({ kind: "event", item: e })}
                  >
                    {tCommon("edit")}
                  </button>
                  <DeleteButton
                    action={deleteEvent}
                    id={e.id}
                    label={tCommon("delete")}
                    confirm={tCommon("confirmDelete")}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">{t("noEvents")}</p>
          )}
        </AdminSection>

        <SidePanel
          open={panel !== null}
          onClose={() => setPanel(null)}
          title={
            panel?.kind === "event"
              ? panel.item
                ? t("editEvent")
                : t("addEvent")
              : panel?.item
                ? t("editPlace")
                : t("addPlace")
          }
        >
          {panel?.kind === "place" && (
            <PlaceForm
              key={panel.item?.id ?? "new-place"}
              item={panel.item}
              locale={locale}
              onSaved={savedAndClose}
            />
          )}
          {panel?.kind === "event" && (
            <EventForm
              key={panel.item?.id ?? "new-event"}
              item={panel.item}
              places={places}
              branches={branches}
              locale={locale}
              onSaved={savedAndClose}
            />
          )}
        </SidePanel>
      </div>
    </TreeProvider>
  );
}
