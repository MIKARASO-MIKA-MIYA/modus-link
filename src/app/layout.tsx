import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFrame } from "@/components/app-frame";
import { Brand } from "@/components/ui/icon";
import { Loading } from "@/components/ui/shared";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "MODUS LINK — обратная связь сотрудников",
    template: "%s · MODUS LINK",
  },
  description:
    "Единая платформа обращений и предложений сотрудников ГК «Модус Трейд»",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
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
