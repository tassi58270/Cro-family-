import "server-only";
import { revalidatePath } from "next/cache";

/**
 * After any published change: every public page is regenerated on its next
 * visit, so the change shows within a minute, without redeploying
 * (cahier des charges, section 7).
 */
export function contentChanged() {
  revalidatePath("/", "layout");
}
