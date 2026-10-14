"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { AccessForm } from "./access-form";
import { ProposalForm } from "./proposal-form";

const signedIn = () =>
  document.cookie.split("; ").some((c) => c.startsWith("croy_membre="));

/**
 * The page is the same for everyone (built in advance); the browser knows
 * whether someone is signed in and shows the right form.
 */
export function ContributeArea() {
  const t = useTranslations("contribute");
  const member = useSyncExternalStore(
    () => () => {},
    signedIn,
    () => null,
  );

  if (member === null)
    return <div className="h-96 animate-pulse rounded-xs bg-paper-2" />;

  if (member)
    return (
      <section aria-labelledby="proposer" className="grid gap-8">
        <h2 id="proposer" className="font-display text-title">
          {t("form.title")}
        </h2>
        <ProposalForm />
      </section>
    );

  return (
    <section
      aria-labelledby="acces"
      className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
    >
      <div className="grid content-start gap-4">
        <h2 id="acces" className="font-display text-title">
          {t("signedOut.title")}
        </h2>
        <p className="text-ink-muted">{t("signedOut.body")}</p>
        <p>
          {t("signedOut.already")}{" "}
          <Link href="/connexion" className="link font-medium">
            {t("signedOut.signIn")}
          </Link>
        </p>
      </div>
      <div className="grid gap-6">
        <h3 className="font-display text-title-sm">{t("access.title")}</h3>
        <AccessForm />
      </div>
    </section>
  );
}
