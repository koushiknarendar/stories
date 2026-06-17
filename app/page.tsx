"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, SignInButton } from "@clerk/nextjs";
import { saveCurrent } from "@/lib/storage";
import { useTheme } from "@/components/ThemeProvider";
import LandingCardStack from "@/components/LandingCardStack";
import LoadingAnimation from "@/components/LoadingAnimation";
import type { StorySet } from "@/lib/types";

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px" }}>
      <LoadingAnimation />
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconSun  = () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx={12} cy={12} r={4.2} /><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" /></svg>;
const IconMoon = () => <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></svg>;

// ─── CSS ──────────────────────────────────────────────────────────────────────

const STYLES = `
  *{box-sizing:border-box}
  .lp-nav{max-width:1100px;margin:0 auto;padding:16px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px}
  .lp-nav-links{display:flex;align-items:center;gap:28px;font-size:14px;font-weight:500;color:var(--lp-text2)}
  .lp-hero{max-width:1100px;margin:0 auto;padding:100px 32px 80px;display:flex;flex-direction:column;align-items:center;text-align:center}
  .lp-h1{font-family:'Space Grotesk',sans-serif;font-weight:700;line-height:1.05;letter-spacing:-0.03em;font-size:clamp(38px,6vw,78px);margin:0;color:var(--lp-text)}
  .lp-sub{font-size:clamp(16px,1.7vw,19px);line-height:1.7;color:var(--lp-text2);max-width:44ch;margin:20px auto 0}
  .lp-card-wrap{width:min(360px,88vw);height:min(560px,70vh);position:relative}
  .lp-steps{max-width:900px;margin:0 auto;padding:72px 32px 80px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;align-items:start}
  .lp-vaul{max-width:1100px;margin:0 auto;padding:80px 32px 96px;display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center}
  .lp-vaul-h2{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:clamp(26px,3.2vw,42px);line-height:1.1;letter-spacing:-0.02em;margin:0 0 16px;color:var(--lp-text)}
  .lp-vaul-p{font-size:clamp(15px,1.3vw,17px);line-height:1.75;color:var(--lp-text2);margin:0}
  .lp-footer{max-width:1100px;margin:0 auto;padding:28px 32px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}

  @media(max-width:800px){
    .lp-nav{padding:14px 20px}
    .lp-nav-links{display:none}
    .lp-hero{padding:72px 20px 60px}
    .lp-steps{grid-template-columns:1fr;gap:28px;padding:56px 20px 64px}
    .lp-vaul{grid-template-columns:1fr;gap:40px;padding:64px 20px 80px;text-align:center}
    .lp-vaul-visual{display:flex;justify-content:center}
    .lp-footer{padding:24px 20px;flex-direction:column;align-items:flex-start;gap:12px}
  }
  @media(max-width:480px){
    .lp-nav{padding:12px 16px}
    .lp-hero{padding:56px 16px 48px}
    .lp-card-wrap{height:400px}
    .lp-steps{padding:40px 16px 52px;gap:24px}
    .lp-vaul{padding:48px 16px 64px}
    .lp-footer{padding:20px 16px}
  }
`;

// ─── Step card ────────────────────────────────────────────────────────────────

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "color-mix(in srgb, var(--lp-accent) 12%, transparent)", border: "1px solid color-mix(in srgb, var(--lp-accent) 22%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 14, color: "var(--lp-accent)" }}>
        {n}
      </div>
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "var(--lp-text)", marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 14.5, color: "var(--lp-text2)", lineHeight: 1.65 }}>{body}</div>
      </div>
    </div>
  );
}

// ─── Saved library mockup ─────────────────────────────────────────────────────

function SavedVisual() {
  const rows = [
    { title: "The Model That Changed Everything",  src: "wired.com",        n: 7 },
    { title: "Why Your Brain Forgets on Purpose",  src: "nautilus.co",      n: 6 },
    { title: "The Attention Economy Is Broken",    src: "aeon.co",          n: 7 },
    { title: "How Figma Killed the Design Stack",  src: "stratechery.com",  n: 5 },
  ];
  return (
    <div style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: "var(--lp-radius-lg)", overflow: "hidden", boxShadow: "var(--lp-shadow), inset 0 1px 0 rgba(255,255,255,0.08)", width: "100%", maxWidth: 420 }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid var(--lp-glass-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lp-text3)" }}>My space</span>
        <span style={{ fontSize: 11, color: "var(--lp-text3)" }}>4 saved</span>
      </div>
      {rows.map(({ title, src, n }, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderBottom: i < rows.length - 1 ? "1px solid var(--lp-glass-border)" : "none" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--lp-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: 11.5, color: "var(--lp-text3)", marginTop: 3 }}>{src}</div>
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--lp-text3)", background: "var(--lp-surface2)", padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 }}>{n} cards</span>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function HomeInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, toggle } = useTheme();
  const { isLoaded, isSignedIn } = useUser();
  const [tab, setTab] = useState<"url" | "text">("url");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoTriggered = useRef(false);

  const generate = useCallback(async (body: { url: string } | { text: string }) => {
    setError(""); setLoading(true);
    try {
      const parseRes = await fetch("/api/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error ?? "Parse failed");

      // YouTube Shorts: parse API returns source="youtube-short", skip card generation
      if (parseData.source === "youtube-short") {
        const storySet: StorySet = {
          id: crypto.randomUUID(),
          title: parseData.title as string ?? "YouTube Short",
          source: "youtube-short",
          sourceUrl: parseData.sourceUrl as string | undefined,
          coverImageUrl: parseData.imageUrl as string | undefined,
          cards: [],
          savedAt: new Date().toISOString(),
        };
        saveCurrent(storySet);
        router.push("/stories");
        return;
      }

      const storiesRes = await fetch("/api/stories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parseData) });
      const storiesText = await storiesRes.text();
      let storiesData: Record<string, unknown>;
      try { storiesData = JSON.parse(storiesText); } catch { throw new Error(`Server error (${storiesRes.status})`); }
      if (!storiesRes.ok) throw new Error((storiesData.error as string) ?? "Generation failed");
      const storySet: StorySet = {
        id: crypto.randomUUID(), title: storiesData.title as string,
        source: storiesData.source as string, sourceUrl: storiesData.sourceUrl as string | undefined,
        coverImageUrl: storiesData.imageUrl as string | undefined,
        category: storiesData.category as string | undefined,
        publishedAt: storiesData.publishedAt as string | undefined ?? undefined,
        cards: storiesData.cards as StorySet["cards"], savedAt: new Date().toISOString(),
      };
      saveCurrent(storySet);
      router.push("/stories");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const u = searchParams.get("url");
    if (u && !autoTriggered.current) { autoTriggered.current = true; setUrl(u); generate({ url: u }); }
  }, [searchParams, generate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "url" && url.trim()) generate({ url: url.trim() });
    if (tab === "text" && pastedText.trim()) generate({ text: pastedText.trim() });
  };

  if (loading) return <LoadingScreen />;

  const SG: React.CSSProperties = { fontFamily: "'Space Grotesk', sans-serif" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: "var(--lp-text)", overflowX: "hidden" }}>
      <style>{STYLES}</style>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", background: "var(--lp-glass-nav)", borderBottom: "1px solid var(--lp-glass-border)" }}>
        <div className="lp-nav">
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ display: "inline-flex", width: 30, height: 30, borderRadius: 8, background: "var(--lp-accent)", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px -6px var(--lp-glow)", flexShrink: 0 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none"><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(-9 12 12)" fill="white" opacity={0.5} /><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(7 12 12)" fill="white" /></svg>
            </span>
            <span style={{ ...SG, fontWeight: 700, fontSize: 19, letterSpacing: "-0.01em" }}>Storis</span>
          </div>
          <div className="lp-nav-links">
            {isLoaded && isSignedIn
              ? <a href="/space" style={{ color: "inherit", textDecoration: "none" }}>My space</a>
              : <a href="/curate" style={{ color: "inherit", textDecoration: "none" }}>Library</a>
            }
            <a href="/install" style={{ color: "inherit", textDecoration: "none" }}>Bookmarklet</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggle} aria-label="Toggle theme" style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: "var(--lp-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            {isLoaded && (
              isSignedIn
                ? <a href="/space" style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: "0 6px 18px -8px var(--lp-glow)", whiteSpace: "nowrap", textDecoration: "none", display: "inline-block" }}>
                    My space
                  </a>
                : <SignInButton>
                    <button style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: "0 6px 18px -8px var(--lp-glow)", whiteSpace: "nowrap" }}>
                      Sign in
                    </button>
                  </SignInButton>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header>
        <div className="lp-hero">
          {/* Eyebrow */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 13px", borderRadius: 999, border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", marginBottom: 28, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lp-accent)", display: "inline-block" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--lp-text2)", letterSpacing: ".02em" }}>Any article → story cards</span>
          </div>

          <h1 className="lp-h1">
            The story inside<br />every link.
          </h1>
          <p className="lp-sub">
            Paste any article and get the key ideas as swipeable cards in seconds. Save what's worth keeping, annotate as you go.
          </p>

          {/* Tab + input */}
          <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 520, marginTop: 36 }}>
            {/* Tabs */}
            <div style={{ display: "inline-flex", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 10, padding: 3, marginBottom: 10, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}>
              {(["url", "text"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setTab(t); setError(""); }}
                  style={{ padding: "6px 18px", borderRadius: 7, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s", fontFamily: "inherit", background: tab === t ? "var(--lp-accent)" : "transparent", color: tab === t ? "#fff" : "var(--lp-text2)" }}
                >
                  {t === "url" ? "Link" : "Text"}
                </button>
              ))}
            </div>

            {tab === "url" ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  type="url"
                  placeholder="Paste a link to any article…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  style={{ flex: 1, minWidth: 220, background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: "var(--lp-radius)", padding: "13px 16px", color: "var(--lp-text)", fontSize: 15, fontFamily: "inherit", outline: "none", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
                />
                <button type="submit" disabled={!url.trim()} style={{ padding: "13px 22px", borderRadius: "var(--lp-radius)", border: "none", background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 26px -8px var(--lp-glow)", fontFamily: "inherit", whiteSpace: "nowrap", opacity: url.trim() ? 1 : 0.5 }}>
                  Get the story →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  autoFocus
                  placeholder="Paste anything — transcript, essay, newsletter, email, notes…"
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  rows={5}
                  style={{ width: "100%", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: "var(--lp-radius)", padding: "13px 16px", color: "var(--lp-text)", fontSize: 15, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", lineHeight: 1.6 }}
                />
                <button type="submit" disabled={pastedText.trim().length < 30} style={{ padding: "13px 22px", borderRadius: "var(--lp-radius)", border: "none", background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 26px -8px var(--lp-glow)", fontFamily: "inherit", opacity: pastedText.trim().length >= 30 ? 1 : 0.5 }}>
                  Turn into cards →
                </button>
              </div>
            )}

            {error && (
              <p style={{ marginTop: 10, fontSize: 13.5, color: "var(--lp-skip)", background: "color-mix(in srgb, var(--lp-skip) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--lp-skip) 25%, transparent)", borderRadius: "var(--lp-radius)", padding: "10px 14px" }}>
                {error}
              </p>
            )}
          </form>

          <p style={{ marginTop: 14, fontSize: 12.5, color: "var(--lp-text3)" }}>
            Free to try · No sign-up needed
          </p>

          {/* Card demo */}
          <div style={{ margin: "52px 0 0", width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="lp-card-wrap">
              <LandingCardStack onProgress={() => {}} />
            </div>
          </div>
        </div>
      </header>

      {/* How it works */}
      <div style={{ borderTop: "1px solid var(--lp-glass-border)", background: "color-mix(in srgb, var(--lp-bg2) 60%, transparent)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)" }}>
        <div className="lp-steps">
          <Step
            n="1"
            title="Drop a link or paste text"
            body="Any URL, or paste raw text directly — transcripts, essays, newsletters, emails, notes."
          />
          <Step
            n="2"
            title="Get story cards"
            body="The key ideas become 7 swipeable cards. Signal without the scroll. Done in under 10 seconds."
          />
          <Step
            n="3"
            title="Save and annotate"
            body="Like a card to save it to your space. Add notes as you read. Pick up exactly where you left off."
          />
        </div>
      </div>

      {/* Value prop */}
      <div style={{ borderTop: "1px solid var(--lp-glass-border)" }}>
        <div className="lp-vaul">
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--lp-accent)", marginBottom: 16 }}>Your space</div>
            <h2 className="lp-vaul-h2">Everything worth reading, in one place.</h2>
            <p className="lp-vaul-p">
              Every story you save lives in My Space — organised, searchable, and always ready to revisit. Add notes on individual cards, edit them anytime, and never lose a good idea again.
            </p>
            {isLoaded && !isSignedIn && (
              <SignInButton>
                <button style={{ marginTop: 28, padding: "11px 22px", borderRadius: "var(--lp-radius)", border: "none", background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 20px -8px var(--lp-glow)", fontFamily: "'Space Grotesk', sans-serif" }}>
                  Start your space — it's free
                </button>
              </SignInButton>
            )}
          </div>
          <div className="lp-vaul-visual">
            <SavedVisual />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--lp-glass-border)" }}>
        <div className="lp-footer">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: 6, background: "var(--lp-accent)", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(7 12 12)" fill="white" /></svg>
            </span>
            <span style={{ ...SG, fontWeight: 700, fontSize: 15 }}>Storis</span>
            <span style={{ fontSize: 12, color: "var(--lp-text3)", marginLeft: 4 }}>© 2026</span>
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: "var(--lp-text2)", fontWeight: 500, flexWrap: "wrap" }}>
            <a href="/curate" style={{ color: "inherit", textDecoration: "none" }}>Library</a>
            <a href="/install" style={{ color: "inherit", textDecoration: "none" }}>Bookmarklet</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}
