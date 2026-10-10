"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  loadDemoAction,
  removeDemoAction,
} from "@/app/[locale]/(admin)/admin/demonstration/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/i18n/navigation";

export function DemoControls({ loaded }: { loaded: boolean }) {
  const t = useTranslations("admin.demo");
  const router = useRouter();
  const [pending, start] = useTransition();

  return loaded ? (
    <Button
      busy={pending}
      onClick={() => {
        if (!window.confirm(t("removeConfirm"))) return;
        start(async () => {
          await removeDemoAction();
          router.refresh();
        });
      }}
    >
      {t("remove")}
    </Button>
  ) : (
    <Button
      variant="secondary"
      busy={pending}
      onClick={() =>
        start(async () => {
          await loadDemoAction();
          router.refresh();
        })
      }
    >
      {t("load")}
    </Button>
  );
}
