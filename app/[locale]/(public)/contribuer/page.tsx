import {
  SectionPlaceholder,
  sectionMetadata,
} from "@/components/ui/section-placeholder";
import { resolveLocale } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/contribuer">) {
  return sectionMetadata(await resolveLocale(params), "contribute");
}

/** Placeholder until the step of section 8 that builds this page. */
export default async function Page({
  params,
}: PageProps<"/[locale]/contribuer">) {
  const locale = await resolveLocale(params);
  return (
    <SectionPlaceholder
      locale={locale}
      section="contribute"
      actionHref="/connexion"
    />
  );
}
