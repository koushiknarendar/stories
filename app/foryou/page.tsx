"use client";

import { useMemo } from "react";
import { useRef } from "react";
import { useAuthReady } from "@/lib/useAuthReady";
import useSWR, { useSWRConfig } from "swr"; // useSWRConfig used for interests onboarding
import BottomNav from "@/components/BottomNav";
import InterestsOnboarding from "@/components/InterestsOnboarding";
import { CATEGORIES } from "@/lib/categories";

const SG_WC: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

interface WCMatch {
  id: number;
  status: string;
  homeTeam: { shortName: string };
  awayTeam: { shortName: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

function WCPromoSlide() {
  const { data } = useSWR("/api/worldcup", (url: string) => fetch(url).then(r => r.json()), { revalidateOnFocus: false });
  const matches: WCMatch[] = Array.isArray(data?.matches) ? data.matches : [];
  const finished = matches.filter(m => m.status === "FINISHED");
  const live = matches.filter(m => m.status === "IN_PLAY" || m.status === "PAUSED");
  const upcoming = matches.filter(m => m.status === "TIMED" || m.status === "SCHEDULED");

  return (
    <div style={{
      height: "100dvh", scrollSnapAlign: "start", scrollSnapStop: "always",
      position: "relative", overflow: "hidden", flexShrink: 0,
      background: "linear-gradient(160deg, #004C97 0%, #002D62 55%, #001025 100%)",
    }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(245,197,24,0.06)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "calc(env(safe-area-inset-top, 0px) + 18px) 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: 6, background: "var(--lp-accent)", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px -4px rgba(124,92,255,0.6)", flexShrink: 0 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(-9 12 12)" fill="white" opacity={0.5} /><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(7 12 12)" fill="white" /></svg>
          </span>
          <span style={{ ...SG_WC, fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}>Storis</span>
        </div>
        {live.length > 0 && (
          <span style={{ display: "flex", alignItems: "center", gap: 5, ...SG_WC, fontSize: 11, fontWeight: 700, color: "#e53e3e", background: "rgba(229,62,62,0.15)", border: "1px solid rgba(229,62,62,0.3)", padding: "4px 10px", borderRadius: 999 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e53e3e", animation: "wcpulse 1.2s ease-in-out infinite" }} />
            {live.length} LIVE
          </span>
        )}
      </div>

      {/* Main content */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 22px calc(100px + env(safe-area-inset-bottom, 0px) + 16px)" }}>
        {/* Badge */}
        <div style={{ marginBottom: 14 }}>
          <span style={{ ...SG_WC, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "#F5C518", textTransform: "uppercase" }}>
            ⚽ FIFA World Cup 2026
          </span>
        </div>

        {/* Headline */}
        <h2 style={{ ...SG_WC, fontSize: "clamp(28px,7vw,42px)", fontWeight: 800, color: "#fff", lineHeight: 1.05, letterSpacing: "-0.03em", margin: "0 0 10px", textShadow: "0 2px 16px rgba(0,0,0,0.5)" }}>
          {live.length > 0
            ? `${live.length} match${live.length > 1 ? "es" : ""} live right now`
            : finished.length > 0
            ? `${finished.length} match${finished.length > 1 ? "es" : ""} played today`
            : upcoming.length > 0
            ? `${upcoming.length} match${upcoming.length > 1 ? "es" : ""} coming up`
            : "48 nations. 104 matches."}
        </h2>

        {/* Recent scores strip */}
        {finished.slice(0, 3).length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
            {finished.slice(0, 3).map(m => (
              <div key={m.id} style={{ ...SG_WC, fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.12)", padding: "5px 10px", borderRadius: 8, backdropFilter: "blur(8px)" }}>
                {m.homeTeam.shortName} {m.score.fullTime.home}–{m.score.fullTime.away} {m.awayTeam.shortName}
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", margin: "0 0 22px", lineHeight: 1.5 }}>
          Get the full story of any match in 5 cards — powered by AI
        </p>

        {/* CTA */}
        <a
          href="/fifa-worldcup-2026"
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 24px", borderRadius: 14, background: "#F5C518", color: "#001a38", textDecoration: "none", ...SG_WC, fontWeight: 800, fontSize: 14, letterSpacing: "-0.01em", boxShadow: "0 4px 20px -4px rgba(245,197,24,0.5)", width: "fit-content", transition: "transform .15s" }}
          onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.03)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
        >
          See Full Coverage
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>

      {/* Swipe hint */}
      <div style={{ position: "absolute", bottom: "calc(90px + env(safe-area-inset-bottom, 0px) + 80px)", left: 0, right: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none", opacity: 0.4 }}>
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        <span style={{ fontSize: 10, color: "white", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>Swipe up</span>
      </div>

      <style>{`@keyframes wcpulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

interface StoryItem {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  cover_image_url: string | null;
  category: string | null;
  saved_at: string;
  published_at?: string | null;
  is_generated?: boolean;
}

function CategoryEmoji({ cat }: { cat: string | null }) {
  const found = CATEGORIES.find((c) => c.key === cat);
  if (!found) return null;
  return <>{found.emoji} {found.label}</>;
}

function StorySlide({
  story,
  index,
  total,
  onRead,
}: {
  story: StoryItem;
  index: number;
  total: number;
  onRead: (id: string) => void;
}) {
  const img = story.cover_image_url || `https://picsum.photos/seed/${story.id}/800/1200`;

  return (
    <div
      style={{
        height: "100dvh",
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Cover */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${img})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Gradient overlays */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.85) 75%, rgba(0,0,0,0.97) 100%)" }} />

      {/* Top bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "calc(env(safe-area-inset-top, 0px) + 18px) 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ display: "inline-flex", width: 26, height: 26, borderRadius: 6, background: "var(--lp-accent)", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px -4px rgba(124,92,255,0.6)", flexShrink: 0 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none"><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(-9 12 12)" fill="white" opacity={0.5} /><rect x={6.5} y={4.5} width={11} height={15} rx={2.6} transform="rotate(7 12 12)" fill="white" /></svg>
          </span>
          <span style={{ ...SG, fontWeight: 700, fontSize: 15, color: "rgba(255,255,255,0.92)", letterSpacing: "-0.01em" }}>Storis</span>
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontWeight: 500 }}>{index + 1} / {total}</span>
      </div>

      {/* Bottom content */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, padding: "0 20px calc(90px + env(safe-area-inset-bottom, 0px) + 16px)" }}>
        {/* Badges */}
        <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
          {story.category && (
            <span style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.14)", padding: "5px 11px", borderRadius: 999, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
              <CategoryEmoji cat={story.category} />
            </span>
          )}
          {story.is_generated && (
            <span style={{ ...SG, fontSize: 11, fontWeight: 700, color: "#fff", background: "rgba(34,197,94,0.7)", padding: "5px 10px", borderRadius: 999, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
              FRESH
            </span>
          )}
        </div>

        {/* Title */}
        <h2 style={{ ...SG, fontSize: "clamp(22px,5.5vw,32px)", fontWeight: 800, color: "#fff", lineHeight: 1.08, letterSpacing: "-0.025em", margin: "0 0 10px", textShadow: "0 2px 12px rgba(0,0,0,0.9)" }}>
          {story.title}
        </h2>

        {/* Source + date */}
        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: "0 0 18px", fontWeight: 500 }}>
          {story.source_url ? (() => { try { return new URL(story.source_url).hostname.replace("www.", ""); } catch { return story.source; } })() : story.source}
          {story.published_at && (() => { try { return " · " + new Date(story.published_at!).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch { return ""; } })()}
        </p>

        {/* CTA */}
        <a
          href={`/stories/${story.id}`}
          onClick={() => onRead(story.id)}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 22px", borderRadius: 14, background: "rgba(255,255,255,0.95)", color: "#111", textDecoration: "none", ...SG, fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em", boxShadow: "0 4px 18px -4px rgba(0,0,0,0.35)", transition: "transform .15s" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          Read cards
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>

      {/* Swipe hint (only on first slide) */}
      {index === 0 && (
        <div style={{ position: "absolute", bottom: "calc(90px + env(safe-area-inset-bottom, 0px) + 80px)", left: 0, right: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none", opacity: 0.5 }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          <span style={{ fontSize: 10, color: "white", fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase" }}>Swipe up</span>
        </div>
      )}
    </div>
  );
}

function SkeletonSlide() {
  return (
    <div style={{ height: "100dvh", scrollSnapAlign: "start", flexShrink: 0, background: "var(--lp-surface)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--lp-border)", borderTopColor: "var(--lp-accent)", animation: "spin 0.7s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

export default function ForYouPage() {
  const { user, isLoaded } = useAuthReady();
  const containerRef = useRef<HTMLDivElement>(null);
  const { mutate } = useSWRConfig();

  const { data: interestsData } = useSWR(user ? "/api/interests" : null, fetcher);
  const interests: string[] | null = interestsData === undefined ? null : (Array.isArray(interestsData) ? interestsData : []);

  const { data: spaceData } = useSWR(interests !== null ? "/api/space" : null, fetcher);

  const stories = useMemo<StoryItem[] | null>(() => {
    if (!spaceData) return null;
    const saved: StoryItem[] = Array.isArray(spaceData) ? spaceData : [];
    const seenUrls = new Set<string>();
    const result: StoryItem[] = [];
    const relevantSaved = saved.filter((s) => interests!.length === 0 || (s.category && interests!.includes(s.category)));
    const otherSaved    = saved.filter((s) => !relevantSaved.includes(s));
    for (const s of [...relevantSaved, ...otherSaved]) {
      if (s.source_url && seenUrls.has(s.source_url)) continue;
      if (s.source_url) seenUrls.add(s.source_url);
      result.push(s);
    }
    return result;
  }, [spaceData, interests]);

  const handleRead = (storySetId: string) => {
    fetch("/api/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storySetId }),
    }).catch(() => {});
  };

  if (!isLoaded || (user && interests === null)) {
    return (
      <div style={{ height: "100dvh", background: "var(--lp-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--lp-border)", borderTopColor: "var(--lp-accent)", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/";
    return null;
  }

  if (interests !== null && interests.length === 0) {
    return (
      <InterestsOnboarding
        onComplete={(cats) => mutate("/api/interests", cats, { revalidate: false })}
      />
    );
  }

  return (
    <div style={{ position: "relative", height: "100dvh", background: "var(--lp-bg)" }}>
      <div
        ref={containerRef}
        className="feed-snap"
        style={{
          height: "100dvh",
          overflowY: "scroll",
          scrollSnapType: "y mandatory",
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {stories === null ? (
          <>
            <WCPromoSlide />
            <SkeletonSlide />
            <SkeletonSlide />
          </>
        ) : stories.length === 0 ? (
          <div style={{ height: "100dvh", scrollSnapAlign: "start", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 32px", textAlign: "center", background: "var(--lp-page-bg)" }}>
            <div style={{ fontSize: 48, marginBottom: 18 }}>📚</div>
            <p style={{ ...SG, fontSize: 18, fontWeight: 700, color: "var(--lp-text)", margin: "0 0 8px" }}>Nothing saved yet</p>
            <p style={{ fontSize: 14, color: "var(--lp-text2)", margin: "0 0 28px", lineHeight: 1.6 }}>Save articles from Explore or add your own via the + button.</p>
            <a href="/explore" style={{ ...SG, padding: "12px 28px", borderRadius: 12, background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 14px -4px var(--lp-glow)" }}>
              Explore →
            </a>
          </div>
        ) : (
          <>
            <WCPromoSlide />
            {stories.map((story, i) => (
              <StorySlide
                key={story.id}
                story={story}
                index={i}
                total={stories.length}
                onRead={handleRead}
              />
            ))}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
