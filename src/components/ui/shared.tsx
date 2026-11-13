"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { TicketStatus } from "@/types/api";
import { Icon, type IconName } from "./icon";
import { statusLabels } from "./format";
export function StatusBadge({
  status,
  overdue = false,
}: {
  status: TicketStatus;
  overdue?: boolean;
}) {
  return (
    <span
      className={`status-badge status-${status.toLowerCase()} ${overdue ? "status-overdue" : ""}`}
    >
      <span className="status-dot" />
      {statusLabels[status]}
      {overdue && <span className="sr-only">, просрочено</span>}
    </span>
  );
}
export function PageHeading({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="page-heading">
      <div className="page-heading-text">
        {icon && (
          <span className="heading-icon">
            <Icon name={icon} size={34} />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
export function ErrorNotice({
  message,
  retry,
}: {
  message: string | null;
  retry?: () => void;
}) {
  return message ? (
    <div className="notice notice-error" role="alert">
      <Icon name="alert" size={19} />
      <span>{message}</span>
      {retry && (
        <button type="button" className="text-button" onClick={retry}>
          Повторить
        </button>
      )}
    </div>
  ) : null;
}
export function Loading({ label = "Загружаем данные…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  );
}
export function EmptyState({
  title = "Обращений пока нет",
  text = "Новые обращения появятся здесь.",
  action,
}: {
  title?: string;
  text?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="ticket" size={32} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function MetricCard({
  label,
  value,
  icon,
  tone = "accent",
  href,
  note,
}: {
  label: string;
  value: number | string;
  icon: IconName;
  tone?: string;
  href?: string;
  note?: string;
}) {
  const content = (
    <>
      <span className={`metric-icon tone-${tone}`}>
        <Icon name={icon} size={27} />
      </span>
      <span className="metric-body">
        <span className="metric-label">{label}</span>
        <strong>{value}</strong>
        {note && <small>{note}</small>}
      </span>
      {href && <Icon name="chevron" size={17} className="metric-arrow" />}
    </>
  );
  return href ? (
    <Link href={href} className={`metric-card metric-${tone}`}>
      {content}
    </Link>
  ) : (
    <div className={`metric-card metric-${tone}`}>{content}</div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label={title}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="modal-heading">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Закрыть окно"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function PaginationControls({
  page,
  pageSize,
  total,
  totalPages,
  onPage,
  onSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
}) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return (
    <div className="pagination">
      <label>
        Показать по:{" "}
        <select
          value={pageSize}
          onChange={(e) => onSize(Number(e.target.value))}
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <span>
        {total
          ? `Показано ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} из ${total} обращений`
          : "Обращений не найдено"}
      </span>
      <div className="page-buttons">
        <button
          type="button"
          className="icon-button"
          disabled={page <= 1}
          aria-label="Предыдущая страница"
          onClick={() => onPage(page - 1)}
        >
          <Icon name="back" size={17} />
        </button>
        {Array.from(
          { length: Math.min(5, totalPages) },
          (_, i) => start + i,
        ).map((n) => (
          <button
            type="button"
            className={`page-number ${page === n ? "active" : ""}`}
            onClick={() => onPage(n)}
            key={n}
            aria-current={page === n ? "page" : undefined}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="icon-button"
          disabled={page >= totalPages}
          aria-label="Следующая страница"
          onClick={() => onPage(page + 1)}
        >
          <Icon name="chevron" size={17} />
        </button>
      </div>
    </div>
  );
}
