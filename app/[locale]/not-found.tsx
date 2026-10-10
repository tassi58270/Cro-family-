import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

export default function LocaleNotFound() {
  const t = useTranslations("notFound");

  return (
    <main
      id="contenu"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-24 md:px-10"
    >
      <p className="text-base font-medium text-ink-muted tabular-nums">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">
        {t("title")}
      </h1>
      <p className="mt-6 max-w-prose text-base text-pretty text-ink-muted md:text-lg">
        {t("body")}
      </p>
      <p className="mt-10">
        <Link
          href="/"
          className="font-medium underline decoration-croy decoration-2 underline-offset-4 transition-[text-decoration-thickness] hover:decoration-4"
        >
          {t("backHome")}
        </Link>
      </p>
    </main>
  );
}
