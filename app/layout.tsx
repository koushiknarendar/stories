import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Hanken_Grotesk, Space_Grotesk } from "next/font/google";
import DesktopNav from "@/components/DesktopNav";
import DesktopRightPanel from "@/components/DesktopRightPanel";
import "./globals.css";

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-hanken",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://storis.in"),
  title: "Storis — The whole story, in seven swipes",
  description: "Paste a link and get swipeable story cards in seconds. Like Tinder for reading.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // TEMPORARY: ClerkProvider is disabled — the deployed publishable key is a
  // development-instance key that can't attribute requests from this custom
  // domain ("Invalid host" / host_invalid), and clerk-js retried the failing
  // bootstrap fetch on every page load. Every client-side Clerk import in
  // this app now resolves to lib/clerkStub.tsx instead of the real package,
  // so nothing here depends on this provider actually being mounted. Restore
  // it (and swap the stub imports back) once a real Clerk production
  // instance is configured for storis.in.
  return (
      <html lang="en" suppressHydrationWarning className={`h-full ${hanken.variable} ${spaceGrotesk.variable}`}>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-57L9K369');`,
            }}
          />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="manifest" href="/manifest.json" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
          <meta name="theme-color" content="#7C5CFF" />
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()`,
            }}
          />
        </head>
        <body className="min-h-full antialiased">
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-57L9K369"
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
          <ThemeProvider>
            <div className="lp-app-root">
              <DesktopNav />
              <div className="lp-content-col">
                {children}
              </div>
              <DesktopRightPanel />
            </div>
          </ThemeProvider>
        </body>
      </html>
  );
}
