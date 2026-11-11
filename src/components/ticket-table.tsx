"use client";
import Link from "next/link";
import type { TicketDto } from "@/types/api";
import { Icon } from "./ui/icon";
import { StatusBadge } from "./ui/shared";
import { dateLabel, initials, isOverdue } from "./ui/format";
export function TicketTable({
  items,
  compact = false,
  selected,
  onSelect,
  sort,
  onSort,
}: {
  items: TicketDto[];
  compact?: boolean;
  selected?: Set<string>;
  onSelect?: (id: string) => void;
  sort?: string;
  onSort?: (field: string) => void;
}) {
  const heading = (label: string, field: string) =>
    onSort ? (
      <button className="table-sort" onClick={() => onSort(field)}>
        {label}
        <Icon
          name="sort"
          size={13}
          className={sort === field ? "sort-active" : ""}
        />
      </button>
    ) : (
      label
    );
  return (
    <div className="table-scroll">
      <table
        className={`data-table ${compact ? "recent-table" : "registry-table"}`}
      >
        <thead>
          <tr>
            {onSelect && (
              <th>
                <span className="sr-only">Выбор</span>
              </th>
            )}
            <th>{heading("Номер", "number")}</th>
            <th>Тема</th>
            {!compact && <th>Автор</th>}
            <th>Категория</th>
            <th>Статус</th>
            {!compact && <th>Ответственный</th>}
            <th>
              {heading(
                compact ? "Дата создания" : "Срок",
                compact ? "createdAt" : "dueAt",
              )}
            </th>
            <th>
              <span className="sr-only">Открыть</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => (
            <tr
              key={t.id}
              className={!compact && isOverdue(t) ? "overdue-row" : ""}
            >
              {onSelect && (
                <td>
                  <input
                    type="checkbox"
                    checked={selected?.has(t.id) ?? false}
                    onChange={() => onSelect(t.id)}
                    aria-label={`Выбрать ${t.number}`}
                  />
                </td>
              )}
              <td>
                <Link className="ticket-number" href={`/tickets/${t.id}`}>
                  #{t.number}
                </Link>
              </td>
              <td>
                <Link className="ticket-subject" href={`/tickets/${t.id}`}>
                  {t.title}
                </Link>
              </td>
              {!compact && (
                <td>
                  <div className="author-cell">
                    <span className="avatar">{initials(t.author.name)}</span>
                    <span>{t.author.name}</span>
                  </div>
                </td>
              )}
              <td>
                <span className="category-chip">
                  <Icon
                    name={
                      /обучен|наставнич/i.test(t.category.name)
                        ? "graduation"
                        : /IT|интеграц/i.test(t.category.name)
                          ? "monitor"
                          : "folder"
                    }
                    size={17}
                  />
                  {t.category.name}
                </span>
              </td>
              <td>
                <StatusBadge status={t.status} overdue={isOverdue(t)} />
              </td>
              {!compact && (
                <td>
                  <span className={t.assignee ? "assignee-name" : "muted"}>
                    {t.assignee?.name ?? "Не назначен"}
                  </span>
                </td>
              )}
              <td>
                <span
                  className={`due-cell ${!compact && isOverdue(t) ? "overdue-text" : ""}`}
                >
                  {!compact && <Icon name="calendar" size={15} />}
                  {dateLabel(compact ? t.createdAt : t.dueAt)}
                </span>
              </td>
              <td>
                <Link
                  className="row-arrow"
                  href={`/tickets/${t.id}`}
                  aria-label={`Открыть обращение ${t.number}`}
                >
                  <Icon name="chevron" size={19} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const encode = (v: string | number) => {
    let text = String(v);
    if (/^[=+@\-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const blob = new Blob(
    ["\ufeff", rows.map((row) => row.map(encode).join(";")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
