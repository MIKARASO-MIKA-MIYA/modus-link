"use client";
import Link from "next/link";
import type { AnalyticsDto, PageDto, TicketDto } from "@/types/api";
import { useAuth } from "./app-frame";
import { useResource } from "./use-resource";
import { AnalyticsScreen } from "./analytics-screen";
import { SettingsHome } from "./settings-home";
import { Icon } from "./ui/icon";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  MetricCard,
  PageHeading,
  StatusBadge,
} from "./ui/shared";
import { TicketTable } from "./ticket-table";
import { CategoryBars, Donut, TrendChart } from "./charts";
import { isOverdue } from "./ui/format";
export function Dashboard() {
  const { actor } = useAuth();
  if (actor.role === "ADMIN") return <SettingsHome />;
  if (actor.canViewCompanyAnalytics) return <AnalyticsScreen />;
  return actor.role === "EMPLOYEE" ? (
    <EmployeeDashboard />
  ) : (
    <ManagerDashboard />
  );
}
function EmployeeDashboard() {
  const summary = useResource<AnalyticsDto>("analytics/overview");
  const recent = useResource<PageDto<TicketDto>>("tickets?pageSize=5");
  const data = summary.data;
  return (
    <>
      <PageHeading
        title="Добро пожаловать, коллега!"
        description="Здесь вы можете сообщить о проблеме, предложить улучшение и отследить результат."
      />
      <ErrorNotice
        message={summary.error || recent.error}
        retry={() => {
          summary.refresh();
          recent.refresh();
        }}
      />
      {data ? (
        <div className="metrics-grid metrics-grid-three employee-metrics">
          <MetricCard
            label="Мои обращения"
            value={data.total}
            icon="ticket"
            href="/tickets?includeArchived=true"
            note="Всего обращений"
          />
          <MetricCard
            label="В работе"
            value={data.inProgress + data.underReview}
            icon="clock"
            tone="orange"
            href="/tickets?stateGroup=ACTIVE"
            note="Рассматриваются и реализуются"
          />
          <MetricCard
            label="Реализовано"
            value={data.byCategory.reduce(
              (sum, row) => sum + row.implemented,
              0,
            )}
            icon="check"
            tone="green"
            href="/tickets?stateGroup=IMPLEMENTED&includeArchived=true"
            note="Идеи стали результатом"
          />
        </div>
      ) : (
        summary.loading && <Loading />
      )}
      <section className="idea-banner">
        <span className="idea-banner-icon">
          <Icon name="megaphone" size={46} />
        </span>
        <div>
          <h2>Есть идея или заметили проблему?</h2>
          <p>
            Поделитесь с нами — это поможет сделать нашу работу ещё эффективнее!
          </p>
        </div>
        <Link className="button button-primary" href="/tickets/new">
          Создать обращение
          <Icon name="arrow" size={18} />
        </Link>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>Мои последние обращения</h2>
          <Link className="text-button" href="/tickets">
            Все обращения
            <Icon name="arrow" size={17} />
          </Link>
        </div>
        {recent.loading && !recent.data ? (
          <Loading />
        ) : recent.data?.items.length ? (
          <TicketTable items={recent.data.items} compact />
        ) : (
          !recent.error && (
            <EmptyState
              text="Расскажите, что можно улучшить в работе компании."
              action={
                <Link href="/tickets/new" className="button button-primary">
                  <Icon name="plus" size={18} />
                  Создать обращение
                </Link>
              }
            />
          )
        )}
      </section>
    </>
  );
}
function ManagerDashboard() {
  const summary = useResource<AnalyticsDto>("analytics/overview");
  const fresh = useResource<PageDto<TicketDto>>(
    "tickets?status=NEW&pageSize=3",
  );
  const clarification = useResource<PageDto<TicketDto>>(
    "tickets?status=NEEDS_CLARIFICATION&pageSize=2",
  );
  const data = summary.data;
  const attention = [
    ...(fresh.data?.items ?? []),
    ...(clarification.data?.items ?? []),
  ].slice(0, 4);
  return (
    <>
      <PageHeading
        title="Обзор обращений"
        description="Актуальная ситуация по обращениям вашего подразделения"
      />
      <ErrorNotice
        message={summary.error || fresh.error || clarification.error}
        retry={() => {
          summary.refresh();
          fresh.refresh();
          clarification.refresh();
        }}
      />
      {data ? (
        <>
          <div className="metrics-grid">
            <MetricCard
              label="Новые"
              value={data.new}
              icon="ticket"
              href="/tickets?status=NEW"
            />
            <MetricCard
              label="В работе"
              value={data.inProgress}
              icon="refresh"
              tone="orange"
              href="/tickets?status=IN_PROGRESS"
            />
            <MetricCard
              label="Просрочены"
              value={data.overdue}
              icon="alert"
              tone="red"
              href="/tickets?overdue=true"
            />
            <MetricCard
              label="Завершены"
              value={data.completed}
              icon="check"
              tone="green"
              href="/tickets?stateGroup=COMPLETED&includeArchived=true"
            />
          </div>
          <div className="dashboard-grid">
            <section className="panel attention-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-title">
                    <Icon name="target" size={25} />
                    <h2>Требуют внимания</h2>
                  </div>
                  <p className="panel-note">
                    Новые обращения и запросы на уточнение
                  </p>
                </div>
                <Link className="text-button" href="/tickets">
                  Все обращения
                  <Icon name="arrow" size={16} />
                </Link>
              </div>
              {attention.length ? (
                <div className="attention-list">
                  {attention.map((t) => (
                    <Link
                      className="attention-row"
                      key={t.id}
                      href={`/tickets/${t.id}`}
                    >
                      <span className="attention-icon">
                        <Icon name="file" size={23} />
                      </span>
                      <span className="attention-text">
                        <strong>
                          #{t.number} · {t.category.name}
                        </strong>
                        <small>{t.description}</small>
                      </span>
                      <StatusBadge status={t.status} overdue={isOverdue(t)} />
                      <Icon name="chevron" size={19} />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Всё под контролем"
                  text="Новых обращений и запросов на уточнение нет."
                />
              )}
              <Link
                className="button button-primary button-wide attention-action"
                href="/tickets"
              >
                <Icon name="ticket" size={19} />
                Открыть все обращения
              </Link>
            </section>
            <section className="panel">
              <h2>Сроки рассмотрения</h2>
              <Donut
                items={[
                  {
                    label: "В срок",
                    value: data.deadlineDistribution.onTime,
                    color: "#35b77b",
                  },
                  {
                    label: "Близко к сроку",
                    value: data.deadlineDistribution.approaching,
                    color: "#ffc24f",
                  },
                  {
                    label: "Просрочено",
                    value: data.deadlineDistribution.overdue,
                    color: "#ec5968",
                  },
                ]}
                center={
                  data.total - data.completed
                    ? `${Math.round(((data.total - data.completed - data.overdue) / (data.total - data.completed)) * 100)}%`
                    : "—"
                }
                caption="в срок"
              />
            </section>
            <section className="panel">
              <h2>Динамика обращений</h2>
              <TrendChart data={data.dailyTrend} />
            </section>
            <section className="panel">
              <h2>Топ категорий</h2>
              <CategoryBars groups={data.byCategory} percent />
            </section>
          </div>
        </>
      ) : (
        summary.loading && <Loading />
      )}
    </>
  );
}
