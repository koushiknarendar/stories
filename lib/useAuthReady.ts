"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

// TEMPORARY: the deployed Clerk publishable key is a development-instance
// key, which can't attribute requests from this custom domain — the client
// SDK never finishes loading, so `isLoaded` from useUser() never becomes
// true. Pages that block their entire render on `isLoaded` would spin
// forever; this treats "still not loaded after a short grace period" the
// same as "not signed in" so they fall through to their existing guest
// handling instead. Safe to remove once a proper Clerk production instance
// is configured — with a healthy Clerk, isLoaded resolves quickly and this
// timeout never fires.
export function useAuthReady(timeoutMs = 2500) {
  const { isLoaded, ...rest } = useUser();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const t = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [isLoaded, timeoutMs]);

  return { ...rest, isLoaded: isLoaded || timedOut };
}
