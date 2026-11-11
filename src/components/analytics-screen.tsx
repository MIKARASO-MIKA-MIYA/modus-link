"use client";
import { useState } from "react";
import type { AnalyticsDto } from "@/types/api";
import { useResource } from "./use-resource";
import { useAuth } from "./app-frame";
import { CategoryBars, Donut, TrendChart } from "./charts";
import { ErrorNotice, Loading, MetricCard, PageHeading } from "./ui/shared";
import { Icon } from "./ui/icon";
import { downloadCsv } from "./ticket-table";
export function AnalyticsScreen() {
  const { actor } = useAuth();
  const [days, setDays] = useState("30");
  const resource = useResource<AnalyticsDto>(`analytics/overview?days=${days}`);
  const data = resource.data;
  return (
    <>
      <PageHeading
        title="Аналитика"
        description={
          actor.canViewCompanyAnalytics || actor.role === "ADMIN"
            ? "Общая картина по компании"
            : "Обращения в пределах ваших полномочий"
        }
        action={
          <div className="analytics-actions">
            <label>
              Период:{" "}
              <select value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="7">Последние 7 дней</option>
                <option value="30">Последние 30 дней</option>
                <option value="90">Последние 90 дней</option>
                <option value="all">Всё время</option>
              </select>
            </label>
            <button
              className="icon-button"
              title="Скачать отчёт по подразделениям"
              aria-label="Скачать отчёт CSV"
              disabled={!data}
              onClick={() =>
                data &&
                downloadCsv("modus-link-analytics.csv", [
                  [
                    "Подразделение",
                    "Всего",
                    "Завершено",
                    "Просрочено",
                    "Реализовано",
                    "Отклонено",
                  ],
                  ...data.byDepartment.map((row) => [
                    row.name,
                    row.total,
                    row.completed,
                    row.overdue,
                    row.implemented,
                    row.rejected,
                  ]),
                ])
              }
            >
              <Icon name="download" size={20} />
            </button>
          </div>
        }
      />
      <ErrorNotice message={resource.error} retry={resource.refresh} />
      {!data ? (
        resource.loading && <Loading />
      ) : (
        <>
          <div className="metrics-grid analytics-metrics">
            <MetricCard
              label="Всего обращений"
              value={data.total}
              icon="ticket"
            />
            <MetricCard
              label="В работе"
              value={data.inProgress}
              icon="clock"
              tone="orange"
            />
            <MetricCard
              label="Реализовано улучшений"
              value={data.implementedImprovements}
              icon="check"
              tone="green"
            />
            <MetricCard
              label="Завершено в срок"
              value={
                data.onTimeShare === null
                  ? "—"
                  : `${Math.round(data.onTimeShare * 100)}%`
              }
              icon="shield"
              tone="green"
            />
          </div>
          <div className="analytics-grid">
            <section className="panel">
              <h2>Обращения по типам</h2>
              <Donut
                items={data.byType.map((row) => ({
                  label: {
                    PROBLEM: "Проблемы",
                    SUGGESTION: "Предложения",
                    POSITIVE_FEEDBACK: "Отзывы",
                  }[row.type],
                  value: row.total,
                }))}
              />
            </section>
            <section className="panel">
              <h2>Топ категорий</h2>
              <CategoryBars groups={data.byCategory} />
            </section>
            <section className="panel analytics-full">
              <div className="panel-heading">
                <h2>Динамика обращений</h2>
                <span className="muted small">По датам событий</span>
              </div>
              <TrendChart data={data.dailyTrend} />
            </section>
            <section className="panel analytics-full">
              <div className="panel-heading">
                <h2>По подразделениям</h2>
                <span className="small muted">
                  {data.scope === "COMPANY"
                    ? "Вся компания"
                    : "Доступная область"}
                </span>
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Подразделение</th>
                      <th>Всего</th>
                      <th>Завершено</th>
                      <th>Просрочено</th>
                      <th>Реализовано</th>
                      <th>Отклонено</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byDepartment.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>
                          <strong>{row.total}</strong>
                        </td>
                        <td>{row.completed}</td>
                        <td className={row.overdue ? "overdue-text" : ""}>
                          {row.overdue}
                        </td>
                        <td>{row.implemented}</td>
                        <td>{row.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.byDepartment.length && (
                <p className="muted small">
                  Обращений за выбранный период нет.
                </p>
              )}
            </section>
          </div>
          <div className="analytics-footnote">
            <span>
              <strong>{Math.round(data.reviewedShare * 100)}%</strong> обращений
              рассмотрено
            </span>
            <span>
              Среднее время первого ответа:{" "}
              <strong>
                {data.averageFirstResponseHours === null
                  ? "нет данных"
                  : `${data.averageFirstResponseHours.toFixed(1)} ч`}
              </strong>
            </span>
            <span>Архив включён в статистику</span>
          </div>
        </>
      )}
    </>
  );
}
