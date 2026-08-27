"use client";

import type { ReactNode } from "react";

// TEMPORARY stand-in for the @clerk/nextjs CLIENT exports while storis.in is
// deployed with a development-instance Clerk key that can't attribute
// requests from this custom domain ("Invalid host" / host_invalid). The real
// clerk-js SDK retries this failing bootstrap fetch on every page load,
// which is harmless to visitors but never stops logging a console error.
//
// This stub is swapped in for every CLIENT import site so clerk-js never
// loads at all — zero network calls, zero console errors — while every
// call site keeps behaving exactly like "signed out", which the app already
// treats as a fully supported state everywhere. Server-side auth()
// (@clerk/nextjs/server, used in API routes) is untouched — that talks to
// Clerk's Backend API directly and isn't affected by this issue.
//
// Revert: change these import specifiers back to "@clerk/nextjs" and restore
// <ClerkProvider> in app/layout.tsx once a real Clerk production instance is
// configured for storis.in.

export function useUser() {
  // Typed loosely (not `null`) so property access like `user.imageUrl` at
  // call sites still type-checks — `user` is always null at runtime here.
  return { isLoaded: true, isSignedIn: false, user: null as unknown as { imageUrl: string; firstName: string | null; lastName: string | null; emailAddresses: { emailAddress: string }[] } | null };
}

export function useClerk() {
  return { openSignIn: () => {}, signOut: async () => {} };
}

export function SignInButton(_props: { children?: ReactNode; mode?: string }) {
  return null;
}

export function SignOutButton({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
