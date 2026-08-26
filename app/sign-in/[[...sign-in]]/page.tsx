import { redirect } from "next/navigation";

// TEMPORARY: the deployed Clerk publishable key is a development-instance key,
// which can't attribute requests from this custom domain ("Invalid host" /
// host_invalid) — the client SDK never finishes loading, so <SignIn/> here
// hung forever. Redirect home until a proper Clerk production instance is
// configured for storis.in.
export default function SignInPage() {
  redirect("/");
}
