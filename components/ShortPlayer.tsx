"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import CollectionPicker from "@/components/CollectionPicker";
import BottomNav from "@/components/BottomNav";
import type { StorySet } from "@/lib/types";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

function extractVideoId(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const shortsMatch = u.pathname.match(/\/shorts\/([A-Za-z0-9_-]+)/);
    if (shortsMatch) return shortsMatch[1];
    return u.searchParams.get("v");
  } catch { return null; }
}

interface Props {
  set: StorySet;
  storySetId?: string;
  // Only provided on the /stories (new short) page — undefined on /stories/[id] (shared link)
  onSave?: (collectionId?: string) => Promise<void>;
  saved?: boolean;
}

export default function ShortPlayer({ set, storySetId, onSave, saved = false }: Props) {
  const { isSignedIn } = useUser();
  const [showPicker, setShowPicker] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const videoId = extractVideoId(set.sourceUrl);
  const shareUrl = storySetId
    ? `${typeof window !== "undefined" ? window.location.origin : "https://storis.in"}/stories/${storySetId}`
    : set.sourceUrl ?? "";

  async function handleShare() {
    if (navigator.share) {
      navigator.share({ title: set.title, url: shareUrl }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleSave(collectionId?: string) {
    if (onSave) {
      await onSave(collectionId);
      setJustSaved(true);
    }
    setShowPicker(false);
  }

  const isSaved = saved || justSaved;

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: "var(--lp-text)", display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Nav */}
      <nav style={{ width: "100%", position: "sticky", top: 0, zIndex: 50, backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", background: "var(--lp-glass-nav)", borderBottom: "1px solid var(--lp-glass-border)" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "calc(env(safe-area-inset-top, 0px) + 12px) 20px 12px", display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lp-text)", textDecoration: "none", flexShrink: 0 }}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </a>
          <span style={{ ...SG, fontSize: 15, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>YouTube Short</span>
          <button
            onClick={handleShare}
            style={{ width: 34, height: 34, borderRadius: "50%", border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", display: "flex", alignItems: "center", justifyContent: "center", color: copied ? "#34D399" : "var(--lp-text)", cursor: "pointer" }}
          >
            {copied
              ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
              : <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            }
          </button>
        </div>
      </nav>

      {/* Content */}
      <div style={{ width: "100%", maxWidth: 480, padding: "20px 16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>

        {/* Embedded Short — 9:16 */}
        {videoId ? (
          <div style={{ width: "100%", maxWidth: 340, borderRadius: 20, overflow: "hidden", boxShadow: "0 8px 40px -8px rgba(0,0,0,0.28)", aspectRatio: "9/16", background: "#000", position: "relative" }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              title={set.title}
            />
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 340, borderRadius: 20, aspectRatio: "9/16", background: "var(--lp-glass-surface)", border: "1px solid var(--lp-glass-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--lp-text3)", fontSize: 14 }}>
            Video unavailable
          </div>
        )}

        {/* Title */}
        <div style={{ width: "100%", textAlign: "center" }}>
          <h1 style={{ ...SG, fontSize: 17, fontWeight: 700, color: "var(--lp-text)", margin: "0 0 5px", lineHeight: 1.3, letterSpacing: "-0.02em" }}>{set.title}</h1>
          {set.sourceUrl && (
            <a href={set.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--lp-text3)", textDecoration: "none" }}>
              Watch on YouTube ↗
            </a>
          )}
        </div>

        {/* Save action — only shown when onSave is provided (new short, not shared view) */}
        {onSave && (
          isSaved ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#34D399", ...SG, fontSize: 14, fontWeight: 600 }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
              Saved to your library
            </div>
          ) : isSignedIn ? (
            <button
              onClick={() => setShowPicker(true)}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 28px", borderRadius: 14, border: "none", background: "var(--lp-accent)", color: "#fff", ...SG, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 20px -6px var(--lp-glow)", letterSpacing: "-0.01em" }}
            >
              <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
              Save to Library
            </button>
          ) : (
            <a
              href="/sign-in"
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 28px", borderRadius: 14, background: "var(--lp-accent)", color: "#fff", ...SG, fontSize: 15, fontWeight: 700, textDecoration: "none", boxShadow: "0 6px 20px -6px var(--lp-glow)" }}
            >
              Sign in to Save
            </a>
          )
        )}
      </div>

      {/* Collection picker */}
      <CollectionPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSave={handleSave}
        storyTitle={set.title}
      />

      {isSignedIn && <BottomNav />}
    </div>
  );
}
