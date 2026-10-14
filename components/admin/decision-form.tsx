"use client";

import { useTranslations } from "next-intl";
import {
  decide,
  type DecisionState,
} from "@/app/[locale]/(admin)/admin/propositions/actions";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/field";
import { useFormAction } from "@/lib/hooks/use-form-action";
import { useRouter } from "@/lib/i18n/navigation";
import { useSaved } from "./admin-kit";

const initial: DecisionState = { status: "idle" };

/** Accept or decline, with a word the author receives by email. */
export function DecisionForm({ id }: { id: string }) {
  const t = useTranslations("admin.proposals");
  const tCommon = useTranslations("admin.members.errors");
  const router = useRouter();
  const [state, onSubmit, pending] = useFormAction(decide, initial);
  useSaved(state, () => router.refresh());
  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <input type="hidden" name="id" value={id} />
      <TextArea
        label={t("reply")}
        hint={t("replyHint")}
        name="reply"
        rows={3}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="decision" value="accept" busy={pending}>
          {t("accept")}
        </Button>
        <Button
          type="submit"
          name="decision"
          value="reject"
          variant="secondary"
          disabled={pending}
        >
          {t("reject")}
        </Button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="font-medium text-croy-text">
          {tCommon("error")}
        </p>
      )}
    </form>
  );
}
