import type { Metadata } from "next";

const TITLE       = "FIFA World Cup 2026 — Live Hub | Storis";
const DESCRIPTION = "Live scores, AI match recaps, lineup predictions, standings and top scorers for every FIFA World Cup 2026 match. USA · Canada · Mexico.";
const OG_IMAGE    = "https://storis.in/api/og/worldcup";
const PAGE_URL    = "https://storis.in/fifa-worldcup-2026";

export const metadata: Metadata = {
  title:       TITLE,
  description: DESCRIPTION,
  metadataBase: new URL("https://storis.in"),

  openGraph: {
    type:        "website",
    url:         PAGE_URL,
    title:       "FIFA World Cup 2026 Live Hub",
    description: DESCRIPTION,
    siteName:    "Storis",
    images: [
      {
        url:    OG_IMAGE,
        width:  1200,
        height: 630,
        alt:    "FIFA World Cup 2026 — Live scores, AI recaps and lineup predictions on Storis",
      },
    ],
  },

  twitter: {
    card:        "summary_large_image",
    title:       "FIFA World Cup 2026 Live Hub",
    description: DESCRIPTION,
    images:      [OG_IMAGE],
    site:        "@storis_in",
  },

  keywords: [
    "FIFA World Cup 2026", "World Cup 2026", "WC 2026",
    "live scores", "match recap", "lineup prediction",
    "USA Canada Mexico", "football 2026",
  ],
};

export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
