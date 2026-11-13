"use client";
import { LoginScreen } from "./login-screen";

import { HomeShell } from "./home-shell";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { Actor, DepartmentDto, PageDto } from "@/types/api";
import { api, ApiRequestError, writeApi } from "@/lib/client-api";
import { useResource } from "./use-resource";
import { Brand } from "./ui/icon";
import { ErrorNotice, Loading } from "./ui/shared";

const AuthContext = createContext<{
  actor: Actor;
  department: string;
  logout: () => Promise<void>;
} | null>(null);
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Missing authenticated layout");
  return value;
}
export interface NoticeDto {
  id: string;
  action: string;
  createdAt: string;
  actor: { name: string };
  ticket: { id: string; number: string; title: string };
}
function Workspace({
  actor,
  logout,
  logoutError,
  children,
}: {
  actor: Actor;
  logout: () => Promise<void>;
  logoutError: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const departments = useResource<PageDto<DepartmentDto>>(
    "departments?pageSize=100",
  );
  const notices = useResource<{ items: NoticeDto[] }>("notifications");
  const [seenAt, setSeenAt] = useState<string | null>(null);
  useEffect(() => {
    const update = () =>
      setSeenAt(localStorage.getItem(`modus:seen:${actor.id}`));
    queueMicrotask(update);
    window.addEventListener("modus:notices-read", update);
    return () => window.removeEventListener("modus:notices-read", update);
  }, [actor.id]);
  useEffect(() => {
    window.addEventListener("modus:records-updated", notices.refresh);
    return () =>
      window.removeEventListener("modus:records-updated", notices.refresh);
  }, [notices.refresh]);
  const unseen =
    notices.data?.items.filter((n) => !seenAt || n.createdAt > seenAt).length ??
    0;
  const department =
    departments.data?.items.find((d) => d.id === actor.departmentId)?.name ??
    "";
  return <AuthContext.Provider value={{ actor, department, logout }}><HomeShell pathname={pathname} actor={actor} unread={unseen} logout={logout} logoutError={logoutError}>{children}</HomeShell></AuthContext.Provider>;
}
export function AppFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null | undefined>(undefined);
  const [authError, setAuthError] = useState<string | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    api<Actor>("auth/me")
      .then((user) => {
        if (live) setActor(user);
      })
      .catch((error: unknown) => {
        if (!live) return;
        if (error instanceof ApiRequestError && error.status === 401)
          setActor(null);
        else
          setAuthError(
            "Не удалось проверить сессию. Проверьте подключение и повторите попытку.",
          );
      });
    const expire = () => {
      setAuthError(null);
      setLogoutError(null);
      setActor(null);
    };
    window.addEventListener("modus:session-expired", expire);
    return () => {
      live = false;
      window.removeEventListener("modus:session-expired", expire);
    };
  }, [revision]);
  async function logout() {
    setLogoutError(null);
    try {
      await writeApi("auth/logout", {});
    } catch (error) {
      if (!(error instanceof ApiRequestError && error.status === 401)) {
        setLogoutError(
          "Не удалось выйти. Сессия может оставаться активной. Повторите выход.",
        );
        return;
      }
    }
    setActor(null);
    router.replace("/");
  }
  if (authError)
    return (
      <div className="app-loading">
        <Brand />
        <ErrorNotice
          message={authError}
          retry={() => {
            setAuthError(null);
            setRevision((value) => value + 1);
          }}
        />
      </div>
    );
  if (actor === undefined)
    return (
      <div className="app-loading">
        <Brand />
        <Loading label="Открываем ваш кабинет…" />
      </div>
    );
  if (!actor)
    return (
      <LoginScreen
        onLogin={(user) => {
          setActor(user);
          router.replace("/");
        }}
      />
    );
  return (
    <Workspace
      key={actor.id}
      actor={actor}
      logout={logout}
      logoutError={logoutError}
    >
      {children}
    </Workspace>
  );
}
