"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import BottomNav from "@/components/BottomNav";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };
const WC_GOLD = "#F5C518";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─── Types from football-data.org ────────────────────────────────────────────

interface FDTeam {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
}

interface FDGoal {
  minute: number;
  team: { name: string };
  scorer: { name: string };
  type: string;
}

interface FDMatch {
  id: number;
  utcDate: string;
  status: "FINISHED" | "IN_PLAY" | "PAUSED" | "TIMED" | "SCHEDULED" | "SUSPENDED" | "POSTPONED";
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: FDTeam;
  awayTeam: FDTeam;
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  goals: FDGoal[];
  minute?: number;
}

interface NewsStory {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  cover_image_url: string | null;
  saved_at: string;
  published_at?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatKickoff(utcDate: string): string {
  const d = new Date(utcDate);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function stageLabel(stage: string, group: string | null): string {
  if (stage === "GROUP_STAGE") return group ? `Group ${group.replace("GROUP_", "")}` : "Group Stage";
  if (stage === "ROUND_OF_16") return "Round of 16";
  if (stage === "QUARTER_FINALS") return "Quarter-final";
  if (stage === "SEMI_FINALS") return "Semi-final";
  if (stage === "FINAL") return "Final";
  return stage.replace(/_/g, " ");
}

function goalList(goals: FDGoal[], teamName: string): string[] {
  return goals
    .filter((g) => g.team.name === teamName && g.type !== "OWN")
    .map((g) => `${g.scorer.name} ${g.minute}'`);
}

function allGoals(goals: FDGoal[]): string[] {
  return goals.map((g) => {
    const og = g.type === "OWN" ? " (og)" : g.type === "PENALTY" ? " (pen)" : "";
    return `${g.scorer.name} ${g.minute}'${og}`;
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── MatchTile ────────────────────────────────────────────────────────────────

function MatchTile({ match, onReadStory, generating }: {
  match: FDMatch;
  onReadStory: (match: FDMatch) => void;
  generating: boolean;
}) {
  const isFinished = match.status === "FINISHED";
  const isLive = match.status === "IN_PLAY" || match.status === "PAUSED";
  const homeGoals = isFinished || isLive ? goalList(match.goals ?? [], match.homeTeam.name) : [];
  const awayGoals = isFinished || isLive ? goalList(match.goals ?? [], match.awayTeam.name) : [];

  return (
    <div style={{
      minWidth: 220, maxWidth: 240, flexShrink: 0,
      background: "var(--lp-surface)",
      border: "1px solid var(--lp-border)",
      borderRadius: 16, padding: "16px 16px 14px",
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      {/* Stage badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--lp-text3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {stageLabel(match.stage, match.group)}
        </span>
        {isLive && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#e53e3e" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e53e3e", animation: "wc-pulse 1.2s ease-in-out infinite" }} />
            LIVE
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Home team */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ ...SG, fontSize: 13, fontWeight: 700, color: "var(--lp-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {match.homeTeam.shortName || match.homeTeam.name}
            </span>
            {homeGoals.length > 0 && (
              <span style={{ fontSize: 9, color: "var(--lp-text3)", lineHeight: 1.3 }}>
                {homeGoals.join(", ")}
              </span>
            )}
          </div>
          <span style={{ ...SG, fontSize: 22, fontWeight: 800, color: isFinished || isLive ? "var(--lp-text)" : "var(--lp-text3)", minWidth: 18, textAlign: "right" }}>
            {isFinished || isLive ? (match.score.fullTime.home ?? 0) : "–"}
          </span>
        </div>

        {/* Away team */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ ...SG, fontSize: 13, fontWeight: 700, color: "var(--lp-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {match.awayTeam.shortName || match.awayTeam.name}
            </span>
            {awayGoals.length > 0 && (
              <span style={{ fontSize: 9, color: "var(--lp-text3)", lineHeight: 1.3 }}>
                {awayGoals.join(", ")}
              </span>
            )}
          </div>
          <span style={{ ...SG, fontSize: 22, fontWeight: 800, color: isFinished || isLive ? "var(--lp-text)" : "var(--lp-text3)", minWidth: 18, textAlign: "right" }}>
            {isFinished || isLive ? (match.score.fullTime.away ?? 0) : "–"}
          </span>
        </div>
      </div>

      {/* Status / CTA */}
      <div style={{ marginTop: 2 }}>
        {isFinished ? (
          <button
            onClick={() => onReadStory(match)}
            disabled={generating}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: 8, border: "none",
              background: generating ? "var(--lp-border)" : "var(--lp-accent)",
              color: generating ? "var(--lp-text3)" : "#fff",
              ...SG, fontSize: 12, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
              transition: "opacity .15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            {generating ? (
              <>
                <span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid var(--lp-text3)", borderTopColor: "transparent", animation: "wc-spin .7s linear infinite", display: "inline-block" }} />
                Generating…
              </>
            ) : "Read Story ⚡"}
          </button>
        ) : isLive ? (
          <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#e53e3e" }}>
            In Progress
          </div>
        ) : (
          <div style={{ textAlign: "center", fontSize: 11, color: "var(--lp-text3)" }}>
            {formatKickoff(match.utcDate)} local
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NewsCard ─────────────────────────────────────────────────────────────────

function NewsCard({ story }: { story: NewsStory }) {
  return (
    <a
      href={`/stories/${story.id}`}
      style={{ display: "block", textDecoration: "none", borderRadius: 14, overflow: "hidden", background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }}
    >
      {story.cover_image_url && (
        <div style={{ height: 120, overflow: "hidden" }}>
          <img src={story.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "12px 14px 14px" }}>
        <p style={{ ...SG, fontSize: 13, fontWeight: 700, color: "var(--lp-text)", margin: "0 0 6px", lineHeight: 1.35 }}>
          {story.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "var(--lp-text3)" }}>{story.source}</span>
          <span style={{ fontSize: 10, color: "var(--lp-border)" }}>·</span>
          <span style={{ fontSize: 10, color: "var(--lp-text3)" }}>{timeAgo(story.published_at ?? story.saved_at)}</span>
        </div>
      </div>
    </a>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorldCupPage() {
  const router = useRouter();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: matchData, isLoading: matchLoading } = useSWR(
    "/api/worldcup",
    fetcher,
    { refreshInterval: 60_000 }
  );

  const { data: newsData, isLoading: newsLoading } = useSWR(
    "/api/worldcup/news",
    fetcher
  );

  const matches: FDMatch[] = Array.isArray(matchData?.matches) ? matchData.matches : [];
  const news: NewsStory[] = Array.isArray(newsData?.stories) ? newsData.stories : [];

  // Sort: live first, then by date desc (recent finished → upcoming)
  const sortedMatches = [...matches].sort((a, b) => {
    const priority = (m: FDMatch) =>
      m.status === "IN_PLAY" || m.status === "PAUSED" ? 0
      : m.status === "FINISHED" ? 1
      : 2;
    const pd = priority(a) - priority(b);
    if (pd !== 0) return pd;
    return new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime();
  });

  async function handleReadStory(match: FDMatch) {
    setError(null);
    setGeneratingId(match.id);
    try {
      const res = await fetch("/api/worldcup/recap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          homeScore: match.score.fullTime.home ?? 0,
          awayScore: match.score.fullTime.away ?? 0,
          stage: stageLabel(match.stage, match.group),
          date: match.utcDate,
          goals: allGoals(match.goals ?? []),
          group: match.group ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to generate recap");
      router.push(`/stories/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGeneratingId(null);
    }
  }

  const hasMatches = sortedMatches.length > 0;
  const hasNews = news.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: "var(--lp-text)", paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>

      <style>{`
        @keyframes wc-spin  { to { transform: rotate(360deg); } }
        @keyframes wc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, #004C97 0%, #002D62 60%, #001a38 100%)`,
        padding: "calc(env(safe-area-inset-top, 0px) + 32px) 20px 28px",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative football pattern */}
        <div style={{ position: "absolute", top: -30, right: -30, fontSize: 120, opacity: 0.06, userSelect: "none", lineHeight: 1 }}>⚽</div>
        <div style={{ position: "absolute", bottom: -20, left: -20, fontSize: 80, opacity: 0.04, userSelect: "none", lineHeight: 1 }}>⚽</div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 28 }}>⚽</span>
            <div>
              <div style={{ ...SG, fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                World Cup 2026
              </div>
              <div style={{ fontSize: 11, color: WC_GOLD, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                USA · Canada · Mexico
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0, lineHeight: 1.4 }}>
            Tap any finished match to read its story in 5 cards
          </p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ margin: "12px 16px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(229,62,62,0.12)", border: "1px solid rgba(229,62,62,0.3)", fontSize: 12, color: "#e53e3e" }}>
          {error}
        </div>
      )}

      {/* ── Match Ticker ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "24px 0 0" }}>
        <div style={{ padding: "0 20px", display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ ...SG, fontSize: 16, fontWeight: 700, margin: 0, color: "var(--lp-text)" }}>
            Matches
          </h2>
          {hasMatches && (
            <span style={{ fontSize: 11, color: "var(--lp-text3)" }}>
              Yesterday · Today · Tomorrow
            </span>
          )}
        </div>

        {matchLoading ? (
          <div style={{ padding: "0 20px", display: "flex", gap: 12 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{ minWidth: 220, height: 160, borderRadius: 16, background: "var(--lp-surface)", border: "1px solid var(--lp-border)", flexShrink: 0 }} />
            ))}
          </div>
        ) : matchData?.error ? (
          <div style={{ padding: "12px 20px" }}>
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "var(--lp-surface)", border: "1px solid var(--lp-border)", fontSize: 12, color: "var(--lp-text3)" }}>
              <strong style={{ color: "var(--lp-text)" }}>Live scores unavailable</strong>
              <br />Add <code>FOOTBALL_DATA_API_KEY</code> to your env to enable this.
            </div>
          </div>
        ) : !hasMatches ? (
          <div style={{ padding: "12px 20px", fontSize: 13, color: "var(--lp-text3)" }}>
            No matches scheduled for today.
          </div>
        ) : (
          <div style={{
            display: "flex", gap: 12, overflowX: "auto",
            padding: "0 20px 4px",
            scrollbarWidth: "none",
          }}>
            {sortedMatches.map((match) => (
              <MatchTile
                key={match.id}
                match={match}
                onReadStory={handleReadStory}
                generating={generatingId === match.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── World Cup News ────────────────────────────────────────────────────── */}
      <div style={{ padding: "32px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ ...SG, fontSize: 16, fontWeight: 700, margin: 0, color: "var(--lp-text)" }}>
            WC Stories
          </h2>
          <span style={{ fontSize: 11, color: "var(--lp-text3)" }}>Auto-curated</span>
        </div>

        {newsLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 180, borderRadius: 14, background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }} />
            ))}
          </div>
        ) : !hasNews ? (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "var(--lp-text3)", lineHeight: 1.6 }}>
              Fetching the latest World Cup stories…
              <br />
              <span style={{ fontSize: 11 }}>This may take a moment on first load.</span>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {news.map((story) => (
              <NewsCard key={story.id} story={story} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
