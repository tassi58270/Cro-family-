"use client";

import { useTranslations } from "next-intl";
import {
  acceptWithChanges,
  type ApplyState,
} from "@/app/[locale]/(admin)/admin/propositions/actions";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui/field";
import type { ProposalPayload } from "@/lib/contributions/kinds";
import { EVENT_KINDS, PLACE_KINDS } from "@/lib/data/place-types";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import { useSaved } from "./admin-kit";

const initial: ApplyState = { status: "idle" };
const RELATION = {
  parent: "parent",
  child: "child",
  spouse: "partner",
  sibling: "none",
} as const;

/**
 * « Modifier puis accepter » (section 7): the proposal, prefilled, becomes a
 * person, a place or an event once the administrator has checked it.
 */
export function ApplyProposal({
  id,
  kind,
  payload,
  targetId,
  places,
}: {
  id: string;
  kind: "person" | "place" | "event";
  payload: ProposalPayload;
  targetId: string | null;
  places: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.proposals.apply");
  const tProposal = useTranslations("admin.proposals");
  const tPerson = useTranslations("admin.person");
  const tPlace = useTranslations("admin.places");
  const tKinds = useTranslations("places.kinds");
  const tPlaceKinds = useTranslations("places.placeKinds");
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(acceptWithChanges, initial);
  useSaved(state, () => router.refresh());
  const error = (field: string) =>
    state.errors?.[field] ? t("check") : undefined;
  const placeMatch = places.find(
    (p) => p.name.toLowerCase() === payload.place?.toLowerCase(),
  );

  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-6 rounded-xs border border-hairline p-5"
    >
      <h2 className="font-display text-title-sm">{t(`title.${kind}`)}</h2>
      <p className="-mt-3 text-caption text-ink-muted">{t("intro")}</p>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="proposalKind" value={kind} />

      {kind === "person" && (
        <>
          <input
            type="hidden"
            name="relation"
            value={
              targetId && payload.relation ? RELATION[payload.relation] : "none"
            }
          />
          <input type="hidden" name="relativeId" value={targetId ?? ""} />
          <div className="grid gap-6 sm:grid-cols-2">
            <TextField
              label={tPerson("givenNames")}
              name="givenNames"
              defaultValue={payload.givenNames}
              error={error("givenNames")}
            />
            <TextField
              label={tPerson("surname")}
              name="surname"
              defaultValue={payload.surname}
            />
            <TextField
              label={tPerson("birth")}
              name="birth"
              defaultValue={payload.birth}
              error={error("birth")}
            />
            <TextField
              label={tPerson("birthPlace")}
              name="birthPlace"
              defaultValue={payload.birthPlace}
            />
            <TextField
              label={tPerson("death")}
              name="death"
              defaultValue={payload.death}
              error={error("death")}
            />
            <TextField
              label={tPerson("deathPlace")}
              name="deathPlace"
              defaultValue={payload.deathPlace}
            />
          </div>
          {payload.relation === "sibling" && (
            <p className="text-caption text-ink-muted">{t("sibling")}</p>
          )}
        </>
      )}

      {kind === "place" && (
        <>
          <TextField
            label={tPlace("name")}
            name="name_fr"
            defaultValue={payload.name}
            error={error("name_fr")}
          />
          <SelectField label={tPlace("kind")} name="kind" defaultValue="town">
            {PLACE_KINDS.map((k) => (
              <option key={k} value={k}>
                {tPlaceKinds(k)}
              </option>
            ))}
          </SelectField>
          <TextField
            label={tPlace("coordinates")}
            hint={tPlace("coordinatesHint")}
            name="coordinates"
            error={error("coordinates")}
          />
          <TextArea
            label={tPlace("description")}
            name="description_fr"
            rows={4}
            defaultValue={[payload.location, payload.text]
              .filter(Boolean)
              .join("\n\n")}
          />
        </>
      )}

      {kind === "event" && (
        <>
          {targetId && <input type="hidden" name="people" value={targetId} />}
          <TextField
            label={tPlace("eventTitle")}
            name="title_fr"
            defaultValue={payload.title}
            error={error("title_fr")}
          />
          <TextField
            label={tPlace("date")}
            hint={tPlace("dateHint")}
            name="date"
            defaultValue={payload.date}
            error={error("date")}
          />
          <SelectField label={tPlace("kind")} name="kind" defaultValue="other">
            {EVENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {tKinds(k)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={tPlace("place")}
            hint={
              payload.place
                ? t("placeWas", { place: payload.place })
                : undefined
            }
            name="place"
            defaultValue={placeMatch?.id ?? ""}
          >
            <option value="">{tPlace("none")}</option>
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <TextArea
            label={tPlace("description")}
            name="description_fr"
            rows={4}
            defaultValue={payload.text}
          />
        </>
      )}

      <Checkbox name="published" label={t("publish")} defaultChecked />
      <TextArea
        label={tProposal("reply")}
        hint={tProposal("replyHint")}
        name="reply"
        rows={2}
      />
      <div>
        <Button type="submit" busy={pending}>
          {t("submit")}
        </Button>
      </div>
      {state.status === "invalid" && (
        <p role="alert" className="font-medium text-croy-text">
          {t("check")}
        </p>
      )}
      {state.status === "error" && (
        <p role="alert" className="font-medium text-croy-text">
          {t("error")}
        </p>
      )}
    </form>
  );
}
