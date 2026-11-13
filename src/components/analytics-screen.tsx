"use client";
import { useState } from "react";
import type { AnalyticsDto } from "@/types/api";
import { useResource } from "./use-resource";
import { CategoryBars, Donut, TrendChart } from "./charts";
import { EmptyState, ErrorNotice, Loading, MetricCard, PageHeading } from "./ui/shared";
import { Icon } from "./ui/icon";
import { dateLabel } from "./ui/format";
import { downloadCsv } from "./ticket-table";

const scopes = { COMPANY: "Вся компания", OWN: "Только ваши обращения", DEPARTMENT_AND_ASSIGNED: "Ваши обращения, подразделение и назначенные вам" };
const periods: Record<string, string> = { "7": "Последние 7 дней", "30": "Последние 30 дней", "90": "Последние 90 дней", all: "Всё время" };
export function AnalyticsScreen() {
  const [days, setDays] = useState("30");
  const resource = useResource<AnalyticsDto>(`analytics/overview?days=${days}`);
  const data = resource.data;
  const scope = data ? scopes[data.scope] : "Определяется сервером при загрузке";
  const loadedAt = resource.loadedAt ? new Date(resource.loadedAt).toISOString() : null;
  return <div className="analytics-page">
    <PageHeading title="Аналитика" description="Обращения и результаты в пределах ваших полномочий" action={
      <div className="analytics-actions">
        <label>Период: <select value={days} onChange={event => setDays(event.target.value)}>{Object.entries(periods).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" className="button button-primary" aria-label="Скачать отчёт CSV" disabled={!data || resource.loading || Boolean(resource.error) || data.total === 0} onClick={() => {
          if (!data || resource.loading || resource.error) return;
          downloadCsv("modus-link-analytics.csv", [
            ["Область", scope], ["Период по дате создания", periods[data.periodDays] ?? data.periodDays],
            ["Данные получены браузером", loadedAt ? dateLabel(loadedAt, true) : "Нет данных"],
            ["Подразделение", "Всего", "Завершено", "Просрочено", "Реализовано", "Отклонено"],
            ...data.byDepartment.map(row => [row.name, row.total, row.completed, row.overdue, row.implemented, row.rejected]),
          ]);
        }}><Icon name="download" size={20} />CSV</button>
      </div>
    } />
    <section className="panel analytics-context" aria-label="Область и условия расчёта">
      <p><strong>Область:</strong> {scope}</p>
      <p>Период фильтрует обращения по дате создания. Архив включён в статистику. Общая статистика не расширяет доступ к карточкам обращений.</p>
      <p>Последняя успешная загрузка: {loadedAt ? <time dateTime={loadedAt}>{dateLabel(loadedAt, true)} (UTC+5)</time> : "Нет данных"}. Это время получения ответа браузером, а не обновления записей в БД.</p>
    </section>
    <ErrorNotice message={resource.error} retry={resource.refresh} />
    {resource.loading && <Loading label="Загружаем аналитику…" />}
    {data && !resource.error && <>
      <div className="metrics-grid analytics-metrics">
        <MetricCard label="Всего обращений" value={data.total} icon="ticket" />
        <MetricCard label="Активные" value={data.new + data.underReview + data.needsClarification + data.inProgress} icon="clock" tone="blue" note="Новые, на рассмотрении, уточнении и в работе" />
        <MetricCard label="Просроченные" value={data.overdue} icon="alert" tone="red" note="Незавершённые с истёкшим сроком" />
        <MetricCard label="Завершённые" value={data.completed} icon="check" tone="green" />
      </div>
      {data.total === 0 ? <section className="panel"><EmptyState title="За выбранный период обращений нет" text="Попробуйте другой период. Показатели относятся только к доступной вам области." /></section> : <div className="analytics-grid">
        <section className="panel analytics-trend">
          <h2>Динамика обращений</h2>
          <p className="analytics-help">События только по обращениям, созданным в выбранном периоде. Обращения, созданные раньше, не включены. Это не полная статистика событий за календарный период.</p>
          <p className="analytics-help">Точка обозначает интервал от указанной даты; интервалы могут объединять несколько суток и не совпадать с календарными днями UTC+5.</p>
          {data.dailyTrend.length ? <TrendChart data={data.dailyTrend} /> : <p className="analytics-help">Нет данных для графика.</p>}
          <p className="analytics-help">Первая реакция — первая смена статуса обработчиком или первый публичный комментарий обработчика. Текстовый ответ не обязателен.</p>
        </section>
        <section className="panel analytics-types"><h2>Обращения по типам</h2><Donut items={data.byType.map(row => ({ label: { PROBLEM: "Проблемы", SUGGESTION: "Предложения", POSITIVE_FEEDBACK: "Отзывы" }[row.type], value: row.total }))} /></section>
        <section className="panel analytics-full"><h2>Топ категорий</h2><CategoryBars groups={data.byCategory} /></section>
        <section className="panel analytics-full analytics-departments"><div className="panel-heading"><h2>По подразделениям</h2><span className="analytics-help">{scope}</span></div>
          {data.byDepartment.length ? <div className="table-scroll"><table className="data-table"><thead><tr>{["Подразделение", "Всего", "Завершено", "Просрочено", "Реализовано", "Отклонено"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{data.byDepartment.map(row => <tr key={row.id}><td>{row.name}</td><td><strong>{row.total}</strong></td><td>{row.completed}</td><td className={row.overdue ? "overdue-text" : ""}>{row.overdue}</td><td>{row.implemented}</td><td>{row.rejected}</td></tr>)}</tbody></table></div> : <p className="analytics-help">Нет данных по подразделениям.</p>}
        </section>
      </div>}
      <section className="panel analytics-additional" aria-label="Дополнительные показатели">
        <div><h2>Реализовано улучшений</h2><strong>{data.implementedImprovements}</strong><p className="analytics-help">Предложения с результатом «Реализовано».</p></div>
        <div><h2>Завершено в срок</h2><strong>{data.onTimeShare === null ? "Нет данных" : `${Math.round(data.onTimeShare * 100)}%`}</strong><p className="analytics-help">Доля среди завершённых обращений выборки с датой закрытия. Сравнение с сохранённым сроком; размер этого знаменателя API отдельно не сообщает. Показатель не оценивает эффективность сотрудников.</p></div>
        <div><h2>Среднее время первой реакции</h2><strong>{data.averageFirstResponseHours === null || data.firstResponseSampleSize === 0 ? "Нет данных" : `${data.averageFirstResponseHours.toFixed(1)} ч`}</strong><p className="analytics-help">От создания до первой реакции. Выборка: {data.firstResponseSampleSize} обращений с реакцией; остальные не включены.</p></div>
      </section>
    </>}
  </div>;
}
