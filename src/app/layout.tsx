import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFrame } from "@/components/app-frame";
import { Brand } from "@/components/ui/icon";
import { Loading } from "@/components/ui/shared";
import { themeInitScript } from "@/lib/theme";
import "./theme.css";
import "./globals.css";
import "./home.css";
export const metadata: Metadata = {
  title: {
    default: "MODUS LINK — обратная связь сотрудников",
    template: "%s · MODUS LINK",
  },
  description:
    "Единая платформа обращений и предложений сотрудников ГК «Модус Трейд»",
  icons: {
    icon: [
      { url: "/favicon.ico?v=original-logo", sizes: "any" },
      { url: "/favicon-32.png?v=original-logo", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.ico?v=original-logo",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" data-theme="light" suppressHydrationWarning>
      <head>
        <script id="modus-theme-init" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Suspense
          fallback={
            <div className="app-loading">
              <Brand />
              <Loading />
            </div>
          }
        >
          <AppFrame>{children}</AppFrame>
        </Suspense>
      </body>
    </html>
  );
}
