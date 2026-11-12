import type { AnalyticsDto } from "@/types/api";
import { homeSummary, share } from "@/lib/home-summary";

export function HomeTrend({ data }: { data: AnalyticsDto["dailyTrend"] }) {
  const peak = Math.max(1, ...data.map(row => row.created));
  const rawStep = peak / 4, magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = Math.max(1, ([1, 2, 2.5, 5, 10].find(value => value * magnitude >= rawStep) ?? 10) * magnitude);
  const max = step * 4;
  const points = data.map((row, i) => [48 + i / Math.max(1, data.length - 1) * 492, 116 - row.created / max * 92]);
  const line = points.map(([x, y]) => `${x},${y}`).join(" ");
  return <svg className="home-trend" viewBox="0 0 568 150" role="img" aria-label={`Динамика созданных обращений: ${data.map(row => `${row.date.slice(0, 10)}: ${row.created}`).join(", ")}`}>
    {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="30" x2="558" y1={116 - i * 23} y2={116 - i * 23} className="home-chart-grid" /><text x="13" y={121 - i * 23} textAnchor="middle">{i * step}</text></g>)}
    {points.length > 0 && <><polygon points={`48,116 ${line} ${points.at(-1)![0]},116`} className="home-chart-area" /><polyline points={line} className="home-chart-line" />{points.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="5" className="home-chart-point"><title>{data[i].date.slice(0, 10)}: {data[i].created}</title></circle>)}</>}
    {data.map((row, i) => (i % Math.max(1, Math.ceil(data.length / 7)) === 0 || i === data.length - 1) && <text key={row.date} x={points[i][0]} y="143" textAnchor="middle">{new Intl.DateTimeFormat("ru-RU", data.length > 7 ? { day: "numeric", month: "short" } : { weekday: "short" }).format(new Date(row.date))}</text>)}
  </svg>;
}

export function HomeStatuses({ data }: { data: AnalyticsDto }) {
  const summary = homeSummary(data);
  const groups = [
    { name: "Завершено", count: summary.completed, kind: "done" },
    { name: "Активные", count: summary.active, kind: "active" },
    { name: "Отклонено", count: summary.rejected, kind: "rejected" },
  ];
  let offset = 0;
  return <div className="home-statuses">
    <div className="donut-wrap home-donut"><svg viewBox="0 0 160 160" role="img" aria-label={groups.map(row => `${row.name}: ${row.count}`).join(", ")}>
      <circle cx="80" cy="80" r="58" fill="none" strokeWidth="23" className="home-donut-track" />
      {groups.map(row => { const start = offset; const amount = summary.total ? row.count / summary.total * 100 : 0; offset += amount; return <circle key={row.kind} cx="80" cy="80" r="58" fill="none" strokeWidth="23" pathLength="100" strokeDasharray={`${amount} ${100 - amount}`} strokeDashoffset={-start} transform="rotate(-90 80 80)" className={`home-status-${row.kind}`}><title>{row.name}: {row.count}</title></circle>; })}
      <text x="80" y="80" textAnchor="middle" className="home-donut-total">{summary.total}</text><text x="80" y="100" textAnchor="middle">Всего</text>
    </svg></div>
    <ul className="home-status-legend">{groups.map(row => <li key={row.kind}><i className={`home-status-${row.kind}`} /><span title={row.kind === "active" ? "Все незавершённые обращения" : undefined}>{row.name}</span><strong title={`${row.count} обращений`}>{share(row.count, summary.total)}</strong></li>)}</ul>
  </div>;
}
