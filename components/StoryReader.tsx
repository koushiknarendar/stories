"use client";

import { useRef, useState, useEffect } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
  type PanInfo,
} from "framer-motion";
import { addToCurate, recordDislike } from "@/lib/storage";
import { useTheme } from "@/components/ThemeProvider";
import { useUser, useClerk, SignInButton } from "@clerk/nextjs";
import type { StorySet } from "@/lib/types";
import BottomNav from "@/components/BottomNav";
import CollectionPicker from "@/components/CollectionPicker";

const SWIPE_THRESHOLD = 80;
const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };
const DEPTH_LIMIT: Record<string, number> = { light: 3, balanced: 5, deep: Infinity };

function formatPublishedDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
  } catch { return ""; }
}

interface Props {
  set: StorySet;
  storySetId?: string;
  initialCardIndex?: number;
}

export default function StoryReader({ set, storySetId, initialCardIndex = 0 }: Props) {
  useTheme(); // subscribe to theme changes
  const { user, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const [pendingSave, setPendingSave] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [resumed, setResumed] = useState(false);
  const dragged = useRef(false);
  const flying = useRef(false);
  const streakRecorded = useRef(false);

  const [cardLimit, setCardLimit] = useState<number>(5);
  const [showGuide, setShowGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareHint, setShareHint] = useState(false);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-14, 14]);
  const likeOpacity = useTransform(x, [30, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, -30], [1, 0]);

  const visibleCards = set.cards.slice(0, cardLimit === Infinity ? undefined : cardLimit);
  const card = visibleCards[cardIndex] ?? set.cards[0];
  const total = visibleCards.length;
  const isLast = cardIndex === total - 1;
  const isFirst = cardIndex === 0;
  const sid = storySetId || set.id;
  const coverImg = set.coverImageUrl || `https://picsum.photos/seed/${set.id}/800/500`;
  const isLoggedIn = isLoaded && !!user;
  const dest = isLoggedIn ? "/space" : "/";

  // Read reading-depth preference from localStorage
  useEffect(() => {
    try {
      const pref = localStorage.getItem("storis_reading_depth") ?? "balanced";
      setCardLimit(DEPTH_LIMIT[pref] ?? 5);
    } catch { /* keep 5 */ }
  }, []);

  // Show navigation guide every new browser session (sessionStorage resets on tab/window close)
  useEffect(() => {
    try {
      if (!sessionStorage.getItem("storis_guide_shown")) setShowGuide(true);
    } catch {}
  }, []);

  function dismissGuide() {
    setShowGuide(false);
    try { sessionStorage.setItem("storis_guide_shown", "1"); } catch {}
  }

  // Record streak once when reading a story by ID
  useEffect(() => {
    if (!isLoggedIn || !storySetId || streakRecorded.current) return;
    streakRecorded.current = true;
    fetch("/api/streak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storySetId }),
    }).catch(() => {});
  }, [isLoggedIn, storySetId]);

  // Restore reading progress
  useEffect(() => {
    if (!storySetId) return;
    if (initialCardIndex > 0) {
      const capped = Math.min(initialCardIndex, visibleCards.length - 1);
      if (capped > 0) { setCardIndex(capped); setResumed(true); setTimeout(() => setResumed(false), 2500); }
      return;
    }
    try {
      const saved = localStorage.getItem(`storis_progress_${storySetId}`);
      if (saved) {
        const idx = parseInt(saved, 10);
        if (!isNaN(idx) && idx > 0) {
          const capped = Math.min(idx, visibleCards.length - 1);
          setCardIndex(capped);
          if (capped > 0) { setResumed(true); setTimeout(() => setResumed(false), 2500); }
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storySetId, cardLimit]);

  // Persist progress
  useEffect(() => {
    if (!storySetId) return;
    try { localStorage.setItem(`storis_progress_${storySetId}`, String(cardIndex)); } catch {}
  }, [storySetId, cardIndex]);

  async function flyOff(dir: 1 | -1, destination = "/") {
    if (flying.current) return;
    flying.current = true;
    await animate(x, dir * 1400, { duration: 0.32, ease: [0.32, 0, 0.67, 0] });
    window.location.href = destination;
  }

  function recordInteraction(action: "like" | "dislike") {
    fetch("/api/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId: set.id, storyTitle: set.title, storySource: set.source, action }) }).catch(() => {});
  }

  useEffect(() => {
    if (!isLoggedIn || !pendingSave) return;
    setPendingSave(false);
    (async () => {
      addToCurate(set);
      recordInteraction("like");
      if (!storySetId) {
        await fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(set) }).catch(() => {});
      }
      flyOff(1, "/space");
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, pendingSave]);

  async function onCollectionSave(collectionId?: string) {
    setShowCollectionPicker(false);
    addToCurate(set);
    recordInteraction("like");
    let savedId = storySetId;
    if (!savedId) {
      const data = await fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(set) }).then((r) => r.json()).catch(() => ({}));
      savedId = data?.id;
    }
    if (collectionId && savedId) {
      await fetch(`/api/collections/${collectionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storySetId: savedId }) }).catch(() => {});
    }
    flyOff(1, "/space");
  }

  async function handleLike() {
    if (!isLoaded) return;
    if (!isLoggedIn) { setPendingSave(true); openSignIn(); return; }
    setShowCollectionPicker(true);
  }

  function handleNope() { recordDislike(set.id); recordInteraction("dislike"); flyOff(-1, dest); }
  function onDragStart() { dragged.current = false; }
  function onDrag(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (Math.abs(info.offset.x) > 6) dragged.current = true;
  }
  function onDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) handleLike();
    else if (info.offset.x < -SWIPE_THRESHOLD) handleNope();
  }
  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragged.current || flying.current) return;
    x.set(0);
    const rect = e.currentTarget.getBoundingClientRect();
    const tappedLeft = e.clientX - rect.left < rect.width / 2;
    if (tappedLeft) { if (!isFirst) setCardIndex((i) => i - 1); }
    else { setCardIndex((i) => (i + 1) % total); }
  }

  async function shareStory() {
    if (!storySetId) {
      setShareHint(true);
      setTimeout(() => setShareHint(false), 2500);
      return;
    }
    const cardParam = cardIndex > 0 ? `?card=${cardIndex}` : "";
    const url = `${window.location.origin}/stories/${storySetId}${cardParam}`;
    if (navigator.share) {
      navigator.share({ title: set.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{
      height: "100dvh",
      display: "flex",
      flexDirection: "column",
      background: "var(--lp-bg)",
      userSelect: "none",
      boxSizing: "border-box",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      gap: isLoggedIn ? 8 : 0,
    }}>
      <div style={{ flex: 1, position: "relative", borderRadius: 24, overflow: "hidden", minHeight: 0 }}>

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          style={{ x, rotate, position: "absolute", inset: 0, touchAction: "none" }}
          whileDrag={{ cursor: "grabbing" }}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onClick={handleCardClick}
        >
          {/* Cover image */}
          <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${coverImg})`, backgroundSize: "cover", backgroundPosition: "center top" }} />
          {/* Stronger gradient for legibility on light/busy images */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 18%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.9) 62%, rgba(0,0,0,0.98) 100%)" }} />
          {/* Top vignette */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 100%)", zIndex: 5, pointerEvents: "none" }} />

          {/* Progress bars */}
          <div style={{ position: "absolute", top: 14, left: 14, right: 14, zIndex: 10 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {visibleCards.map((_, i) => (
                <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i <= cardIndex ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.22)", transition: "background .3s" }} />
              ))}
            </div>
            {resumed && (
              <div style={{ marginTop: 8, display: "flex", justifyContent: "center" }}>
                <span style={{ ...SG, fontSize: 10, fontWeight: 700, letterSpacing: ".08em", color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)", padding: "3px 10px", borderRadius: 999, backdropFilter: "blur(8px)" }}>
                  ↩ Resumed from card {cardIndex + 1}
                </span>
              </div>
            )}
          </div>

          {/* SAVE stamp */}
          <motion.div style={{ opacity: likeOpacity, position: "absolute", top: 72, left: 20, zIndex: 20, border: "3px solid #34D399", borderRadius: 10, padding: "6px 16px", transform: "rotate(-18deg)", pointerEvents: "none", background: "rgba(0,0,0,0.2)", backdropFilter: "blur(6px)" }}>
            <span style={{ ...SG, color: "#34D399", fontWeight: 900, fontSize: 26, letterSpacing: ".1em" }}>SAVE</span>
          </motion.div>
          {/* SKIP stamp */}
          <motion.div style={{ opacity: nopeOpacity, position: "absolute", top: 72, right: 20, zIndex: 20, border: "3px solid #FF6B81", borderRadius: 10, padding: "6px 16px", transform: "rotate(18deg)", pointerEvents: "none", background: "rgba(0,0,0,0.2)", backdropFilter: "blur(6px)" }}>
            <span style={{ ...SG, color: "#FF6B81", fontWeight: 900, fontSize: 26, letterSpacing: ".1em" }}>SKIP</span>
          </motion.div>

          {/* Content overlay */}
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", zIndex: 10, pointerEvents: "none" }}>
            <div style={{ height: 90, flexShrink: 0 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 20px 0", overflowY: "hidden", pointerEvents: "auto" }}>

              {/* Source pill */}
              <div style={{ marginBottom: 8 }}>
                <span style={{ ...SG, fontSize: 11, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,0.92)", background: "rgba(0,0,0,0.38)", padding: "4px 11px", borderRadius: 999, backdropFilter: "blur(10px)" }}>
                  {set.source}
                </span>
              </div>

              {/* Article title — single line, truncated */}
              <p style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.7)", margin: "0 0 7px", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 2px 12px rgba(0,0,0,0.8)" }}>
                {set.title}
              </p>

              {/* Headline */}
              <h2 style={{ ...SG, fontSize: "clamp(20px,5.5vw,30px)", fontWeight: 800, color: "white", lineHeight: 1.08, letterSpacing: "-0.025em", margin: "0 0 12px", textShadow: "0 1px 8px rgba(0,0,0,1), 0 2px 20px rgba(0,0,0,0.8)" }}>
                {card.headline}
              </h2>

              {/* Bullets */}
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
                {(card.bullets ?? []).map((b, i) => (
                  <li key={i} style={{ display: "flex", gap: 9, color: "rgba(255,255,255,0.9)", fontSize: "clamp(13px,3.2vw,15px)", lineHeight: 1.5, alignItems: "flex-start", textShadow: "0 1px 5px rgba(0,0,0,0.95)" }}>
                    <span style={{ color: "rgba(255,255,255,0.35)", flexShrink: 0, marginTop: 2 }}>—</span>
                    <span style={{ flex: 1 }}>{b}</span>
                  </li>
                ))}
              </ul>

              {/* Read time + position */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                  {card.readTime} read · {formatPublishedDate(set.publishedAt ?? set.savedAt)}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.68)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                  {isFirst ? "tap → to advance" : isLast ? `${cardIndex + 1} / ${total} · tap to restart` : `${cardIndex + 1} / ${total}`}
                </span>
              </div>

              {/* Guest sign-in nudge */}
              {isLast && isLoaded && !isLoggedIn && (
                <div
                  style={{ margin: "12px 0 0", padding: "13px 16px", background: "rgba(124,92,255,0.16)", border: "1px solid rgba(124,92,255,0.3)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, backdropFilter: "blur(8px)" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <p style={{ ...SG, margin: 0, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.95)" }}>Save this story</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "rgba(255,255,255,0.45)" }}>Sign in to build your library — it&apos;s free</p>
                  </div>
                  <SignInButton mode="modal">
                    <button style={{ ...SG, flexShrink: 0, padding: "9px 16px", borderRadius: 10, border: "none", background: "#7C5CFF", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 14px -4px rgba(124,92,255,0.7)" }}>
                      Sign in
                    </button>
                  </SignInButton>
                </div>
              )}
            </div>

            {/* Action buttons — Skip and Save both use the same glass style */}
            <div
              style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "6px 28px 18px", pointerEvents: "auto" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleNope}
                aria-label="Skip"
                style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.28)", color: "#FF6B81", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform .15s, background .15s", flexShrink: 0, backdropFilter: "blur(12px) saturate(150%)", WebkitBackdropFilter: "blur(12px) saturate(150%)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.background = "rgba(255,107,129,0.22)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(0,0,0,0.28)"; }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>

              {/* Save — glass (same as Skip), green bookmark icon */}
              <button
                onClick={handleLike}
                aria-label="Save"
                style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.28)", color: "#34D399", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform .15s, background .15s", flexShrink: 0, backdropFilter: "blur(12px) saturate(150%)", WebkitBackdropFilter: "blur(12px) saturate(150%)" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.background = "rgba(52,211,153,0.22)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(0,0,0,0.28)"; }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12a2 2 0 0 1 2 2v16l-8-4.5L4 21V5a2 2 0 0 1 2-2z"/></svg>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Guide overlay — shows every session, tap anywhere to dismiss */}
        {showGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={dismissGuide}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 50,
              display: "flex",
              cursor: "pointer",
            }}
          >
            {/* Left tap zone */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
              </div>
              <span style={{ ...SG, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: ".02em" }}>Previous</span>
            </div>


            {/* Right tap zone */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)" }}>
              <div style={{ width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </div>
              <span style={{ ...SG, fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: ".02em" }}>Next</span>
            </div>

            {/* Bottom hint */}
            <div style={{ position: "absolute", bottom: 80, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
              <span style={{ ...SG, fontSize: 13, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.75)", borderRadius: 99, padding: "8px 20px", letterSpacing: ".01em" }}>Tap anywhere to start reading</span>
            </div>
          </motion.div>
        )}

        {/* Top floating bar */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "32px 14px 0", pointerEvents: "none" }}>
          <button
            onClick={() => { window.location.href = dest; }}
            style={{ pointerEvents: "auto", width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)" }}
          >
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: 8, position: "relative" }}>
            <button
              onClick={shareStory}
              aria-label="Share"
              style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.12)", color: copied ? "#34D399" : "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", transition: "color .2s" }}
            >
              {copied
                ? <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                : <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              }
            </button>
            {shareHint && (
              <div style={{ position: "absolute", top: 42, right: 0, background: "rgba(0,0,0,0.82)", color: "rgba(255,255,255,0.9)", fontSize: 11.5, fontWeight: 600, borderRadius: 10, padding: "7px 11px", whiteSpace: "nowrap", pointerEvents: "none", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,0.12)" }}>
                {isLoggedIn ? "Getting share link…" : "Sign in to share"}
              </div>
            )}
            {set.sourceUrl && (
              <a href={set.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{ ...SG, color: "rgba(255,255,255,0.92)", fontSize: 11, textDecoration: "none", fontWeight: 700, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.12)", padding: "6px 11px", borderRadius: 20, backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)" }}>
                Source ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {isLoggedIn && <BottomNav fixed={false} />}

      <CollectionPicker
        isOpen={showCollectionPicker}
        onClose={() => setShowCollectionPicker(false)}
        onSave={onCollectionSave}
        storyTitle={set.title}
      />
    </div>
  );
}
