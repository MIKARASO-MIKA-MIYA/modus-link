"use client";
import { useState } from "react";
import type { AnalyticsDto, MetricGroup } from "@/types/api";
import { shortDate } from "./ui/format";
export const chartColors = [
  "var(--home-plot)",
  "var(--home-red)",
  "var(--home-active)",
  "var(--home-success)",
  "var(--home-muted)",
];
export function Donut({
  items,
  center,
  caption,
}: {
  items: { label: string; value: number; color?: string }[];
  center?: string | number;
  caption?: string;
}) {
  const total = items.reduce((sum, row) => sum + row.value, 0);
  if (!total) return <p className="analytics-help">Нет данных для распределения.</p>;
  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <svg
          viewBox="0 0 150 150"
          role="img"
          aria-label={items
            .map((row) => `${row.label}: ${row.value}`)
            .join(", ")}
        >
          <circle
            cx="75"
            cy="75"
            r="57"
            fill="none"
            stroke="var(--chart-grid)"
            strokeWidth="16"
          />
          {items.map((row, i) => {
            const amount = total ? (row.value / total) * 100 : 0;
            const start = total
              ? (items.slice(0, i).reduce((sum, item) => sum + item.value, 0) /
                  total) *
                100
              : 0;
            return (
              <circle
                key={row.label}
                cx="75"
                cy="75"
                r="57"
                fill="none"
                pathLength="100"
                stroke={row.color ?? chartColors[i % chartColors.length]}
                strokeWidth="16"
                strokeDasharray={`${amount} ${100 - amount}`}
                strokeDashoffset={-start}
                transform="rotate(-90 75 75)"
              >
                <title>
                  {row.label}: {row.value} ({total ? Math.round(amount) : 0}%)
                </title>
              </circle>
            );
          })}
          <text x="75" y="75" textAnchor="middle" className="donut-number">
            {center ?? total}
          </text>
          <text x="75" y="94" textAnchor="middle" className="donut-caption">
            {caption ?? "обращений"}
          </text>
        </svg>
      </div>
      <div className="chart-legend">
        {items.map((row, i) => (
          <div key={row.label}>
            <span
              className="legend-dot"
              style={{
                background: row.color ?? chartColors[i % chartColors.length],
              }}
            />
            <span>{row.label}</span>
            <strong>
              {total ? Math.round((row.value / total) * 100) : 0}%
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}
export function CategoryBars({
  groups,
  percent = false,
}: {
  groups: MetricGroup[];
  percent?: boolean;
}) {
  const total = groups.reduce((sum, row) => sum + row.total, 0);
  const max = Math.max(1, ...groups.map((row) => row.total));
  return (
    <div className="category-bars">
      {groups.length ? (
        groups.slice(0, 6).map((row) => (
          <div className="bar-row" key={row.id}>
            <span title={row.name}>{row.name}</span>
            <div className="bar-track">
              <div style={{ width: `${(row.total / max) * 100}%` }} />
            </div>
            <strong>
              {percent
                ? total ? `${Math.round((row.total / total) * 100)}%` : "Нет данных"
                : row.total}
            </strong>
          </div>
        ))
      ) : (
        <p className="muted small">За выбранный период обращений нет.</p>
      )}
    </div>
  );
}
export function TrendChart({ data }: { data: AnalyticsDto["dailyTrend"] }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const series = [
    { key: "created" as const, label: "Создано", color: "var(--home-plot)" },
    { key: "responded" as const, label: "Первая реакция", color: "var(--home-error)" },
    { key: "completed" as const, label: "Завершено", color: "var(--home-success)" },
  ];
  const max = Math.ceil(Math.max(
    4,
    ...data.flatMap((d) =>
      series.filter((s) => !hidden.includes(s.key)).map((s) => d[s.key]),
    ),
  ) / 4) * 4;
  const points = (key: "created" | "responded" | "completed") =>
    data.map((d, i) => [
      44 + (i / Math.max(1, data.length - 1)) * 620,
      168 - (d[key] / max) * 140,
    ]);
  return (
    <div className="trend-chart">
      <div className="trend-legend">
        {series.map((s) => (
          <button
            type="button"
            key={s.key}
            className={hidden.includes(s.key) ? "legend-disabled" : ""}
            aria-pressed={!hidden.includes(s.key)}
            onClick={() =>
              setHidden((value) =>
                value.includes(s.key)
                  ? value.filter((key) => key !== s.key)
                  : [...value, s.key],
              )
            }
          >
            <span className="legend-dot" style={{ background: s.color }} />
            {s.label}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 700 208"
        role="img"
        aria-label="Динамика выбранных обращений по интервалам: создание, первая реакция и завершение"
      >
        {[0, 1, 2, 3, 4].map((n) => (
          <g key={n}>
            <line
              x1="44"
              x2="665"
              y1={168 - n * 35}
              y2={168 - n * 35}
              stroke="var(--chart-grid)"
              strokeDasharray="3 4"
            />
            <text x="31" y={172 - n * 35} textAnchor="end">
              {Math.round((max * n) / 4)}
            </text>
          </g>
        ))}
        {series
          .filter((s) => !hidden.includes(s.key))
          .map((s) => {
            const p = points(s.key);
            const path = p
              .map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`)
              .join(" ");
            return (
              <g key={s.key}>
                <path
                  d={path}
                  stroke={s.color}
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  fill="none"
                />
                {p.map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r="2" fill={s.color}>
                    <title>
                      Интервал от {shortDate(data[i].date)} · {s.label}: {data[i][s.key]}
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}
        {data
          .filter(
            (_, i) =>
              i % Math.max(1, Math.floor(data.length / 6)) === 0 ||
              i === data.length - 1,
          )
          .map((d) => {
            const index = data.indexOf(d);
            return (
              <text
                key={d.date}
                x={44 + (index / Math.max(1, data.length - 1)) * 620}
                y="194"
                textAnchor="middle"
              >
                {shortDate(d.date)}
              </text>
            );
          })}
      </svg>
    </div>
  );
}
