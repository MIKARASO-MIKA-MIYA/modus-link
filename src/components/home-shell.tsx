"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Actor, PageDto, TicketDto } from "@/types/api";
import { useResource } from "./use-resource";
import { Icon, type IconName } from "./ui/icon";
import { ErrorNotice } from "./ui/shared";
import { initials, roleLabels } from "./ui/format";
import { ThemeToggle } from "./theme-toggle";
import { HomeIcon } from "./home-icons";

export function HomeShell({ actor, unread, logout, logoutError, children }: {
  actor: Actor; unread: number; logout: () => Promise<void>; logoutError: string | null; children: ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const tickets = useResource<PageDto<TicketDto>>("tickets?pageSize=1");
  const role = actor.canViewCompanyAnalytics && actor.role === "MANAGER" ? "Собственник" : roleLabels[actor.role];
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); input.current?.focus();
      }
      if (event.key === "Escape") { setMenuOpen(false); setProfileOpen(false); }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const main: { href: string; title: string; icon: IconName; badge?: number }[] = [
    { href: "/", title: "Главная", icon: "home" },
    { href: "/tickets", title: actor.role === "EMPLOYEE" ? "Мои обращения" : "Все обращения", icon: "file", badge: tickets.data?.pagination.total },
    { href: "/tickets/new", title: "Создать обращение", icon: "plus" },
    { href: "/analytics", title: "Аналитика", icon: "chart" },
  ];
  const administration: typeof main = [
    ...(actor.role !== "EMPLOYEE" ? [{ href: "/team", title: actor.role === "ADMIN" ? "Сотрудники" : "Команда", icon: "users" as const }] : []),
    ...(actor.role === "ADMIN" ? [
      { href: "/settings/categories", title: "Категории", icon: "layers" as const },
      { href: "/settings", title: "Настройки", icon: "settings" as const },
    ] : []),
  ];
  function links(items: typeof main) {
    return items.map(item => <Link key={item.href} href={item.href} className={`home-nav-link${item.href === "/" ? " is-active" : ""}`} aria-current={item.href === "/" ? "page" : undefined} onClick={() => setMenuOpen(false)}>
      <Icon name={item.icon} size={27} /><span>{item.title}</span>
      {item.badge !== undefined && item.badge > 0 && <span className="home-nav-count" aria-label={`${item.badge} доступных обращений`}>{item.badge}</span>}
    </Link>);
  }
  return <div className="workspace-home">
    <a className="skip-link" href="#main-content">Перейти к содержимому</a>
    {menuOpen && <button className="home-sidebar-scrim" aria-label="Закрыть навигацию" onClick={() => setMenuOpen(false)} />}
    <aside id="home-sidebar" className={`home-sidebar${menuOpen ? " is-open" : ""}`}>
      <Link href="/" className="home-brand" aria-label="MODUS LINK — главная"><Image src="/modus-link-logo.png" width={84} height={56} alt="" unoptimized /><span>MODUS LINK</span></Link>
      <nav aria-label="Основная навигация">{links(main)}
        {administration.length > 0 && <div className="home-nav-secondary">{links(administration)}</div>}
      </nav>
      <Link className="home-support" href="/help"><HomeIcon kind="support" /><span><strong>Поддержка</strong><small>Помощь и инструкции</small></span><Icon name="chevron" size={20} /></Link>
    </aside>
    <header className="home-topbar">
      <button className="home-round-button home-menu-toggle" aria-label="Открыть навигацию" aria-controls="home-sidebar" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name="menu" /></button>
      <form className="home-search" role="search" onSubmit={event => {
        event.preventDefault(); const query = search.trim();
        if (query.length === 1) { input.current?.setCustomValidity("Введите не менее двух символов"); input.current?.reportValidity(); return; }
        router.push(query ? `/tickets?q=${encodeURIComponent(query)}` : "/tickets");
      }}>
        <Icon name="search" size={29} /><input ref={input} aria-label="Поиск по обращениям и авторам" placeholder="Поиск по обращениям и авторам…" value={search} onChange={event => { event.target.setCustomValidity(""); setSearch(event.target.value); }} /><kbd>Ctrl + K</kbd>
      </form>
      <div className="home-header-controls">
        <span className="home-language" aria-label="Язык интерфейса — русский"><HomeIcon kind="globe" /><strong>RU</strong></span>
        <ThemeToggle />
        <Link href="/notifications" className="home-round-button home-notifications" aria-label={`Уведомления${unread ? `: ${unread} новых` : ""}`}><Icon name="bell" size={27} />{unread > 0 && <span className="home-unread-dot" />}</Link>
        <div className="home-profile">
          <button className="home-profile-trigger" aria-expanded={profileOpen} aria-controls="home-profile-menu" onClick={() => setProfileOpen(!profileOpen)}>
            <span className="home-avatar">{initials(actor.name)}</span><span className="home-profile-name"><strong title={actor.name}>{actor.name}</strong><small>{role}</small></span><Icon name="chevron" size={17} />
          </button>
          {profileOpen && <><button className="menu-dismiss" aria-label="Закрыть меню профиля" onClick={() => setProfileOpen(false)} /><div id="home-profile-menu" className="home-profile-menu"><Link href="/profile">Мой профиль</Link><button onClick={() => { setProfileOpen(false); void logout(); }}>Выход</button></div></>}
        </div>
      </div>
    </header>
    <main id="main-content" className="home-main"><ErrorNotice message={logoutError} retry={() => void logout()} />{children}</main>
  </div>;
}
