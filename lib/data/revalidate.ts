import "server-only";
import { revalidatePath } from "next/cache";
import { routing } from "@/lib/i18n/routing";

/**
 * After any published change: every public page is regenerated on its next
 * visit, so the change shows within a minute, without redeploying
 * (cahier des charges, section 7).
 */
export function contentChanged() {
  revalidatePath("/", "layout");
  // Route handlers are outside the layout: the public tree files too.
  for (const locale of routing.locales) revalidatePath(`/api/arbre/${locale}`);
}
