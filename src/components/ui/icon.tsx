import type { CSSProperties } from "react";
export type IconName =
  | "home"
  | "ticket"
  | "plus"
  | "bell"
  | "user"
  | "users"
  | "chart"
  | "settings"
  | "logout"
  | "arrow"
  | "back"
  | "chevron"
  | "check"
  | "clock"
  | "alert"
  | "search"
  | "close"
  | "briefcase"
  | "layers"
  | "route"
  | "building"
  | "shield"
  | "help"
  | "file"
  | "paperclip"
  | "send"
  | "edit"
  | "save"
  | "refresh"
  | "target"
  | "book"
  | "download"
  | "menu"
  | "lightbulb"
  | "thumbs"
  | "monitor"
  | "graduation"
  | "folder"
  | "calendar"
  | "archive"
  | "sort"
  | "megaphone";
const paths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    </>
  ),
  ticket: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 1v1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a6 6 0 0 0-12 0v2M20 21v-2a6 6 0 0 0-3-5M16 3a4 4 0 0 1 0 8" />
      <circle cx="10" cy="7" r="4" />
    </>
  ),
  chart: (
    <>
      <path d="M3 21h18M5 21V11h4v10M10 21V6h4v15M15 21V2h4v19" />
    </>
  ),
  settings: (
    <>
      <path d="m10 3 1-2h2l1 2 3 1 2-1 2 3-1 2v3l2 2-2 3h-2l-2 2-1 3h-4l-1-3-2-2H4l-2-3 2-2V8L3 6l2-3 2 1Z" />
      <circle cx="12" cy="11" r="4" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H4v18h5M12 12h10m-4-4 4 4-4 4" />
    </>
  ),
  arrow: <path d="M4 12h16m-7-7 7 7-7 7" />,
  back: <path d="M20 12H4m7-7-7 7 7 7" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  alert: (
    <>
      <path d="m12 3 10 18H2Z" />
      <path d="M12 9v5m0 3v.1" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="7.5" />
      <path d="m16 16 6 6" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V3h8v4M3 12a24 24 0 0 0 18 0M10 12v3h4v-3" />
    </>
  ),
  layers: (
    <>
      <path d="m2 7 10-5 10 5-10 5ZM2 12l10 5 10-5M2 17l10 5 10-5" />
    </>
  ),
  route: (
    <>
      <path d="M3 12h6c4 0 4-8 8-8h4m-4-3 4 3-4 3M9 12c4 0 4 8 8 8h4m-4-3 4 3-4 3" />
    </>
  ),
  building: (
    <>
      <rect x="8" y="2" width="8" height="6" rx="1" />
      <path d="M12 8v7M4 15h16M4 15v3m8-3v3m8-3v3" />
      <rect x="1" y="18" width="6" height="5" rx="1" />
      <rect x="9" y="18" width="6" height="5" rx="1" />
      <rect x="17" y="18" width="6" height="5" rx="1" />
    </>
  ),
  shield: (
    <>
      <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8a3 3 0 1 1 4 3c-1 0-1 2-1 3m0 3v.1" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H5v20h14V7Z M14 2v6h5M8 12h8M8 16h8" />
    </>
  ),
  paperclip: (
    <path d="m8 13 7-7a3 3 0 0 1 4 4L9 20a5 5 0 0 1-7-7L13 2m-7 13 9-9" />
  ),
  send: (
    <>
      <path d="m3 3 19 9-19 9 4-9ZM7 12h15" />
    </>
  ),
  edit: (
    <>
      <path d="m15 3 6 6M3 21l2-7L17 2l5 5L10 19Z" />
    </>
  ),
  save: (
    <>
      <path d="M4 3h13l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 8a9 9 0 0 0-15-3L2 8m0-6v6h6M4 16a9 9 0 0 0 15 3l3-3m0 6v-6h-6" />
    </>
  ),
  target: (
    <>
      <circle cx="11" cy="13" r="9" />
      <circle cx="11" cy="13" r="5" />
      <path d="m11 13 10-10m-1-2 1 2 2 1" />
    </>
  ),
  book: (
    <>
      <path d="M3 3h14a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3Zm0 14h17M7 3v8l3-2 3 2V3" />
    </>
  ),
  download: <path d="M12 2v13m-5-5 5 5 5-5M3 17v5h18v-5" />,
  menu: <path d="M3 5h18M3 12h18M3 19h18" />,
  lightbulb: (
    <>
      <path d="M8 17c0-3-3-3-3-8a7 7 0 0 1 14 0c0 5-3 5-3 8ZM9 21h6" />
    </>
  ),
  thumbs: (
    <>
      <path d="M8 21H3V9h5m0 12h10a2 2 0 0 0 2-2l2-8a2 2 0 0 0-2-2h-6l1-5a2 2 0 0 0-4-1L8 9Z" />
    </>
  ),
  monitor: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M12 17v4M7 21h10" />
    </>
  ),
  graduation: (
    <>
      <path d="m2 8 10-5 10 5-10 5ZM6 10v8a10 10 0 0 0 12 0v-8M22 8v8" />
    </>
  ),
  folder: <path d="M3 5h7l2 3h9v13H3Z" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="17" rx="2" />
      <path d="M7 2v6m10-6v6M3 11h18" />
    </>
  ),
  archive: (
    <>
      <path d="M4 7v14h16V7M2 3h20v4H2ZM9 12h6" />
    </>
  ),
  sort: <path d="M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4" />,
  megaphone: (
    <>
      <path d="M4 9h5L20 3v18L9 15H4ZM6 15l3 7h4l-3-7M1 9v6M23 9v6" />
    </>
  ),
};
export function Icon({
  name,
  size = 22,
  className = "",
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {paths[name]}
    </svg>
  );
}
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand-compact" : ""}`}>
      <svg viewBox="0 0 60 40" aria-hidden="true"><image href="/modus-link-logo.png" width="60" height="40" /></svg>
      <span>MODUS LINK</span>
    </span>
  );
}
