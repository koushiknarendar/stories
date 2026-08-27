"use client";

import { useState, useEffect } from "react";
import { SignOutButton } from "@/lib/clerkStub";
import { useAuthReady } from "@/lib/useAuthReady";
import useSWR from "swr";
import { useTheme } from "@/components/ThemeProvider";
import BottomNav from "@/components/BottomNav";
import { CATEGORIES } from "@/lib/categories";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

const IconSun  = () => <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx={12} cy={12} r={4.2}/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>;
const IconMoon = () => <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayCount: number;
  totalReads: number;
}

const DAILY_GOAL = 3;

const ALL_BADGES = [
  { id: "first_story",  emoji: "📖", label: "First Story",    desc: "Added your first article",          check: (s: number, _r: number, streak: number, longest: number) => s >= 1 || _r >= 1 || streak >= 1 || longest >= 1 },
  { id: "bookworm",     emoji: "🐛", label: "Bookworm",       desc: "Saved 5 stories",                   check: (s: number) => s >= 5 },
  { id: "library",      emoji: "📚", label: "Library Builder", desc: "Saved 10 stories",                 check: (s: number) => s >= 10 },
  { id: "on_a_roll",    emoji: "🔥", label: "On a Roll",      desc: "3-day reading streak",              check: (_s: number, _r: number, streak: number) => streak >= 3 },
  { id: "week_warrior", emoji: "⚡",  label: "Week Warrior",   desc: "7-day reading streak",              check: (_s: number, _r: number, streak: number) => streak >= 7 },
  { id: "consistent",   emoji: "💎", label: "Consistent",     desc: "14-day streak ever",                check: (_s: number, _r: number, _streak: number, longest: number) => longest >= 14 },
  { id: "centurion",    emoji: "🏆", label: "Centurion",      desc: "Read 100 story cards",              check: (_s: number, r: number) => r >= 100 },
  { id: "month_master", emoji: "👑", label: "Month Master",   desc: "30-day streak ever",                check: (_s: number, _r: number, _streak: number, longest: number) => longest >= 30 },
];

export default function ProfilePage() {
  const { user, isLoaded } = useAuthReady();
  const { theme, toggle } = useTheme();
  const [editingInterests, setEditingInterests] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [readingDepth, setReadingDepthState] = useState<string>("balanced");

  const { data: interestsData, mutate: mutateInterests } = useSWR(user ? "/api/interests" : null, fetcher);
  const { data: spaceData } = useSWR(user ? "/api/space" : null, fetcher);
  const { data: streakData } = useSWR(user ? "/api/streak" : null, fetcher);

  const interests: string[] = Array.isArray(interestsData) ? interestsData : [];
  const storyCount: number | null = Array.isArray(spaceData) ? spaceData.length : null;
  const streak: StreakData | null = streakData && typeof streakData.currentStreak === "number" ? streakData : null;

  useEffect(() => {
    try { setReadingDepthState(localStorage.getItem("storis_reading_depth") ?? "balanced"); } catch {}
  }, []);

  useEffect(() => {
    if (isLoaded && !user) window.location.href = "/";
  }, [isLoaded, user]);

  // Sync interests into the edit selection when data loads
  useEffect(() => {
    if (interestsData) setSelected(new Set(interests));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestsData]);

  function setReadingDepth(val: string) {
    setReadingDepthState(val);
    try { localStorage.setItem("storis_reading_depth", val); } catch {}
  }

  async function saveInterests() {
    setSaving(true);
    await fetch("/api/interests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: [...selected] }),
    }).catch(() => {});
    mutateInterests([...selected], { revalidate: false });
    setEditingInterests(false);
    setSaving(false);
  }

  function toggleCat(key: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }

  const savedCount    = storyCount ?? 0;
  const totalReads    = streak?.totalReads ?? 0;
  const currentStreak = streak?.currentStreak ?? 0;
  const longestStreak = streak?.longestStreak ?? 0;
  const todayCount    = streak?.todayCount ?? 0;

  const earnedBadges = ALL_BADGES.filter(b => b.check(savedCount, totalReads, currentStreak, longestStreak));
  const lockedBadges = ALL_BADGES.filter(b => !b.check(savedCount, totalReads, currentStreak, longestStreak));

  const todayProgress = Math.min(todayCount / DAILY_GOAL, 1);

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: "var(--lp-text)", paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Top bar */}
      <div style={{ padding: "calc(env(safe-area-inset-top, 0px) + 20px) 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ ...SG, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>Profile</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={toggle} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: "var(--lp-text)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <SignOutButton>
            <button style={{ ...SG, fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 9, border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: "var(--lp-text2)", cursor: "pointer" }}>
              Sign out
            </button>
          </SignOutButton>
        </div>
      </div>

      <div style={{ padding: "20px 20px" }}>

        {/* Avatar + name */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, padding: "16px 18px", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 18, boxShadow: "0 4px 24px -8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
            {user.imageUrl
              ? <img src={user.imageUrl} alt="" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              : <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--lp-accent)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20, fontWeight: 700, flexShrink: 0 }}>
                  {(user.firstName ?? user.emailAddresses[0]?.emailAddress ?? "?")[0].toUpperCase()}
                </div>
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...SG, margin: 0, fontSize: 16, fontWeight: 700, color: "var(--lp-text)" }}>
                {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName ?? "Reader"}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--lp-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
            {earnedBadges.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2, maxWidth: 72, justifyContent: "flex-end" }}>
                {earnedBadges.slice(0, 4).map(b => (
                  <span key={b.id} title={b.label} style={{ fontSize: 18 }}>{b.emoji}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Reading streak ── */}
        <div style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 18, padding: "18px 20px", marginBottom: 12, boxShadow: "0 4px 24px -8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
          <p style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--lp-text3)", margin: "0 0 14px" }}>Reading streak</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ ...SG, fontSize: 36, fontWeight: 800, color: currentStreak > 0 ? "#F97316" : "var(--lp-text3)", margin: 0, lineHeight: 1 }}>
                {currentStreak > 0 ? "🔥" : "✨"} {currentStreak}
              </p>
              <p style={{ fontSize: 11, color: "var(--lp-text3)", margin: "4px 0 0", fontWeight: 500 }}>day streak</p>
            </div>
            <div style={{ flex: 1, height: 1, background: "var(--lp-border)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ ...SG, fontSize: 20, fontWeight: 700, color: "var(--lp-accent)", margin: 0 }}>{longestStreak}</p>
              <p style={{ fontSize: 11, color: "var(--lp-text3)", margin: "4px 0 0", fontWeight: 500 }}>best</p>
            </div>
          </div>

          {/* Daily goal progress */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "var(--lp-text2)", fontWeight: 500 }}>Today&apos;s goal</span>
              <span style={{ ...SG, fontSize: 12, fontWeight: 700, color: todayCount >= DAILY_GOAL ? "#34D399" : "var(--lp-accent)" }}>
                {todayCount} / {DAILY_GOAL} stories
              </span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--lp-border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${todayProgress * 100}%`, borderRadius: 999, background: todayCount >= DAILY_GOAL ? "linear-gradient(90deg, #34D399, #10B981)" : "linear-gradient(90deg, var(--lp-accent), #A78BFA)", transition: "width .6s ease" }} />
            </div>
            {todayCount >= DAILY_GOAL && (
              <p style={{ fontSize: 12, color: "#34D399", margin: "6px 0 0", fontWeight: 600 }}>Goal reached! Keep it up 🎉</p>
            )}
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Saved", value: storyCount ?? "—" },
            { label: "Read",  value: totalReads },
            { label: "Interests", value: interests.length },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 14, padding: "14px 12px", textAlign: "center", boxShadow: "0 2px 16px -6px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
              <p style={{ ...SG, fontSize: 22, fontWeight: 700, color: "var(--lp-accent)", margin: "0 0 3px" }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--lp-text3)", margin: 0, fontWeight: 500 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* ── Badges ── */}
        <div style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 18, padding: "18px 18px", marginBottom: 12, boxShadow: "0 4px 24px -8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <p style={{ ...SG, fontSize: 14, fontWeight: 700, color: "var(--lp-text)", margin: 0 }}>Badges</p>
            <span style={{ fontSize: 12, color: "var(--lp-text3)" }}>{earnedBadges.length} / {ALL_BADGES.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[...earnedBadges, ...lockedBadges].map((badge) => {
              const unlocked = earnedBadges.includes(badge);
              return (
                <div
                  key={badge.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: unlocked ? "color-mix(in srgb, var(--lp-accent) 8%, transparent)" : "transparent", border: `1px solid ${unlocked ? "color-mix(in srgb, var(--lp-accent) 22%, transparent)" : "var(--lp-border)"}`, opacity: unlocked ? 1 : 0.45 }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0, filter: unlocked ? "none" : "grayscale(1)" }}>{badge.emoji}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ ...SG, fontSize: 12, fontWeight: 700, color: unlocked ? "var(--lp-text)" : "var(--lp-text3)", margin: 0 }}>{badge.label}</p>
                    <p style={{ fontSize: 10, color: "var(--lp-text3)", margin: "2px 0 0", lineHeight: 1.3 }}>{badge.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Reading depth ── */}
        <div style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 18, padding: "18px 18px", marginBottom: 12, boxShadow: "0 4px 24px -8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
          <p style={{ ...SG, fontSize: 14, fontWeight: 700, color: "var(--lp-text)", margin: "0 0 5px" }}>Reading depth</p>
          <p style={{ fontSize: 12, color: "var(--lp-text3)", margin: "0 0 14px", lineHeight: 1.5 }}>Controls how many cards are shown per story.</p>
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { key: "light",    emoji: "🌱", label: "Light",    desc: "3 cards" },
              { key: "balanced", emoji: "📚", label: "Balanced", desc: "5 cards" },
              { key: "deep",     emoji: "🔥", label: "Deep",     desc: "All cards" },
            ].map(({ key, emoji, label, desc }) => {
              const active = readingDepth === key;
              return (
                <button
                  key={key}
                  onClick={() => setReadingDepth(key)}
                  style={{ flex: 1, padding: "10px 6px", borderRadius: 12, border: `1.5px solid ${active ? "var(--lp-accent)" : "var(--lp-border)"}`, background: active ? "color-mix(in srgb, var(--lp-accent) 10%, transparent)" : "transparent", color: active ? "var(--lp-accent)" : "var(--lp-text2)", cursor: "pointer", textAlign: "center", transition: "all .15s" }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</div>
                  <p style={{ ...SG, fontSize: 12, fontWeight: 700, margin: "0 0 2px", color: active ? "var(--lp-accent)" : "var(--lp-text)" }}>{label}</p>
                  <p style={{ fontSize: 10, margin: 0, color: "var(--lp-text3)" }}>{desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Interests ── */}
        <div style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 18, padding: "18px 18px", boxShadow: "0 4px 24px -8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: editingInterests ? 16 : (interests.length > 0 ? 14 : 0) }}>
            <p style={{ ...SG, fontSize: 14, fontWeight: 700, color: "var(--lp-text)", margin: 0 }}>My interests</p>
            <button
              onClick={() => { setEditingInterests((v) => !v); setSelected(new Set(interests)); }}
              style={{ ...SG, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid var(--lp-border)", background: "transparent", color: "var(--lp-text2)", cursor: "pointer" }}
            >
              {editingInterests ? "Cancel" : "Edit"}
            </button>
          </div>

          {editingInterests ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                {CATEGORIES.map(({ key, label, emoji }) => {
                  const active = selected.has(key);
                  return (
                    <button
                      key={key}
                      onClick={() => toggleCat(key)}
                      style={{ ...SG, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${active ? "var(--lp-accent)" : "var(--lp-border)"}`, background: active ? "color-mix(in srgb, var(--lp-accent) 10%, transparent)" : "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: active ? "var(--lp-accent)" : "var(--lp-text2)", fontSize: 13, fontWeight: active ? 700 : 500, cursor: "pointer", transition: "all .15s", textAlign: "left" }}
                    >
                      <span>{emoji}</span><span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={saveInterests}
                disabled={saving}
                style={{ ...SG, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: "var(--lp-accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving…" : "Save interests"}
              </button>
            </>
          ) : interests.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {interests.map((key) => {
                const cat = CATEGORIES.find((c) => c.key === key);
                return cat ? (
                  <span key={key} style={{ ...SG, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, background: "color-mix(in srgb, var(--lp-accent) 10%, transparent)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: "var(--lp-accent)", border: "1px solid color-mix(in srgb, var(--lp-accent) 25%, transparent)" }}>
                    {cat.emoji} {cat.label}
                  </span>
                ) : null;
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--lp-text3)", margin: 0 }}>No interests set — tap Edit to pick some.</p>
          )}
        </div>

      </div>
      <BottomNav />
    </div>
  );
}
