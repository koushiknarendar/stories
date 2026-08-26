"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import AddModal from "@/components/AddModal";

const SG: React.CSSProperties = { fontFamily: "var(--font-space, 'Space Grotesk', sans-serif)" };

const IconHome = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" />
    <path d="M9 21V12h6v9" />
  </svg>
);

const IconExplore = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <circle cx={11} cy={11} r={8} />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const IconBooks = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const IconSpace = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const IconProfile = ({ active }: { active: boolean }) => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx={12} cy={7} r={4} />
  </svg>
);

const LEFT_ITEMS  = [
  { href: "/foryou",  label: "Today",   Icon: IconHome },
  { href: "/explore", label: "Explore", Icon: IconExplore },
  { href: "/books",   label: "Books",   Icon: IconBooks },
];
const RIGHT_ITEMS = [
  { href: "/space",   label: "Library", Icon: IconSpace },
  { href: "/profile", label: "Profile", Icon: IconProfile },
];

export default function BottomNav({ fixed = true }: { fixed?: boolean }) {
  const pathname = usePathname();
  const [addOpen, setAddOpen] = useState(false);

  const navStyle: React.CSSProperties = fixed
    ? { position: "fixed", bottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)", left: 12, right: 12, zIndex: 50, borderRadius: 999, height: 60, boxSizing: "border-box", display: "flex", alignItems: "center", background: "var(--lp-glass-nav)", backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", border: "1px solid var(--lp-glass-border)", boxShadow: "0 8px 40px -8px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.5)" }
    : { flexShrink: 0, margin: "0 12px", borderRadius: 999, height: 60, boxSizing: "border-box", display: "flex", alignItems: "center", background: "var(--lp-glass-nav)", backdropFilter: "var(--lp-glass-blur)", WebkitBackdropFilter: "var(--lp-glass-blur)", border: "1px solid var(--lp-glass-border)", boxShadow: "0 8px 40px -8px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.5)" };

  function NavLink({ href, label, Icon }: { href: string; label: string; Icon: React.FC<{ active: boolean }> }) {
    const active = pathname === href;
    return (
      <a
        href={href}
        style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 3, color: active ? "var(--lp-accent)" : "var(--lp-text3)", textDecoration: "none", transition: "color .15s" }}
      >
        <Icon active={active} />
        <span style={{ ...SG, fontSize: 9.5, fontWeight: active ? 700 : 500, letterSpacing: ".04em" }}>{label}</span>
      </a>
    );
  }

  return (
    <>
      <nav style={navStyle} className="lp-bottom-nav-wrap">
        {LEFT_ITEMS.map(({ href, label, Icon }) => (
          <NavLink key={href} href={href} label={label} Icon={Icon} />
        ))}

        {/* Center + button */}
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px" }}>
          <button
            onClick={() => setAddOpen(true)}
            aria-label="Add content"
            style={{ width: 46, height: 46, borderRadius: "50%", border: "none", background: "var(--lp-accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 18px -4px rgba(124,92,255,0.7), inset 0 1px 0 rgba(255,255,255,0.25)", flexShrink: 0, transition: "transform .15s, box-shadow .15s" }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 8px 24px -4px rgba(124,92,255,0.85), inset 0 1px 0 rgba(255,255,255,0.25)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 18px -4px rgba(124,92,255,0.7), inset 0 1px 0 rgba(255,255,255,0.25)"; }}
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        {RIGHT_ITEMS.map(({ href, label, Icon }) => (
          <NavLink key={href} href={href} label={label} Icon={Icon} />
        ))}
      </nav>

      <AddModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
