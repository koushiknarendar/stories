import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

const isProtected = createRouteMatcher(["/space(.*)", "/collections(.*)", "/inbox(.*)", "/foryou(.*)", "/explore(.*)", "/profile(.*)"]);

export const proxy = clerkMiddleware(async (auth, request) => {
  if (isProtected(request as NextRequest)) {
    // TEMPORARY: the deployed Clerk publishable key is a development-instance
    // key, which can't attribute requests from this custom domain ("Invalid
    // host" / host_invalid) — the client SDK never finishes loading, so the
    // dedicated /sign-in page hangs forever. Send guests home instead of into
    // that dead end until a proper Clerk production instance is configured.
    await auth.protect({ unauthenticatedUrl: new URL("/", request.url).toString() });
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
