import createMiddleware from "next-intl/middleware";
import { routing } from "./lib/i18n/routing";

/**
 * Runs before every page request: detects the visitor's language, adds the
 * /fr, /en or /de prefix and translates URL segments (/en/arbre → /en/family-tree).
 */
export default createMiddleware(routing);

export const config = {
  // Every path except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
