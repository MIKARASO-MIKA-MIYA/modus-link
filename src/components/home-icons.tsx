export function HomeIcon({ kind }: { kind: "globe" | "support" | "bolt" }) {
  return <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "globe" ? <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 9h18M3 15h18" /></> : kind === "support" ? <><path d="M4 13v-2a8 8 0 0 1 16 0v2M20 18c0 3-3 3-7 3" /><rect x="2" y="11" width="4" height="8" rx="2" /><rect x="18" y="11" width="4" height="8" rx="2" /><path d="M10 21h3" /></> : <path d="m13 2-9 12h7l-1 8 10-13h-8Z" />}
  </svg>;
}
