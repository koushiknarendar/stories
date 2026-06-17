"use client";

import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import { useTheme } from "@/components/ThemeProvider";
import BottomNav from "@/components/BottomNav";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

interface Collection {
  id: string;
  name: string;
  item_count: number;
  cover_images: string[];
  created_at: string;
}

const BLOCK_COLORS = [
  { bg: "rgba(124,92,255,0.13)", mid: "rgba(124,92,255,0.22)", border: "rgba(124,92,255,0.36)", accent: "#7C5CFF" },
  { bg: "rgba(52,211,153,0.11)", mid: "rgba(52,211,153,0.19)", border: "rgba(52,211,153,0.34)", accent: "#34D399" },
  { bg: "rgba(251,146,60,0.11)", mid: "rgba(251,146,60,0.19)", border: "rgba(251,146,60,0.34)", accent: "#FB923C" },
  { bg: "rgba(244,114,182,0.11)", mid: "rgba(244,114,182,0.19)", border: "rgba(244,114,182,0.34)", accent: "#F472B6" },
  { bg: "rgba(96,165,250,0.11)", mid: "rgba(96,165,250,0.19)", border: "rgba(96,165,250,0.34)", accent: "#60A5FA" },
];

const IconSun  = () => <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round"><circle cx={12} cy={12} r={4.2}/><path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>;
const IconMoon = () => <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>;

type LibTab = "saved" | "history";

interface SpaceItem {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  saved_at: string;
}

interface HistoryItem {
  id: string;
  title: string;
  source: string;
  source_url: string | null;
  read_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getDateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((today.getTime() - itemDay.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString("en-US", { weekday: "long" });
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

export default function SpacePage() {
  const { user } = useUser();
  const { theme, toggle } = useTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newColName, setNewColName] = useState("");
  const [creatingCol, setCreatingCol] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<LibTab>("saved");
  const [historyEnabled, setHistoryEnabled] = useState(false);
  const [askLoading, setAskLoading] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: spaceRaw, mutate: mutateSpace } = useSWR("/api/space", fetcher);
  const { data: collectionsRaw, mutate: mutateCollections } = useSWR("/api/collections", fetcher);
  const { data: historyRaw } = useSWR(historyEnabled ? "/api/history" : null, fetcher);

  const items: SpaceItem[] = Array.isArray(spaceRaw) ? spaceRaw : [];
  const collections: Collection[] = Array.isArray(collectionsRaw) ? collectionsRaw : [];
  const history: HistoryItem[] = Array.isArray(historyRaw) ? historyRaw : [];
  const historyLoaded = historyRaw !== undefined;

  const searchMode = query.trim().length > 0;

  const filtered = searchMode
    ? items.filter((item) => {
        const q = query.toLowerCase();
        return item.title.toLowerCase().includes(q) || (item.source_url ?? "").toLowerCase().includes(q);
      })
    : items;

  const filteredHistory = searchMode
    ? history.filter((item) => {
        const q = query.toLowerCase();
        return item.title.toLowerCase().includes(q) || (item.source_url ?? "").toLowerCase().includes(q);
      })
    : history;

  const savedIds = new Set(items.map(i => i.id));
  const searchResults = searchMode
    ? [
        ...filtered.map(i => ({ ...i, _type: "saved" as const, _ts: i.saved_at })),
        ...filteredHistory.filter(i => !savedIds.has(i.id)).map(i => ({ ...i, _type: "history" as const, _ts: i.read_at })),
      ]
    : [];

  useEffect(() => {
    if (activeTab === "history" || searchMode) setHistoryEnabled(true);
  }, [activeTab, searchMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  async function handleCreateCollection() {
    if (!newColName.trim()) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newColName.trim() }),
    });
    const col = await res.json();
    if (col.id) {
      mutateCollections([{ ...col, item_count: 0, cover_images: [] }, ...collections], { revalidate: false });
    }
    setNewColName("");
    setCreatingCol(false);
  }

  async function handleDeleteCollection(id: string) {
    mutateCollections(collections.filter((c) => c.id !== id), { revalidate: false });
    await fetch(`/api/collections/${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function handleShare(id: string, title: string) {
    const url = `${window.location.origin}/stories/${id}`;
    if (navigator.share) {
      navigator.share({ title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleDelete(id: string) {
    mutateSpace(items.filter((i) => i.id !== id), { revalidate: false });
    await fetch("/api/space", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function handleAsk(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q || askLoading) return;
    setQuery("");
    setChat((prev) => [...prev, { role: "user", content: q }]);
    setAskLoading(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const { answer } = await res.json();
      setChat((prev) => [...prev, { role: "assistant", content: answer ?? "Something went wrong." }]);
    } catch {
      setChat((prev) => [...prev, { role: "assistant", content: "Couldn't reach the server. Try again." }]);
    } finally {
      setAskLoading(false);
    }
  }

  const surface = "var(--lp-glass-surface)";
  const border  = "var(--lp-border)";
  const text    = "var(--lp-text)";
  const text2   = "var(--lp-text2)";
  const text3   = "var(--lp-text3)";
  const accent  = "var(--lp-accent)";

  // suppress unused warning
  void copiedId; void handleShare;

  return (
    <div style={{ minHeight: "100vh", background: "var(--lp-page-bg)", color: text, paddingBottom: "calc(78px + env(safe-area-inset-bottom, 0px))" }}>

      {/* Nav */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", background: "var(--lp-glass-nav)", borderBottom: "1px solid var(--lp-glass-border)" }}>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "calc(env(safe-area-inset-top, 0px) + 14px) 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1 style={{ ...SG, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", margin: 0, color: text }}>Library</h1>
            <p style={{ fontSize: 11, color: text3, margin: "2px 0 0" }}>Your saved stories</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user?.imageUrl && (
              <img src={user.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
            )}
            <button onClick={toggle} aria-label="Toggle theme" style={{ width: 34, height: 34, borderRadius: 8, border: "1px solid var(--lp-glass-border)", background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: text, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 20px 80px" }}>

        {/* ── Search + Ask — always on top, universal ── */}
        <div style={{ marginBottom: 18 }}>
          {chat.length > 0 && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 10, maxHeight: 280, overflowY: "auto", paddingRight: 4 }}>
              {chat.map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "85%", background: msg.role === "user" ? `color-mix(in srgb, ${accent} 18%, transparent)` : "var(--lp-glass-surface)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: `1px solid ${msg.role === "user" ? `color-mix(in srgb, ${accent} 30%, transparent)` : "var(--lp-glass-border)"}`, borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: text, lineHeight: 1.55 }}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {askLoading && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: "14px 14px 14px 4px", padding: "10px 14px", fontSize: 13, color: text3 }}>Thinking…</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
          <form onSubmit={handleAsk} style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: text3, pointerEvents: "none" }}>
                <circle cx={11} cy={11} r={8} /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or ask your library…"
                style={{ width: "100%", padding: "11px 36px 11px 36px", borderRadius: 12, border: `1.5px solid ${border}`, background: surface, backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", color: text, outline: "none", fontFamily: "inherit", fontSize: 14, boxSizing: "border-box", transition: "border-color .15s" }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                onBlur={(e) => (e.currentTarget.style.borderColor = border)}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: text3, cursor: "pointer", fontSize: 16, padding: 4 }}>✕</button>
              )}
            </div>
            {query.trim() && (
              <button type="submit" disabled={askLoading} style={{ padding: "11px 16px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: askLoading ? "not-allowed" : "pointer", opacity: askLoading ? 0.6 : 1, fontFamily: "'Space Grotesk', sans-serif", transition: "opacity .15s", flexShrink: 0, whiteSpace: "nowrap" }}>
                ✨ Ask
              </button>
            )}
          </form>
        </div>

        {/* Tabs — hidden while searching */}
        {!searchMode && (
          <div style={{ display: "flex", gap: 4, marginBottom: 18, background: "var(--lp-glass-surface)", borderRadius: 14, padding: "4px", border: `1px solid ${border}` }}>
            {(["saved", "history"] as LibTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{ ...SG, flex: 1, padding: "9px 8px", borderRadius: 11, border: "none", background: activeTab === tab ? accent : "transparent", color: activeTab === tab ? "#fff" : text2, fontWeight: activeTab === tab ? 700 : 500, fontSize: 13, cursor: "pointer", transition: "all .15s" }}
              >
                {tab === "saved" ? "📚 Saved" : "🕐 History"}
              </button>
            ))}
          </div>
        )}

        {/* ── SEARCH RESULTS (cross-tab) ── */}
        {searchMode && (
          <div style={{ marginBottom: 8 }}>
            {!historyLoaded && (
              <p style={{ fontSize: 12, color: text3, marginBottom: 10 }}>Searching history…</p>
            )}
            {searchResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 20px", color: text3 }}>
                <p style={{ fontSize: 15, margin: 0 }}>No stories match &ldquo;{query}&rdquo;.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {searchResults.map((item) => (
                  <div key={item.id + item._type} style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...SG, fontSize: 14, fontWeight: 600, color: text, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </p>
                      <p style={{ fontSize: 12, color: text3, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-flex", padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", background: item._type === "saved" ? `color-mix(in srgb, ${accent} 14%, transparent)` : "color-mix(in srgb, var(--lp-text3) 12%, transparent)", color: item._type === "saved" ? accent : text3 }}>
                          {item._type === "saved" ? "Saved" : "History"}
                        </span>
                        <span>{item.source_url ? (() => { try { return new URL(item.source_url).hostname; } catch { return item.source; } })() : item.source}</span>
                        <span>·</span>
                        <span>{timeAgo(item._ts)}</span>
                      </p>
                    </div>
                    <a href={`/stories/${item.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, textDecoration: "none", fontSize: 16, flexShrink: 0 }}>
                      →
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SAVED tab — Collections view ── */}
        {!searchMode && activeTab === "saved" && (
          <>
            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: text3 }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>📚</div>
                <p style={{ ...SG, fontSize: 16, fontWeight: 600, color: text, margin: "0 0 8px" }}>Library is empty</p>
                <p style={{ fontSize: 14, color: text2, margin: "0 0 24px", lineHeight: 1.6 }}>Tap the + button below to add articles, or save stories from your feed.</p>
              </div>
            ) : (
              <>
                {/* All Stories card — full width */}
                <a
                  href="/collections/all"
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 18px", marginBottom: 18, background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 18, textDecoration: "none", boxShadow: "0 2px 16px -4px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.4)" }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: `color-mix(in srgb, ${accent} 14%, transparent)`, border: `1.5px solid color-mix(in srgb, ${accent} 32%, transparent)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width={24} height={24} viewBox="0 0 24 24" fill={accent}><path d="M6 3h12a2 2 0 0 1 2 2v16l-8-4.5L4 21V5a2 2 0 0 1 2-2z"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...SG, fontSize: 15, fontWeight: 700, color: text, margin: "0 0 2px" }}>All Stories</p>
                    <p style={{ fontSize: 12, color: text3, margin: 0 }}>{items.length} {items.length === 1 ? "story" : "stories"} saved</p>
                  </div>
                  <span style={{ color: text3, fontSize: 18, flexShrink: 0 }}>›</span>
                </a>

                {/* Collections label + new button */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <p style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: text3, margin: 0 }}>Collections</p>
                  <button
                    onClick={() => setCreatingCol((v) => !v)}
                    style={{ ...SG, fontSize: 12, fontWeight: 700, color: accent, background: "none", border: "none", cursor: "pointer", padding: "2px 0" }}
                  >
                    + New
                  </button>
                </div>

                {/* New collection input */}
                {creatingCol && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                    <input
                      autoFocus
                      value={newColName}
                      onChange={(e) => setNewColName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreateCollection();
                        if (e.key === "Escape") { setCreatingCol(false); setNewColName(""); }
                      }}
                      placeholder="Collection name…"
                      maxLength={50}
                      style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: `1.5px solid ${accent}`, background: surface, color: text, fontSize: 14, outline: "none", fontFamily: "inherit" }}
                    />
                    <button
                      onClick={handleCreateCollection}
                      disabled={!newColName.trim()}
                      style={{ ...SG, padding: "10px 16px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontWeight: 700, fontSize: 13, cursor: newColName.trim() ? "pointer" : "not-allowed", opacity: newColName.trim() ? 1 : 0.5, flexShrink: 0 }}
                    >Create</button>
                  </div>
                )}

                {/* Collections 2-col grid */}
                {collections.length === 0 && !creatingCol ? (
                  <div style={{ textAlign: "center", padding: "28px 20px", color: text3, border: "1.5px dashed var(--lp-border)", borderRadius: 16 }}>
                    <p style={{ fontSize: 13, margin: "0 0 6px" }}>No collections yet</p>
                    <p style={{ fontSize: 12, margin: 0, color: text3 }}>Tap &ldquo;+ New&rdquo; to create one, or save a story to a collection.</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {collections.map((col, idx) => {
                      const palette = BLOCK_COLORS[idx % BLOCK_COLORS.length];
                      return (
                        <div key={col.id} style={{ position: "relative" }}>
                          <a href={`/collections/${col.id}`} style={{ display: "flex", flexDirection: "column", gap: 8, textDecoration: "none" }}>
                            {/* Stacked blocks */}
                            <div style={{ position: "relative", aspectRatio: "4/3", width: "100%" }}>
                              <div style={{ position: "absolute", top: 8, left: 4, right: 4, bottom: -3, background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 13, transform: "rotate(-6deg)", zIndex: 1 }} />
                              <div style={{ position: "absolute", top: 4, left: 2, right: 2, bottom: -1, background: palette.mid, border: `1px solid ${palette.border}`, borderRadius: 14, transform: "rotate(-2.5deg)", zIndex: 2 }} />
                              <div style={{ position: "absolute", inset: 0, borderRadius: 16, overflow: "hidden", background: palette.bg, border: `1.5px solid ${palette.border}`, zIndex: 3 }}>
                                {col.cover_images.length > 0 ? (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", height: "100%", gap: 2 }}>
                                    {[0, 1, 2, 3].map((i) =>
                                      col.cover_images[i] ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img key={i} src={col.cover_images[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                      ) : (
                                        <div key={i} style={{ background: palette.bg }} />
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg width={32} height={32} viewBox="0 0 24 24" fill={palette.accent} opacity={0.4}><path d="M6 3h12a2 2 0 0 1 2 2v16l-8-4.5L4 21V5a2 2 0 0 1 2-2z"/></svg>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <p style={{ ...SG, fontSize: 13, fontWeight: 600, color: text, margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{col.name}</p>
                              <p style={{ fontSize: 11, color: text3, margin: 0 }}>{col.item_count} {col.item_count === 1 ? "story" : "stories"}</p>
                            </div>
                          </a>
                          {/* Delete collection */}
                          <button
                            onClick={() => handleDeleteCollection(col.id)}
                            aria-label="Delete collection"
                            style={{ position: "absolute", top: 6, right: 6, zIndex: 10, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.45)", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}
                          >✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

          </>
        )}

        {/* ── HISTORY tab ── */}
        {!searchMode && activeTab === "history" && (
          <div>
            {!historyLoaded ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2.5px solid var(--lp-border)", borderTopColor: accent, animation: "spin 0.7s linear infinite", margin: "0 auto" }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: text3 }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🕐</div>
                <p style={{ ...SG, fontSize: 16, fontWeight: 600, color: text, margin: "0 0 8px" }}>No history yet</p>
                <p style={{ fontSize: 14, color: text2, margin: 0, lineHeight: 1.6 }}>Stories you read will appear here.</p>
              </div>
            ) : filteredHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: text3 }}>
                <p style={{ fontSize: 15, margin: 0 }}>No history matches &ldquo;{query}&rdquo;.</p>
              </div>
            ) : (() => {
              const grouped = filteredHistory.reduce<{ label: string; items: HistoryItem[] }[]>((acc, item) => {
                const label = getDateLabel(item.read_at);
                const last = acc[acc.length - 1];
                if (last && last.label === label) last.items.push(item);
                else acc.push({ label, items: [item] });
                return acc;
              }, []);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                  {grouped.map(({ label, items }) => (
                    <div key={label}>
                      <p style={{ ...SG, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: text3, margin: "0 0 10px" }}>{label}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {items.map((item) => (
                          <div key={item.id} style={{ background: "var(--lp-glass-surface)", backdropFilter: "var(--lp-glass-blur-card)", WebkitBackdropFilter: "var(--lp-glass-blur-card)", border: "1px solid var(--lp-glass-border)", borderRadius: 16, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px -4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.45)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ ...SG, fontSize: 14, fontWeight: 600, color: text, margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {item.title}
                              </p>
                              <p style={{ fontSize: 12, color: text3, margin: 0 }}>
                                {item.source_url ? (() => { try { return new URL(item.source_url).hostname; } catch { return item.source; } })() : item.source}
                                {label === "Today" && ` · ${timeAgo(item.read_at)}`}
                              </p>
                            </div>
                            <a href={`/stories/${item.id}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 9, background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, textDecoration: "none", fontSize: 16, flexShrink: 0 }}>
                              →
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
