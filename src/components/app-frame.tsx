"use client";
import { LoginScreen } from "./login-screen";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import type { Actor, DepartmentDto, PageDto, TicketDto } from "@/types/api";
import { api, writeApi } from "@/lib/client-api";
import { useResource } from "./use-resource";
import { Brand, Icon, type IconName } from "./ui/icon";
import { Loading } from "./ui/shared";
import { initials, roleLabels } from "./ui/format";
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
  children,
}: {
  actor: Actor;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const departments = useResource<PageDto<DepartmentDto>>(
    "departments?pageSize=100",
  );
  const queue = useResource<PageDto<TicketDto>>(
    actor.role === "EMPLOYEE" ? null : "tickets?unassigned=true&pageSize=1",
  );
  const late = useResource<PageDto<TicketDto>>(
    actor.role === "EMPLOYEE" ? null : "tickets?overdue=true&pageSize=1",
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
  const employee = actor.role === "EMPLOYEE";
  const company = actor.canViewCompanyAnalytics;
  const title = employee
    ? "Кабинет сотрудника"
    : actor.role === "ADMIN"
      ? "Управление системой"
      : company
        ? "Обзор компании"
        : "Кабинет руководителя";
  const nav: { href: string; title: string; icon: IconName; badge?: number }[] =
    employee
      ? [
          { href: "/", title: "Главная", icon: "home" },
          { href: "/tickets", title: "Мои обращения", icon: "ticket" },
          { href: "/tickets/new", title: "Создать обращение", icon: "plus" },
          {
            href: "/notifications",
            title: "Уведомления",
            icon: "bell",
            badge: unseen,
          },
          { href: "/help", title: "База знаний", icon: "book" },
        ]
      : [
          { href: "/", title: "Обзор", icon: "home" },
          { href: "/tickets", title: "Все обращения", icon: "layers" },
          {
            href: "/tickets?unassigned=true",
            title: "Без ответственного",
            icon: "users",
            badge: queue.data?.pagination.total,
          },
          {
            href: "/tickets?overdue=true",
            title: "Просроченные",
            icon: "clock",
            badge: late.data?.pagination.total,
          },
          { href: "/analytics", title: "Аналитика", icon: "chart" },
          {
            href: "/team",
            title: actor.role === "ADMIN" ? "Пользователи" : "Команда",
            icon: "users",
          },
          ...(actor.role === "ADMIN"
            ? [
                {
                  href: "/settings",
                  title: "Настройки системы",
                  icon: "settings" as const,
                },
              ]
            : []),
        ];
  function active(href: string) {
    if (href.includes("?")) {
      const [path, query] = href.split("?");
      return (
        pathname === path &&
        [...new URLSearchParams(query)].every(
          ([key, value]) => searchParams.get(key) === value,
        )
      );
    }
    if (href === "/") return pathname === "/";
    if (href === "/tickets")
      return (
        !searchParams.has("unassigned") &&
        !searchParams.has("overdue") &&
        (pathname === "/tickets" ||
          (pathname.startsWith("/tickets/") && pathname !== "/tickets/new"))
      );
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return (
    <AuthContext.Provider value={{ actor, department, logout }}>
      <div className="workspace" data-role={actor.role.toLowerCase()}>
        <a className="skip-link" href="#main-content">
          Перейти к содержимому
        </a>
        {mobileOpen && (
          <button
            className="sidebar-scrim"
            onClick={() => setMobileOpen(false)}
            aria-label="Закрыть навигацию"
          />
        )}
        <aside className={`sidebar ${mobileOpen ? "is-open" : ""}`}>
          <Link
            href="/"
            className="sidebar-brand"
            onClick={() => setMobileOpen(false)}
          >
            <Brand compact />
          </Link>
          <div className="sidebar-caption">
            {employee ? "МОЙ КАБИНЕТ" : "ПАНЕЛЬ УПРАВЛЕНИЯ"}
          </div>
          <nav aria-label="Основная навигация">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${active(item.href) ? "is-active" : ""}`}
                onClick={() => setMobileOpen(false)}
                aria-current={active(item.href) ? "page" : undefined}
              >
                <Icon name={item.icon} size={21} />
                <span>{item.title}</span>
                {Boolean(item.badge) && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <Link
              className={`nav-item ${pathname === "/profile" ? "is-active" : ""}`}
              href="/profile"
            >
              <Icon name="user" size={21} />
              Профиль
            </Link>
            <Link className="nav-item" href="/help">
              <Icon name="help" size={21} />
              Справка
            </Link>
            <button className="nav-item" onClick={() => void logout()}>
              <Icon name="logout" size={21} />
              Выход
            </button>
            <div className="sidebar-company">
              ГК «Модус Трейд»<span>Платформа обратной связи</span>
            </div>
          </div>
        </aside>
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="Открыть навигацию"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <div className="topbar-context">{title}</div>
          {!employee && (
            <form
              className="header-search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/tickets?q=${encodeURIComponent(search.trim())}`);
              }}
            >
              <Icon name="search" size={19} />
              <input
                aria-label="Поиск обращений"
                placeholder="Поиск обращений, сотрудников…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
          )}
          <div className="topbar-actions">
            <span className="role-pill">
              <Icon
                name={
                  actor.role === "ADMIN"
                    ? "shield"
                    : employee
                      ? "user"
                      : "briefcase"
                }
                size={19}
              />
              {company && actor.role === "MANAGER"
                ? "Собственник"
                : roleLabels[actor.role]}
            </span>
            <Link
              href="/notifications"
              className="icon-button notification-bell"
              aria-label={`Уведомления${unseen ? `: ${unseen} новых` : ""}`}
            >
              <Icon name="bell" size={24} />
              {unseen > 0 && <span className="notification-dot" />}
            </Link>
            <div className="profile-menu">
              <button
                className="profile-trigger"
                aria-expanded={profileOpen}
                onClick={() => setProfileOpen((v) => !v)}
              >
                <span className="avatar avatar-header">
                  {initials(actor.name)}
                </span>
                <span className="profile-caption">
                  <strong>{actor.name}</strong>
                  <small>{department || roleLabels[actor.role]}</small>
                </span>
                <Icon name="chevron" className="chevron-down" size={16} />
              </button>
              {profileOpen && (
                <>
                  <button
                    className="menu-dismiss"
                    aria-label="Закрыть меню профиля"
                    onClick={() => setProfileOpen(false)}
                  />
                  <div className="dropdown-menu">
                    <Link href="/profile" onClick={() => setProfileOpen(false)}>
                      <Icon name="user" size={18} />
                      Мой профиль
                    </Link>
                    <button onClick={() => void logout()}>
                      <Icon name="logout" size={18} />
                      Выйти из системы
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="main-content" key={actor.id}>
          {children}
        </main>
      </div>
    </AuthContext.Provider>
  );
}
export function AppFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [actor, setActor] = useState<Actor | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    api<Actor>("auth/me")
      .then((user) => {
        if (live) setActor(user);
      })
      .catch(() => {
        if (live) setActor(null);
      });
    const expire = () => setActor(null);
    window.addEventListener("modus:session-expired", expire);
    return () => {
      live = false;
      window.removeEventListener("modus:session-expired", expire);
    };
  }, []);
  async function logout() {
    try {
      await writeApi("auth/logout", {});
    } finally {
      setActor(null);
      router.replace("/");
    }
  }
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
    <Workspace key={actor.id} actor={actor} logout={logout}>
      {children}
    </Workspace>
  );
}
