"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import BottomNav from "@/components/BottomNav";
import { useTheme } from "@/components/ThemeProvider";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };
const WC_GOLD = "#F5C518";
const WC_BLUE  = "#004C97";
const fetcher  = (url: string) => fetch(url).then((r) => r.json());

// ─── Types ────────────────────────────────────────────────────────────────────

interface FDTeam { id: number; name: string; shortName: string; tla: string; crest: string; }
interface FDGoal { minute: number; team: { name: string }; scorer: { name: string }; type: string; }
interface FDMatch {
  id: number; utcDate: string;
  status: "FINISHED" | "IN_PLAY" | "PAUSED" | "TIMED" | "SCHEDULED" | "SUSPENDED" | "POSTPONED";
  matchday: number; stage: string; group: string | null;
  homeTeam: FDTeam; awayTeam: FDTeam;
  score: { winner: string | null; fullTime: { home: number | null; away: number | null }; halfTime: { home: number | null; away: number | null } };
  goals: FDGoal[];
}
interface FDStandingRow {
  position: number;
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedGames: number; won: number; draw: number; lost: number;
  points: number; goalsFor: number; goalsAgainst: number; goalDifference: number;
}
interface FDGroup { stage: string; type: string; group: string | null; table: FDStandingRow[]; }
interface FDScorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  goals: number; assists: number; penalties: number;
}
interface NewsStory {
  id: string; title: string; source: string; source_url: string | null;
  cover_image_url: string | null; saved_at: string; published_at?: string | null;
}
interface LineupTeam { formation: string; gk: string[]; def: string[]; mid: string[]; att: string[]; }
interface LineupData { home: LineupTeam; away: LineupTeam; keyBattle: string; tip: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(d: Date) { return d.toISOString().split("T")[0]; }
function stageLabel(stage: string, group: string | null) {
  if (stage === "GROUP_STAGE") return group ? `Group ${group.replace("GROUP_", "")}` : "Group Stage";
  if (stage === "ROUND_OF_16") return "Round of 16";
  if (stage === "QUARTER_FINALS") return "Quarter-final";
  if (stage === "SEMI_FINALS") return "Semi-final";
  if (stage === "FINAL") return "Final";
  return stage.replace(/_/g, " ");
}
function goalList(goals: FDGoal[], teamName: string) {
  return (goals ?? []).filter(g => g.team.name === teamName && g.type !== "OWN").map(g => `${g.scorer.name} ${g.minute}'`);
}
function allGoals(goals: FDGoal[]) {
  return (goals ?? []).map(g => `${g.scorer.name} ${g.minute}'${g.type === "OWN" ? " (og)" : g.type === "PENALTY" ? " (pen)" : ""}`);
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`;
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(utcDate: string) {
  const [ms, setMs] = useState(() => Math.max(0, new Date(utcDate).getTime() - Date.now()));
  useEffect(() => {
    const tick = () => setMs(Math.max(0, new Date(utcDate).getTime() - Date.now()));
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [utcDate]);
  return ms;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return "Kickoff";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

// ─── Crest image ──────────────────────────────────────────────────────────────

function Crest({ src, size = 22 }: { src: string; size?: number }) {
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: "contain", flexShrink: 0 }}
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

// ─── Pitch display ────────────────────────────────────────────────────────────

function PitchRow({ players, color }: { players: string[]; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-around", gap: 4, padding: "6px 8px" }}>
      {players.map((name, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flex: 1, minWidth: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: color, border: "2px solid rgba(255,255,255,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: "#fff" }}>{name.split(" ").pop()?.slice(0, 3).toUpperCase()}</span>
          </div>
          <span style={{ fontSize: 9, color: "#fff", textAlign: "center", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 52 }}>{name.split(" ").pop()}</span>
        </div>
      ))}
    </div>
  );
}

function Pitch({ lineup, homeTeam, awayTeam }: { lineup: LineupData; homeTeam: string; awayTeam: string }) {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", background: "#2d6a2d", position: "relative" }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "50%", left: "5%", right: "5%", height: 1, background: "rgba(255,255,255,0.2)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 60, height: 60, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.15)" }} />
      </div>
      <div style={{ padding: "10px 4px 4px" }}>
        <div style={{ ...SG, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
          {homeTeam} · {lineup.home.formation}
        </div>
        <PitchRow players={lineup.home.att} color={WC_BLUE} />
        {lineup.home.mid.length > 0 && <PitchRow players={lineup.home.mid} color={WC_BLUE} />}
        <PitchRow players={lineup.home.def} color={WC_BLUE} />
        <PitchRow players={lineup.home.gk} color="#1a4a8a" />
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.15)", margin: "4px 12px" }} />
      <div style={{ padding: "4px 4px 10px" }}>
        <PitchRow players={lineup.away.gk} color="#8b1a1a" />
        <PitchRow players={lineup.away.def} color="#c0392b" />
        {lineup.away.mid.length > 0 && <PitchRow players={lineup.away.mid} color="#c0392b" />}
        <PitchRow players={lineup.away.att} color="#c0392b" />
        <div style={{ ...SG, fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textAlign: "center", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 4 }}>
          {awayTeam} · {lineup.away.formation}
        </div>
      </div>
    </div>
  );
}

// ─── Lineup Modal ─────────────────────────────────────────────────────────────

function LineupModal({ match, data, onClose }: { match: FDMatch; data: LineupData; onClose: () => void }) {
  const dateStr = new Date(match.utcDate).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const timeStr = new Date(match.utcDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxHeight: "90dvh", overflowY: "auto", background: "var(--lp-bg)", borderRadius: "20px 20px 0 0", padding: "0 0 calc(env(safe-area-inset-bottom, 0px) + 24px)" }}>
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--lp-border)" }} />
        </div>
        <div style={{ padding: "12px 20px 16px", borderBottom: "1px solid var(--lp-border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ ...SG, fontSize: 11, fontWeight: 700, color: WC_GOLD, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>⚡ Predicted Lineup</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <Crest src={match.homeTeam.crest} size={20} />
                <div style={{ ...SG, fontSize: 18, fontWeight: 800, color: "var(--lp-text)", lineHeight: 1.15 }}>
                  {match.homeTeam.shortName} vs {match.awayTeam.shortName}
                </div>
                <Crest src={match.awayTeam.crest} size={20} />
              </div>
              <div style={{ fontSize: 12, color: "var(--lp-text3)" }}>{stageLabel(match.stage, match.group)} · {dateStr} · {timeStr}</div>
            </div>
            <button onClick={onClose} style={{ background: "var(--lp-surface)", border: "1px solid var(--lp-border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "var(--lp-text2)", fontSize: 13 }}>✕</button>
          </div>
        </div>
        <div style={{ padding: "16px 16px 0" }}>
          <Pitch lineup={data} homeTeam={match.homeTeam.shortName} awayTeam={match.awayTeam.shortName} />
        </div>
        <div style={{ margin: "16px 16px 0", padding: "12px 14px", background: "var(--lp-surface)", border: "1px solid var(--lp-border)", borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--lp-text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>⚔️ Key Battle</div>
          <p style={{ ...SG, fontSize: 13, fontWeight: 600, color: "var(--lp-text)", margin: 0, lineHeight: 1.4 }}>{data.keyBattle}</p>
        </div>
        <div style={{ margin: "12px 16px 0", padding: "12px 14px", background: `linear-gradient(135deg, color-mix(in srgb, ${WC_GOLD} 8%, transparent), color-mix(in srgb, ${WC_GOLD} 3%, transparent))`, border: `1px solid rgba(245,197,24,0.2)`, borderRadius: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: WC_GOLD, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🎯 Prediction</div>
          <p style={{ ...SG, fontSize: 13, fontWeight: 600, color: "var(--lp-text)", margin: 0, lineHeight: 1.4 }}>{data.tip}</p>
        </div>
        <p style={{ fontSize: 10, color: "var(--lp-text3)", textAlign: "center", margin: "12px 20px 0", lineHeight: 1.5 }}>
          AI-generated prediction · Based on known squads and typical formations · Subject to injuries and rotation
        </p>
      </div>
    </div>
  );
}

// ─── MatchTile (finished / live) ──────────────────────────────────────────────

function MatchTile({ match, onReadStory, generating }: {
  match: FDMatch; onReadStory: (m: FDMatch) => void; generating: boolean;
}) {
  const isLive    = match.status === "IN_PLAY" || match.status === "PAUSED";
  const hGoals    = goalList(match.goals ?? [], match.homeTeam.name);
  const aGoals    = goalList(match.goals ?? [], match.awayTeam.name);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const text = `${match.homeTeam.shortName} ${match.score.fullTime.home ?? 0}–${match.score.fullTime.away ?? 0} ${match.awayTeam.shortName} · FIFA World Cup 2026`;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{ minWidth: 230, maxWidth: 250, flexShrink: 0, background: "var(--lp-surface)", border: `1px solid ${isLive ? "rgba(229,62,62,0.4)" : "var(--lp-border)"}`, borderRadius: 16, padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--lp-text3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {stageLabel(match.stage, match.group)}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLive
            ? <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, color: "#e53e3e" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e53e3e", animation: "wc-pulse 1.2s ease-in-out infinite" }} />LIVE</span>
            : <span style={{ fontSize: 10, fontWeight: 600, color: "var(--lp-text3)" }}>FT</span>}
          <button onClick={handleShare} title="Share" aria-label="Share" style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#34D399" : "var(--lp-text3)", padding: "0 0 0 4px", lineHeight: 1, fontSize: 13 }}>{copied ? "✓" : "⬆"}</button>
        </div>
      </div>

      {/* Teams */}
      {[
        { team: match.homeTeam, goals: hGoals, score: match.score.fullTime.home },
        { team: match.awayTeam, goals: aGoals, score: match.score.fullTime.away }
      ].map(({ team, goals, score }, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Crest src={team.crest} size={22} />
            <div style={{ minWidth: 0 }}>
              <div style={{ ...SG, fontSize: 13, fontWeight: 700, color: "var(--lp-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.shortName || team.name}</div>
              {goals.length > 0 && <div style={{ fontSize: 9, color: "var(--lp-text3)", lineHeight: 1.3 }}>{goals.join(", ")}</div>}
            </div>
          </div>
          <span style={{ ...SG, fontSize: 22, fontWeight: 800, color: "var(--lp-text)", minWidth: 18, textAlign: "right" }}>{score ?? 0}</span>
        </div>
      ))}

      <button
        onClick={() => onReadStory(match)}
        disabled={generating}
        style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "none", background: generating ? "var(--lp-border)" : WC_BLUE, color: generating ? "var(--lp-text3)" : "#fff", ...SG, fontSize: 12, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      >
        {generating
          ? <><span style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid var(--lp-text3)", borderTopColor: "transparent", animation: "wc-spin .7s linear infinite", display: "inline-block" }} />Generating…</>
          : "Read Story ⚡"}
      </button>
    </div>
  );
}

// ─── UpcomingTile ─────────────────────────────────────────────────────────────

function UpcomingTile({ match, onPredict, predicting }: {
  match: FDMatch; onPredict: (m: FDMatch) => void; predicting: boolean;
}) {
  const remaining = useCountdown(match.utcDate);
  const countdown = formatCountdown(remaining);
  const isToday   = fmt(new Date(match.utcDate)) === fmt(new Date());
  const timeStr   = new Date(match.utcDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isSoon    = remaining < 3_600_000; // < 1 hour

  return (
    <div style={{ background: "var(--lp-surface)", border: "1px solid var(--lp-border)", borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stage + time */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--lp-text3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          {stageLabel(match.stage, match.group)}
        </span>
        <span style={{ ...SG, fontSize: 11, fontWeight: 700, color: isToday ? WC_GOLD : "var(--lp-text2)" }}>
          {timeStr}
        </span>
      </div>

      {/* Teams row with crests */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Home */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, minWidth: 0 }}>
          <div style={{ ...SG, fontSize: 15, fontWeight: 800, color: "var(--lp-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.homeTeam.shortName || match.homeTeam.name}
          </div>
          <Crest src={match.homeTeam.crest} size={28} />
        </div>

        {/* VS + countdown */}
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 8px", background: "var(--lp-page-bg)", borderRadius: 10, minWidth: 52 }}>
          <span style={{ ...SG, fontSize: 10, fontWeight: 700, color: "var(--lp-text3)" }}>vs</span>
          <span style={{ ...SG, fontSize: 10, fontWeight: 700, color: isSoon ? "#e53e3e" : WC_GOLD, letterSpacing: "-0.01em" }}>{countdown}</span>
        </div>

        {/* Away */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 8, minWidth: 0 }}>
          <Crest src={match.awayTeam.crest} size={28} />
          <div style={{ ...SG, fontSize: 15, fontWeight: 800, color: "var(--lp-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {match.awayTeam.shortName || match.awayTeam.name}
          </div>
        </div>
      </div>

      {/* Predict CTA */}
      <button
        onClick={() => onPredict(match)}
        disabled={predicting}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${predicting ? "var(--lp-border)" : WC_GOLD}`, background: predicting ? "var(--lp-border)" : "color-mix(in srgb, #F5C518 10%, transparent)", color: predicting ? "var(--lp-text3)" : WC_GOLD, ...SG, fontSize: 13, fontWeight: 700, cursor: predicting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, transition: "all .15s" }}
      >
        {predicting
          ? <><span style={{ width: 11, height: 11, borderRadius: "50%", border: `2px solid var(--lp-text3)`, borderTopColor: "transparent", animation: "wc-spin .7s linear infinite", display: "inline-block" }} />Predicting lineup…</>
          : <><span style={{ fontSize: 15 }}>⚡</span> Predict Lineup</>}
      </button>
    </div>
  );
}

// ─── GroupTable ───────────────────────────────────────────────────────────────

function GroupTable({ group }: { group: FDGroup }) {
  const [open, setOpen] = useState(false);
  const label = group.group ? `Group ${group.group.replace("GROUP_", "")}` : group.stage;

  return (
    <div style={{ background: "var(--lp-surface)", border: "1px solid var(--lp-border)", borderRadius: 14, overflow: "hidden" }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer", color: "var(--lp-text)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ ...SG, fontSize: 13, fontWeight: 700 }}>{label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {group.table.slice(0, 4).map(r => (
              <Crest key={r.team.id} src={r.team.crest} size={16} />
            ))}
          </div>
        </div>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s", color: "var(--lp-text3)", flexShrink: 0 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--lp-border)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px 36px", gap: 4, padding: "7px 16px", background: "var(--lp-page-bg)" }}>
            {["Team", "P", "W", "D", "L", "Pts"].map((h, i) => (
              <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "var(--lp-text3)", textTransform: "uppercase", textAlign: i > 0 ? "center" : "left" }}>{h}</span>
            ))}
          </div>
          {group.table.map((row, i) => (
            <div key={row.team.id} style={{ display: "grid", gridTemplateColumns: "1fr 28px 28px 28px 28px 36px", gap: 4, padding: "8px 16px", borderTop: "1px solid var(--lp-border)", background: i < 2 ? "color-mix(in srgb, #22c55e 4%, transparent)" : "transparent" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 10, color: "var(--lp-text3)", width: 12, flexShrink: 0 }}>{row.position}</span>
                {i < 2 && <span style={{ width: 3, height: 14, borderRadius: 2, background: "#22c55e", flexShrink: 0 }} />}
                <Crest src={row.team.crest} size={16} />
                <span style={{ ...SG, fontSize: 12, fontWeight: 600, color: "var(--lp-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.team.shortName || row.team.tla}</span>
              </div>
              {[row.playedGames, row.won, row.draw, row.lost].map((v, j) => (
                <span key={j} style={{ fontSize: 12, color: "var(--lp-text2)", textAlign: "center" }}>{v}</span>
              ))}
              <span style={{ ...SG, fontSize: 13, fontWeight: 800, color: "var(--lp-text)", textAlign: "center" }}>{row.points}</span>
            </div>
          ))}
          <div style={{ padding: "6px 16px 8px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#22c55e" }} />
            <span style={{ fontSize: 10, color: "var(--lp-text3)" }}>Advances to Round of 16</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ScorerRow ────────────────────────────────────────────────────────────────

function ScorerRow({ scorer, rank }: { scorer: FDScorer; rank: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--lp-border)" }}>
      <span style={{ ...SG, fontSize: 14, fontWeight: 800, color: rank <= 3 ? WC_GOLD : "var(--lp-text3)", width: 22, textAlign: "center", flexShrink: 0 }}>{rank}</span>
      <Crest src={scorer.team.crest} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...SG, fontSize: 14, fontWeight: 700, color: "var(--lp-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scorer.player.name}</div>
        <div style={{ fontSize: 11, color: "var(--lp-text3)" }}>{scorer.team.shortName || scorer.team.name} · {scorer.player.nationality}</div>
      </div>
      <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ ...SG, fontSize: 22, fontWeight: 800, color: rank === 1 ? WC_GOLD : "var(--lp-text)", lineHeight: 1 }}>{scorer.goals}</div>
          <div style={{ fontSize: 9, color: "var(--lp-text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Goals</div>
        </div>
        {scorer.assists > 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ ...SG, fontSize: 22, fontWeight: 800, color: "var(--lp-text2)", lineHeight: 1 }}>{scorer.assists}</div>
            <div style={{ fontSize: 9, color: "var(--lp-text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Ast</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NewsCard ─────────────────────────────────────────────────────────────────

function NewsCard({ story }: { story: NewsStory }) {
  return (
    <a href={`/stories/${story.id}`} style={{ display: "block", textDecoration: "none", borderRadius: 14, overflow: "hidden", background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }}>
      {story.cover_image_url && (
        <div style={{ height: 120, overflow: "hidden" }}>
          <img src={story.cover_image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ padding: "12px 14px 14px" }}>
        <p style={{ ...SG, fontSize: 13, fontWeight: 700, color: "var(--lp-text)", margin: "0 0 6px", lineHeight: 1.35 }}>{story.title}</p>
        <div style={{ display: "flex", gap: 6 }}>
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
  const { theme, toggle } = useTheme();
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [predictingId, setPredictingId] = useState<number | null>(null);
  const [genError, setGenError]         = useState<string | null>(null);
  const [lineupModal, setLineupModal]   = useState<{ match: FDMatch; data: LineupData } | null>(null);
  const [activeTab, setActiveTab]       = useState<"matches" | "upcoming" | "standings" | "scorers">("matches");

  const today       = new Date();
  const recentFrom  = fmt(new Date(today.getTime() - 2 * 86_400_000));
  const recentTo    = fmt(today);
  const upcomingFrom = fmt(new Date(today.getTime() + 86_400_000));
  const upcomingTo   = fmt(new Date(today.getTime() + 7 * 86_400_000));

  const { data: matchData,     isLoading: matchLoading }     = useSWR(`/api/worldcup?dateFrom=${recentFrom}&dateTo=${recentTo}`, fetcher, { refreshInterval: 60_000 });
  const { data: upcomingData,  isLoading: upcomingLoading }  = useSWR(activeTab === "upcoming" ? `/api/worldcup?dateFrom=${upcomingFrom}&dateTo=${upcomingTo}` : null, fetcher, { refreshInterval: 300_000 });
  const { data: standingsData, isLoading: standingsLoading } = useSWR(activeTab === "standings" ? "/api/worldcup/standings" : null, fetcher);
  const { data: scorersData,   isLoading: scorersLoading }   = useSWR(activeTab === "scorers" ? "/api/worldcup/scorers" : null, fetcher);
  const { data: newsData,      isLoading: newsLoading }      = useSWR("/api/worldcup/news", fetcher);

  const recentMatches: FDMatch[]   = Array.isArray(matchData?.matches)
    ? matchData.matches.filter((m: FDMatch) => m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED") : [];
  const upcomingMatches: FDMatch[] = Array.isArray(upcomingData?.matches)
    ? [...upcomingData.matches].filter((m: FDMatch) => m.status === "TIMED" || m.status === "SCHEDULED")
        .sort((a: FDMatch, b: FDMatch) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    : [];
  const groups: FDGroup[]   = Array.isArray(standingsData?.standings) ? standingsData.standings.filter((g: FDGroup) => g.type === "TOTAL") : [];
  const scorers: FDScorer[] = Array.isArray(scorersData?.scorers) ? scorersData.scorers : [];
  const news: NewsStory[]   = Array.isArray(newsData?.stories) ? newsData.stories : [];

  const sortedRecent = [...recentMatches].sort((a, b) => {
    const live = (m: FDMatch) => m.status === "IN_PLAY" || m.status === "PAUSED" ? 0 : 1;
    const pd = live(a) - live(b);
    if (pd !== 0) return pd;
    return new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime();
  });

  const liveCount     = recentMatches.filter(m => m.status === "IN_PLAY" || m.status === "PAUSED").length;
  const finishedCount = recentMatches.filter(m => m.status === "FINISHED").length;

  async function handleReadStory(match: FDMatch) {
    setGenError(null);
    setGeneratingId(match.id);
    try {
      const res = await fetch("/api/worldcup/recap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
          homeScore: match.score.fullTime.home ?? 0, awayScore: match.score.fullTime.away ?? 0,
          stage: stageLabel(match.stage, match.group), date: match.utcDate,
          goals: allGoals(match.goals ?? []), group: match.group ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) throw new Error(data.error ?? "Failed to generate recap");
      router.push(`/stories/${data.id}`);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong");
      setGeneratingId(null);
    }
  }

  async function handlePredictLineup(match: FDMatch) {
    setGenError(null);
    setPredictingId(match.id);
    try {
      const res = await fetch("/api/worldcup/lineup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
          stage: stageLabel(match.stage, match.group), date: match.utcDate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.home) throw new Error(data.error ?? "Failed to predict lineup");
      setLineupModal({ match, data });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPredictingId(null);
    }
  }

  const TABS = [
    { key: "matches"   as const, label: "Results" },
    { key: "upcoming"  as const, label: "Upcoming" },
    { key: "standings" as const, label: "Standings" },
    { key: "scorers"   as const, label: "Scorers" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: "var(--lp-text)", paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>
      <style>{`
        @keyframes wc-spin  { to { transform: rotate(360deg); } }
        @keyframes wc-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {lineupModal && (
        <LineupModal match={lineupModal.match} data={lineupModal.data} onClose={() => setLineupModal(null)} />
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(145deg, ${WC_BLUE} 0%, #002D62 55%, #001025 100%)`, padding: "calc(env(safe-area-inset-top, 0px) + 20px) 20px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -60, right: -60, width: 280, height: 280, borderRadius: "50%", background: "rgba(245,197,24,0.07)", pointerEvents: "none" }} />

        <div style={{ position: "relative" }}>
          {/* Top bar: title + controls */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ ...SG, fontSize: 11, fontWeight: 700, color: WC_GOLD, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>⚽ FIFA World Cup 2026</div>
              <div style={{ ...SG, fontSize: 26, fontWeight: 800, color: "#fff", letterSpacing: "-0.025em", lineHeight: 1.1 }}>USA · Canada · Mexico</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>Jun 12 – Jul 19, 2026 · 48 nations · 104 matches</div>
            </div>

            {/* Right controls */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
              {/* Theme toggle */}
              <button
                onClick={toggle}
                title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 16, lineHeight: 1, backdropFilter: "blur(8px)", flexShrink: 0 }}
              >
                {theme === "dark" ? "☀︎" : "☽"}
              </button>
              {/* LIVE badge */}
              {liveCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(229,62,62,0.2)", border: "1px solid rgba(229,62,62,0.4)", padding: "5px 10px", borderRadius: 999 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#e53e3e", animation: "wc-pulse 1.2s ease-in-out infinite" }} />
                  <span style={{ ...SG, fontSize: 12, fontWeight: 700, color: "#e53e3e" }}>{liveCount} Live</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "flex", marginBottom: 18 }}>
            {[{ v: finishedCount, l: "Results" }, { v: liveCount, l: "Live" }, { v: upcomingMatches.length || "—", l: "Upcoming" }].map(({ v, l }, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", padding: "10px 4px", borderRight: i < 2 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
                <div style={{ ...SG, fontSize: 22, fontWeight: 800, color: "#fff" }}>{v}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)", overflowX: "auto", scrollbarWidth: "none" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, minWidth: 70, padding: "12px 4px", background: "transparent", border: "none", cursor: "pointer", ...SG, fontSize: 12, fontWeight: activeTab === t.key ? 700 : 500, color: activeTab === t.key ? WC_GOLD : "rgba(255,255,255,0.45)", borderBottom: `2px solid ${activeTab === t.key ? WC_GOLD : "transparent"}`, transition: "all .15s", whiteSpace: "nowrap" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {genError && (
        <div style={{ margin: "12px 16px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(229,62,62,0.12)", border: "1px solid rgba(229,62,62,0.3)", fontSize: 12, color: "#e53e3e" }}>{genError}</div>
      )}

      {/* ── RESULTS ──────────────────────────────────────────────────────────── */}
      {activeTab === "matches" && (
        <div style={{ paddingTop: 20 }}>
          {matchLoading ? (
            <div style={{ padding: "0 20px", display: "flex", gap: 12 }}>
              {[1,2,3].map(i => <div key={i} style={{ minWidth: 230, height: 170, borderRadius: 16, background: "var(--lp-surface)", border: "1px solid var(--lp-border)", flexShrink: 0 }} />)}
            </div>
          ) : sortedRecent.length === 0 ? (
            <div style={{ padding: "20px", fontSize: 13, color: "var(--lp-text3)" }}>No recent results. Check the Upcoming tab.</div>
          ) : (
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 20px 4px", scrollbarWidth: "none" }}>
              {sortedRecent.map(m => (
                <MatchTile key={m.id} match={m} onReadStory={handleReadStory} generating={generatingId === m.id} />
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--lp-text3)", margin: "8px 20px 0" }}>Last 2 days · Tap finished matches for an AI story recap</p>
        </div>
      )}

      {/* ── UPCOMING ─────────────────────────────────────────────────────────── */}
      {activeTab === "upcoming" && (
        <div style={{ padding: "20px 16px 0" }}>
          {/* Today's scheduled matches */}
          {(() => {
            const todayMatches = (matchData?.matches ?? []).filter((m: FDMatch) => m.status === "TIMED" || m.status === "SCHEDULED");
            if (todayMatches.length > 0) return (
              <div style={{ marginBottom: 20 }}>
                <div style={{ ...SG, fontSize: 11, fontWeight: 700, color: WC_GOLD, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Today</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {todayMatches.map((m: FDMatch) => (
                    <UpcomingTile key={m.id} match={m} onPredict={handlePredictLineup} predicting={predictingId === m.id} />
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Rest of upcoming week */}
          {upcomingLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ height: 140, borderRadius: 16, background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }} />)}
            </div>
          ) : upcomingMatches.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--lp-text3)", padding: "20px 4px" }}>No upcoming matches in the next 7 days.</div>
          ) : (
            (() => {
              const byDate: Record<string, FDMatch[]> = {};
              for (const m of upcomingMatches) {
                const day = fmt(new Date(m.utcDate));
                if (!byDate[day]) byDate[day] = [];
                byDate[day].push(m);
              }
              return Object.entries(byDate).map(([day, matches]) => (
                <div key={day} style={{ marginBottom: 20 }}>
                  <div style={{ ...SG, fontSize: 11, fontWeight: 700, color: "var(--lp-text3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                    {new Date(day + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {matches.map(m => (
                      <UpcomingTile key={m.id} match={m} onPredict={handlePredictLineup} predicting={predictingId === m.id} />
                    ))}
                  </div>
                </div>
              ));
            })()
          )}

          <p style={{ fontSize: 11, color: "var(--lp-text3)", margin: "4px 4px 0" }}>
            ⚡ Lineup Prediction uses AI — not official team announcements
          </p>
        </div>
      )}

      {/* ── STANDINGS ────────────────────────────────────────────────────────── */}
      {activeTab === "standings" && (
        <div style={{ padding: "20px 20px 0" }}>
          {standingsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 52, borderRadius: 14, background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }} />)}
            </div>
          ) : groups.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--lp-text3)", padding: "20px 0" }}>Standings loading.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groups.map((g, i) => <GroupTable key={i} group={g} />)}
            </div>
          )}
        </div>
      )}

      {/* ── SCORERS ──────────────────────────────────────────────────────────── */}
      {activeTab === "scorers" && (
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, padding: "12px 16px", background: "color-mix(in srgb, #F5C518 8%, transparent)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 12 }}>
            <span style={{ fontSize: 24 }}>🥇</span>
            <div>
              <div style={{ ...SG, fontSize: 13, fontWeight: 700, color: WC_GOLD }}>Golden Boot Race</div>
              <div style={{ fontSize: 11, color: "var(--lp-text3)" }}>Top scorers — FIFA World Cup 2026</div>
            </div>
          </div>
          {scorersLoading
            ? [1,2,3,4,5].map(i => <div key={i} style={{ height: 58, borderRadius: 8, background: "var(--lp-surface)", marginBottom: 4 }} />)
            : scorers.length === 0
            ? <div style={{ fontSize: 13, color: "var(--lp-text3)", padding: "20px 0" }}>No scorers yet.</div>
            : scorers.map((s, i) => <ScorerRow key={s.player.id} scorer={s} rank={i + 1} />)}
        </div>
      )}

      {/* ── Stories ──────────────────────────────────────────────────────────── */}
      <div style={{ padding: "28px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ ...SG, fontSize: 16, fontWeight: 700, margin: 0, color: "var(--lp-text)" }}>WC Stories</h2>
          {news.length > 0 && <span style={{ fontSize: 11, color: "var(--lp-text3)" }}>{news.length} stories</span>}
        </div>
        {newsLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 190, borderRadius: 14, background: "var(--lp-surface)", border: "1px solid var(--lp-border)" }} />)}
          </div>
        ) : news.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: "var(--lp-text3)", lineHeight: 1.6 }}>
            Fetching World Cup stories…<br /><span style={{ fontSize: 11 }}>First load may take a moment.</span>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {news.map(s => <NewsCard key={s.id} story={s} />)}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
