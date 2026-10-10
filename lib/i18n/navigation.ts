import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and `next/navigation`.
 * Always import `Link`, `redirect`, `useRouter`… from here, never from Next
 * directly, so that every URL gets its prefix and its translated segments.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
