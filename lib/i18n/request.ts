import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { withFallback } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const reference = (await import("../../messages/fr.json")).default;
  const messages =
    locale === "fr"
      ? reference
      : withFallback(
          reference,
          (await import(`../../messages/${locale}.json`)).default,
        );

  return { locale, messages };
});
