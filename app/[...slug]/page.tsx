import { notFound, redirect } from "next/navigation";

// Matches a domain-like first segment, e.g. "example.com" or "sub.example.co.uk"
const looksLikeDomain = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export default async function UrlCatchAll({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  let raw = slug.join("/");
  // Some HTTP clients encode ':' as '%3A' when following 308 redirects — fix it
  raw = raw.replace(/^(https?)%3A/i, "$1:");
  // Vercel collapses // in paths (308 redirect), so we get "https:/domain.com" — restore the slash
  const isExplicitUrl = /^https?:\//.test(raw);
  if (!isExplicitUrl && !looksLikeDomain.test(slug[0] ?? "")) {
    // Not a pasted link (e.g. an internal fallback path like Clerk's not-found rewrite) — real 404.
    notFound();
  }
  const url = isExplicitUrl
    ? raw.replace(/^(https?:\/)([^/])/, "$1/$2")
    : "https://" + raw;
  redirect("/?url=" + encodeURIComponent(url));
}
