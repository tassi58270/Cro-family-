"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorScreen } from "@/components/ui/error-screen";

/**
 * A page that failed: the visitor can try again; the reference matches the
 * server log, without showing what went wrong.
 */
export default function LocaleError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ErrorScreen
      code="500"
      title={t("title")}
      body={t("body")}
      actions={
        <>
          <Button onClick={() => retry()}>{t("retry")}</Button>
          <ButtonLink href="/" variant="secondary">
            {t("backHome")}
          </ButtonLink>
        </>
      }
      footnote={
        error.digest ? t("reference", { digest: error.digest }) : undefined
      }
    />
  );
}
