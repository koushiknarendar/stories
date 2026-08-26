"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthReady } from "@/lib/useAuthReady";
import useSWR from "swr";
import BottomNav from "@/components/BottomNav";
import { CATEGORIES } from "@/lib/categories";

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

function formatStoryDate(published_at: string | null | undefined, saved_at: string): string {
  if (published_at) {
    try {
      return new Date(published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {}
  }
  const diff = Date.now() - new Date(saved_at).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SkeletonCard() {
  return (
    <div style={{ height: 180, borderRadius: 16, background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }} />
  );
}

function StoryList({ stories, SG, formatStoryDate }: {
  stories: StoryItem[];
  SG: React.CSSProperties;
  formatStoryDate: (published_at: string | null | undefined, saved_at: string) => string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {stories.map((story) => {
        const img = story.cover_image_url || `https://picsum.photos/seed/${story.id}/800/500`;
        return (
          <a
            key={story.id}
            href={`/stories/${story.id}`}
            style={{ textDecoration: "none", display: "block", borderRadius: 20, overflow: "hidden", position: "relative", height: 220, boxShadow: "0 8px 28px -8px rgba(0,0,0,0.18)" }}
          >
            <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${img})`, backgroundSize: "cover", backgroundPosition: "center" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0.72) 100%)" }} />
            <div style={{ position: "absolute", top: 14, left: 14 }}>
              <span style={{ ...SG, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", color: "#fff", background: story.source === "Storis AI" ? "rgba(124,92,255,0.8)" : "rgba(34,197,94,0.75)", padding: "4px 9px", borderRadius: 999, backdropFilter: "blur(8px)" }}>
                {story.source === "Storis AI" ? "✦ AI" : "NEW"}
              </span>
            </div>
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px" }}>
              <p style={{ ...SG, fontSize: 16, fontWeight: 700, color: "#fff", margin: "0 0 6px", lineHeight: 1.3, letterSpacing: "-0.01em" }}>{story.title}</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                  {story.source_url ? (() => { try { return new URL(story.source_url).hostname.replace("www.", ""); } catch { return story.source; } })() : story.source}
                  {" · "}{formatStoryDate(story.published_at, story.saved_at)}
                </span>
                <span style={{ ...SG, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", background: "rgba(255,255,255,0.18)", padding: "3px 9px", borderRadius: 999, backdropFilter: "blur(8px)" }}>
                  Read →
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export default function ExplorePage() {
  const { user, isLoaded } = useAuthReady();
  const [active, setActive] = useState<string>(CATEGORIES[0].key);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [generating, setGenerating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const isSearchMode = debouncedQuery.length >= 2;

  const { data, isLoading } = useSWR(
    !isSearchMode && user ? `/api/discover?category=${active}` : null,
    fetcher
  );
  const { data: searchData, isLoading: searchLoading } = useSWR(
    isSearchMode ? `/api/search?q=${encodeURIComponent(debouncedQuery)}` : null,
    fetcher
  );

  const stories: StoryItem[] = Array.isArray(data?.stories) ? data.stories : [];
  const searchResults: StoryItem[] = Array.isArray(searchData?.stories) ? searchData.stories : [];

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}&generate=true`);
      const d = await res.json();
      if (d.generated) { window.location.href = `/stories/${d.generated}`; return; }
    } catch {}
    setGenerating(false);
  }

  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--lp-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--lp-border)", borderTopColor: "var(--lp-accent)", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) {
    if (typeof window !== "undefined") window.location.href = "/";
    return null;
  }

  const activeCat = CATEGORIES.find((c) => c.key === active);

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: "var(--lp-text)", paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Sticky header + search + category pills */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", background: "var(--lp-glass-nav)", borderBottom: "1px solid var(--lp-glass-border)" }}>
        <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 18px) 20px 12px" }}>
          <h1 style={{ ...SG, fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 12px", color: "var(--lp-text)" }}>Explore</h1>
          {/* Search bar */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <svg style={{ position: "absolute", left: 12, pointerEvents: "none", flexShrink: 0 }} width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="var(--lp-text3)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={11} cy={11} r={8}/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search any topic…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "10px 36px 10px 34px", borderRadius: 12, border: "1.5px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: "var(--lp-text)", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }} style={{ position: "absolute", right: 10, background: "none", border: "none", padding: 4, cursor: "pointer", color: "var(--lp-text3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
        </div>
        {!isSearchMode && (
          <div style={{ padding: "0 16px 14px", overflowX: "auto", display: "flex", gap: 8, scrollbarWidth: "none" }}>
          {CATEGORIES.map(({ key, label, emoji }) => {
            const isActive = key === active;
            const isWC = key === "worldcup";
            const activeColor = isWC ? "#F5C518" : "var(--lp-accent)";
            return (
              <button
                key={key}
                onClick={() => key === "worldcup" ? (window.location.href = "/fifa-worldcup-2026") : setActive(key)}
                style={{
                  ...SG,
                  flexShrink: 0,
                  padding: "7px 16px",
                  borderRadius: 999,
                  border: `1.5px solid ${isActive ? activeColor : isWC ? "rgba(245,197,24,0.4)" : "var(--lp-glass-border)"}`,
                  background: isWC ? "rgba(245,197,24,0.1)" : isActive ? "color-mix(in srgb, var(--lp-accent) 14%, transparent)" : "var(--lp-glass-surface)",
                  backdropFilter: "var(--lp-glass-blur-card)",
                  WebkitBackdropFilter: "var(--lp-glass-blur-card)",
                  color: isWC ? "#F5C518" : isActive ? "var(--lp-accent)" : "var(--lp-text2)",
                  fontWeight: isWC || isActive ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all .15s",
                }}
              >
                {emoji} {label}{isWC ? " 🔴" : ""}
              </button>
            );
          })}
        </div>
        )}
      </div>

      {/* Stories / Search results */}
      <div style={{ padding: "16px 16px 0" }}>
        {isSearchMode ? (
          searchLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <SkeletonCard /><SkeletonCard />
            </div>
          ) : searchResults.length > 0 ? (
            <>
              <p style={{ fontSize: 12, color: "var(--lp-text3)", margin: "0 0 14px" }}>{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{debouncedQuery}&rdquo;</p>
              <StoryList stories={searchResults} SG={SG} formatStoryDate={formatStoryDate} />
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "52px 20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <p style={{ ...SG, fontSize: 15, fontWeight: 600, color: "var(--lp-text)", margin: "0 0 6px" }}>No stories on &ldquo;{debouncedQuery}&rdquo; yet</p>
              <p style={{ fontSize: 13, color: "var(--lp-text3)", margin: "0 0 24px" }}>Generate a fresh 7-card brief on this topic with AI</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{ ...SG, padding: "13px 28px", borderRadius: 14, border: "none", background: generating ? "var(--lp-surface)" : "var(--lp-accent)", color: generating ? "var(--lp-text3)" : "#fff", fontWeight: 700, fontSize: 14, cursor: generating ? "default" : "pointer", boxShadow: generating ? "none" : "0 8px 24px -8px rgba(124,92,255,0.55)", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {generating ? (
                  <>
                    <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid var(--lp-text3)", borderTopColor: "transparent", animation: "spin .7s linear infinite", display: "inline-block" }} />
                    Generating…
                  </>
                ) : (
                  <>✦ Generate cards on &ldquo;{debouncedQuery}&rdquo;</>
                )}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )
        ) : isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SkeletonCard /><SkeletonCard />
          </div>
        ) : stories.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>{activeCat?.emoji}</div>
            <p style={{ ...SG, fontSize: 15, color: "var(--lp-text2)", margin: 0 }}>No stories yet for {activeCat?.label} — check back soon.</p>
          </div>
        ) : (
          <StoryList stories={stories} SG={SG} formatStoryDate={formatStoryDate} />
        )}
      </div>

      <BottomNav />
    </div>
  );
}
