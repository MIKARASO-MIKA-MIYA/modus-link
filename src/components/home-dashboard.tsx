"use client";
import Link from "next/link";
import { useState } from "react";
import type { AnalyticsDto, PageDto, TicketDto } from "@/types/api";
import { homeSummary, share } from "@/lib/home-summary";
import { useAuth } from "./app-frame";
import { useResource } from "./use-resource";
import { Icon } from "./ui/icon";
import { EmptyState, ErrorNotice, Loading, StatusBadge } from "./ui/shared";
import { dateLabel } from "./ui/format";
import { HomeStatuses, HomeTrend } from "./home-charts";

const recentDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Qyzylorda",
});

export function HomeDashboard() {
  const { actor } = useAuth();
  const [days, setDays] = useState("7");
  const summary = useResource<AnalyticsDto>("analytics/overview?days=all");
  const trend = useResource<AnalyticsDto>(`analytics/overview?days=${days}`);
  const recent = useResource<PageDto<TicketDto>>("tickets?pageSize=3&sortBy=createdAt&order=desc");
  const data = summary.data, counts = data ? homeSummary(data) : null;
  const scope = data?.scope === "COMPANY" ? "По всей компании" : data?.scope === "OWN" ? "Мои обращения" : "Подразделение и назначения";
  const cards = [
    { label: "Всего обращений", count: counts?.total, icon: "file" as const, first: true, note: scope, badge: "Весь период", title: scope },
    { label: "Активные", count: counts?.active, icon: "clock" as const, note: "от всех обращений", badge: counts ? share(counts.active, counts.total) : "—", title: "Все незавершённые статусы: новые, на рассмотрении, уточнение и в работе" },
    { label: "Завершено", count: counts?.completed, icon: "check" as const, note: "от всех обращений", badge: counts ? share(counts.completed, counts.total) : "—", title: "Завершённые обращения без отклонённых исходов" },
  ];
  return <div className="home-dashboard">
    <div className="home-intro"><section className="home-heading"><div><div className="home-eyebrow">MODUS LINK <span /></div><h1>Панель управления</h1><p>Обзор обращений, статусы и ключевые показатели.</p></div><Link href="/tickets/new" className="home-create"><Icon name="plus" size={26} />Создать обращение</Link></section>
    <ErrorNotice message={summary.error} retry={summary.refresh} /></div>
    <div className="home-metrics" aria-busy={summary.loading}>{cards.map(card => <article key={card.label} className={`home-stat${card.first ? " home-stat-primary" : ""}`} title={card.title}>
      <span className={`home-stat-icon${card.icon === "check" ? " home-stat-check" : ""}`}><Icon name={card.icon} size={40} /></span><div><h2>{card.label}</h2><strong className="home-stat-value">{card.count ?? "—"}</strong><div className="home-stat-note"><span className={`home-stat-share${card.first || card.icon === "check" ? " is-positive" : ""}`}>{card.badge}</span><span>{data ? card.note : summary.loading ? "Загрузка…" : "Данные недоступны"}</span></div></div>
    </article>)}</div>
    <div className="home-middle">
      <section className="home-card home-trend-card"><div className="home-card-heading"><h2><span className="home-section-icon"><Icon name="chart" size={26} /></span>Динамика обращений</h2><select aria-label="Период динамики обращений" value={days} onChange={event => setDays(event.target.value)}><option value="7">Последние 7 дней</option><option value="30">Последние 30 дней</option><option value="90">Последние 90 дней</option></select></div>
        <ErrorNotice message={trend.error} retry={trend.refresh} />{trend.loading && !trend.data ? <Loading /> : trend.data ? trend.data.dailyTrend.some(row => row.created > 0) ? <HomeTrend data={trend.data.dailyTrend} /> : <EmptyState title="За этот период обращений нет" text="Выберите другой период, чтобы увидеть динамику." /> : null}
      </section>
      <section className="home-card home-status-card"><div className="home-card-heading"><h2>Обращения по статусам</h2></div>{!data ? summary.loading ? <Loading /> : <p className="home-unavailable">Не удалось получить сводку</p> : counts?.total ? <HomeStatuses data={data} /> : <EmptyState title="Обращений пока нет" text="Статистика появится после первого обращения." />}</section>
    </div>
    <section className="home-card home-recent"><div className="home-card-heading"><h2><span className="home-section-icon"><Icon name="file" size={26} /></span>Последние обращения</h2><Link className="home-view-all" href="/tickets">Смотреть все <Icon name="arrow" size={19} /></Link></div>
      <ErrorNotice message={recent.error} retry={recent.refresh} />
      {recent.loading && !recent.data ? <Loading /> : recent.data?.items.length ? <div className="home-table-scroll"><table className="home-table"><thead><tr><th>№</th><th>Тема</th><th>Категория</th><th>Статус</th><th>Исполнитель</th><th>Дата</th><th><span className="sr-only">Открыть</span></th></tr></thead><tbody>{recent.data.items.map(ticket => <tr key={ticket.id}><td><Link href={`/tickets/${ticket.id}`}>{ticket.number}</Link></td><td><Link href={`/tickets/${ticket.id}`}>{ticket.title}</Link></td><td><span className="home-table-category"><Icon name="folder" size={22} />{ticket.category.name}</span></td><td><StatusBadge status={ticket.status} /></td><td>{ticket.assignee?.name ?? "Не назначен"}</td><td><time dateTime={ticket.createdAt} title={dateLabel(ticket.createdAt, true)}>{recentDate.format(new Date(ticket.createdAt))}</time></td><td><Link className="home-row-open" href={`/tickets/${ticket.id}`} aria-label={`Открыть обращение ${ticket.number}`}>•••</Link></td></tr>)}</tbody></table></div> : !recent.error ? <EmptyState title="Доступных обращений пока нет" text={actor.canViewCompanyAnalytics ? "Общая аналитика не предоставляет доступ к чужим карточкам." : "Создайте обращение — оно появится в этом списке."} /> : null}
    </section>
  </div>;
}
