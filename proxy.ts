import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./lib/i18n/routing";

const intl = createMiddleware(routing);

const SESSION_COOKIE = "croy_session";

/** Member area and dashboard, in every language: /fr/compte, /en/account… */
const privatePrefixes = routing.locales.flatMap((locale) =>
  (["/compte", "/admin"] as const).map((route) => {
    const localized = routing.pathnames[route];
    const segment =
      typeof localized === "string" ? localized : localized[locale];
    return { locale, prefix: `/${locale}${segment}` };
  }),
);

/**
 * Runs before every page request: detects the visitor's language, adds the
 * /fr, /en or /de prefix and translates URL segments (/en/arbre →
 * /en/family-tree). Without a session cookie, private areas send straight to
 * the sign-in page; the server and the database check again behind it.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const target = privatePrefixes.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (target && !request.cookies.has(SESSION_COOKIE)) {
    const signIn = routing.pathnames["/connexion"];
    const segment = typeof signIn === "string" ? signIn : signIn[target.locale];
    return NextResponse.redirect(
      new URL(`/${target.locale}${segment}`, request.url),
    );
  }
  return intl(request);
}

export const config = {
  // Every path except API routes, Next.js internals and files with an extension.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
