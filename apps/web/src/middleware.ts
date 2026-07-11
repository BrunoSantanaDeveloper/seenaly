import { type NextRequest, NextResponse } from "next/server";

import { DEFAULTS } from "@/config";
import { updateSession } from "@flyee/auth/middleware";

// Prefixes reachable without a session. Everything else requires auth
// once Supabase is configured (without it, the middleware no-ops and the
// whole template stays browsable). Every route under app/(marketing) must
// be listed here.
const PUBLIC_PREFIXES = [
  "/auth",
  "/verify",
  "/pricing",
  "/about",
  "/contact",
  "/legal",
  "/help",
  "/blog",
  // SEO surfaces crawlers hit anonymously.
  "/sitemap.xml",
  "/robots.txt",
  "/opengraph-image",
];

const isPublic = (pathname: string) =>
  pathname === "/" || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

export async function middleware(request: NextRequest) {
  const { response, user, needsMfa } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Users with a verified TOTP factor must complete the challenge before
  // reaching anything protected (their session is still AAL1).
  if (user && needsMfa && !isPublic(pathname)) {
    const twoFactor = new URL("/auth/two-factor", request.url);
    twoFactor.searchParams.set("next", pathname);
    return NextResponse.redirect(twoFactor);
  }

  // Signed-in users don't need the sign-in/sign-up screens.
  if (user && !needsMfa && (pathname.startsWith("/auth/sign-in") || pathname.startsWith("/auth/sign-up"))) {
    return NextResponse.redirect(new URL(DEFAULTS.appRoot, request.url));
  }

  if (!user && !isPublic(pathname)) {
    const signIn = new URL("/auth/sign-in", request.url);
    signIn.searchParams.set("next", pathname);
    return NextResponse.redirect(signIn);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets and image optimization; run everywhere else.
    "/((?!_next/static|_next/image|favicon|images|initial-loader|assets|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
