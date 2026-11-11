"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  AttachmentDto,
  CommentDto,
  HistoryDto,
  PageDto,
  TicketDto,
  TicketStatus,
} from "@/types/api";
import { transitions } from "@/types/workflow";
import { ApiRequestError, writeApi } from "@/lib/client-api";
import { useAuth } from "./app-frame";
import { useResource } from "./use-resource";
import { Icon } from "./ui/icon";
import { EmptyState, ErrorNotice, Loading, StatusBadge } from "./ui/shared";
import {
  canHandle,
  dateLabel,
  historyLabel,
  initials,
  isCompleted,
  isOverdue,
  priorityLabels,
  statusLabels,
  typeLabels,
} from "./ui/format";
import {
  TicketActionDialog,
  type TicketDialogKind,
} from "./ticket-action-dialog";
function eventTitle(event: HistoryDto) {
  const value = event.newValue as Record<string, unknown> | null;
  return event.action === "STATUS_CHANGED" && typeof value?.status === "string"
    ? (statusLabels[value.status as TicketStatus] ?? historyLabel(event.action))
    : historyLabel(event.action);
}
function eventText(event: HistoryDto) {
  const value = event.newValue as Record<string, unknown> | null;
  return typeof value?.content === "string"
    ? value.content
    : typeof value?.resolution === "string"
      ? value.resolution
      : typeof value?.reason === "string"
        ? value.reason
        : event.action === "ATTACHMENT_ADDED" &&
            typeof value?.filename === "string"
          ? value.filename
          : null;
}
export function TicketDetail({ id }: { id: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const { actor } = useAuth();
  const resource = useResource<TicketDto>(`tickets/${id}`);
  const [override, setOverride] = useState<TicketDto | null>(null);
  const ticket =
    override && (!resource.data || override.version >= resource.data.version)
      ? override
      : resource.data;
  const [commentPage, setCommentPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const comments = useResource<PageDto<CommentDto>>(
    `tickets/${id}/comments?pageSize=50&page=${commentPage}`,
  );
  const history = useResource<PageDto<HistoryDto>>(
    `tickets/${id}/history?pageSize=50&page=${historyPage}`,
  );
  const attachments = useResource<{ items: AttachmentDto[] }>(
    `tickets/${id}/attachments`,
  );
  const [tab, setTab] = useState("comments");
  const [dialog, setDialog] = useState<TicketDialogKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [resolution, setResolution] = useState("");
  function updated(next: TicketDto) {
    setOverride(next);
    resource.refresh();
    comments.refresh();
    history.refresh();
    attachments.refresh();
    window.dispatchEvent(new Event("modus:records-updated"));
  }
  if (!ticket)
    return (
      <>
        <Link href="/tickets" className="back-link">
          <Icon name="back" size={18} />
          Вернуться к обращениям
        </Link>
        <ErrorNotice message={resource.error} retry={resource.refresh} />
        {resource.loading && <Loading />}
      </>
    );
  const handle = canHandle(actor, ticket);
  const open = !isCompleted(ticket.status) && !ticket.archivedAt;
  const canAssign =
    handle &&
    open &&
    (actor.role === "ADMIN" || actor.departmentId === ticket.departmentId);
  const canEdit =
    open &&
    (handle || (actor.id === ticket.authorId && ticket.status === "NEW"));
  const events = history.data?.items ?? [];
  const lastEvents = [...events].reverse();
  const statusEvent = (status: string) =>
    events.find(
      (e) =>
        e.action === "STATUS_CHANGED" &&
        (e.newValue as Record<string, unknown> | null)?.status === status,
    )?.createdAt ?? null;
  const stage =
    ticket.status === "NEW"
      ? 0
      : ticket.status === "NEEDS_CLARIFICATION"
        ? 2
        : isCompleted(ticket.status)
          ? 3
          : 1;
  const stages = [
    { label: "Создано", date: ticket.createdAt },
    { label: "На рассмотрении", date: statusEvent("UNDER_REVIEW") },
    { label: "Уточнение", date: statusEvent("NEEDS_CLARIFICATION") },
    { label: "Решение", date: ticket.closedAt },
  ];
  const days = Math.ceil((new Date(ticket.dueAt).getTime() - now) / 86400000);
  const terminalOptions = transitions[ticket.status].filter((s) =>
    isCompleted(s),
  );
  return (
    <>
      <Link href="/tickets" className="back-link">
        <Icon name="back" size={19} />
        Вернуться к обращениям
      </Link>
      <div className="ticket-detail-heading">
        <h1>
          #{ticket.number} ·{" "}
          {ticket.title.replace(new RegExp(` · ${ticket.number}$`), "")}
        </h1>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="ticket-meta">
        <span>
          <Icon name="ticket" size={16} />
          {typeLabels[ticket.type]}
        </span>
        <span>
          <Icon name="folder" size={17} />
          {ticket.category.name}
        </span>
        <span>
          <i
            className={`priority-dot priority-${ticket.priority.toLowerCase()}`}
          />
          Приоритет: {priorityLabels[ticket.priority]}
        </span>
        <span>Создано: {dateLabel(ticket.createdAt, true)}</span>
        {canEdit && (
          <button className="text-button" onClick={() => setDialog("edit")}>
            <Icon name="edit" size={15} />
            Изменить
          </button>
        )}
      </div>
      {ticket.archivedAt && (
        <div className="notice notice-info">
          <Icon name="archive" size={19} />
          Обращение в архиве. Решение и история сохранены.
        </div>
      )}
      <ErrorNotice
        message={
          error ||
          resource.error ||
          comments.error ||
          history.error ||
          attachments.error
        }
        retry={() => {
          resource.refresh();
          comments.refresh();
          history.refresh();
          attachments.refresh();
        }}
      />
      <div className="ticket-detail-grid">
        <div className="ticket-main">
          <section className="panel progress-panel">
            <ol className="progress-stages">
              {stages.map((step, index) => (
                <li
                  key={step.label}
                  className={`${step.date ? "is-complete" : ""} ${stage === index ? "is-current" : ""}`}
                >
                  <span className="progress-dot">
                    {step.date && stage !== index ? (
                      <Icon name="check" size={16} />
                    ) : (
                      <span />
                    )}
                  </span>
                  <strong>{step.label}</strong>
                  <small>{step.date ? dateLabel(step.date, true) : "—"}</small>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel description-panel">
            <h2 className="panel-title">
              <Icon name="file" size={22} />
              Описание {ticket.type === "PROBLEM" ? "проблемы" : "обращения"}
            </h2>
            <p className="ticket-description">{ticket.description}</p>
          </section>
          <section className="panel discussion-panel">
            <div
              className="detail-tabs"
              role="tablist"
              aria-label="Разделы обращения"
            >
              {[
                {
                  key: "comments",
                  label: "Комментарии",
                  count: comments.data?.pagination.total,
                },
                {
                  key: "history",
                  label: "История",
                  count: history.data?.pagination.total,
                },
                {
                  key: "attachments",
                  label: "Вложения",
                  count: attachments.data?.items.length,
                },
              ].map((item) => (
                <button
                  role="tab"
                  aria-selected={tab === item.key}
                  aria-controls={`ticket-panel-${item.key}`}
                  id={`ticket-tab-${item.key}`}
                  key={item.key}
                  className={tab === item.key ? "active" : ""}
                  onClick={() => setTab(item.key)}
                >
                  {item.label}
                  <span>{item.count ?? 0}</span>
                </button>
              ))}
            </div>
            <div
              role="tabpanel"
              id={`ticket-panel-${tab}`}
              aria-labelledby={`ticket-tab-${tab}`}
            >
              {tab === "comments" && (
                <>
                  {comments.loading && !comments.data ? (
                    <Loading />
                  ) : comments.data?.items.length ? (
                    <div className="comments-list">
                      {comments.data.items.map((row) => (
                        <article className="comment-row" key={row.id}>
                          <span
                            className={`avatar ${row.authorId === ticket.authorId ? "avatar-blue" : "avatar-purple"}`}
                          >
                            {initials(row.author.name)}
                          </span>
                          <div>
                            <header>
                              <strong>{row.author.name}</strong>
                              <time>{dateLabel(row.createdAt, true)}</time>
                              {row.visibility === "INTERNAL" && (
                                <span className="internal-label">
                                  Служебная заметка
                                </span>
                              )}
                            </header>
                            <p>{row.content}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="Обсуждение ещё не началось"
                      text="Задайте вопрос или добавьте комментарий к обращению."
                    />
                  )}
                  {comments.data && comments.data.pagination.totalPages > 1 && (
                    <div className="events-pagination">
                      <button
                        className="text-button"
                        disabled={commentPage === 1}
                        onClick={() => setCommentPage((v) => v - 1)}
                      >
                        Ранее
                      </button>
                      <span>
                        {commentPage} / {comments.data.pagination.totalPages}
                      </span>
                      <button
                        className="text-button"
                        disabled={
                          commentPage >= comments.data.pagination.totalPages
                        }
                        onClick={() => setCommentPage((v) => v + 1)}
                      >
                        Далее
                      </button>
                    </div>
                  )}
                </>
              )}
              {tab === "history" && (
                <>
                  <ol className="history-timeline full-history">
                    {events.map((event) => (
                      <li key={event.id}>
                        <span
                          className={`timeline-marker ${event.action === "CLARIFICATION_REQUESTED" ? "marker-orange" : ""}`}
                        >
                          <Icon
                            name={
                              event.action === "CREATED"
                                ? "ticket"
                                : event.action === "ASSIGNED"
                                  ? "user"
                                  : event.action === "CLARIFICATION_REQUESTED"
                                    ? "help"
                                    : "clock"
                            }
                            size={16}
                          />
                        </span>
                        <strong>{eventTitle(event)}</strong>
                        <small>
                          {event.actor.name} ·{" "}
                          {dateLabel(event.createdAt, true)}
                          {event.visibility === "INTERNAL"
                            ? " · Служебная заметка"
                            : ""}
                        </small>
                        {eventText(event) && <p>{eventText(event)}</p>}
                      </li>
                    ))}
                  </ol>
                  {history.data && history.data.pagination.totalPages > 1 && (
                    <div className="events-pagination">
                      <button
                        className="text-button"
                        disabled={historyPage === 1}
                        onClick={() => setHistoryPage((v) => v - 1)}
                      >
                        Ранее
                      </button>
                      <span>
                        {historyPage} / {history.data.pagination.totalPages}
                      </span>
                      <button
                        className="text-button"
                        disabled={
                          historyPage >= history.data.pagination.totalPages
                        }
                        onClick={() => setHistoryPage((v) => v + 1)}
                      >
                        Далее
                      </button>
                    </div>
                  )}
                </>
              )}
              {tab === "attachments" && (
                <>
                  <div className="attachment-list">
                    {attachments.data?.items.map((file) => (
                      <a
                        key={file.id}
                        href={`/api/v1/tickets/${id}/attachments/${file.id}`}
                        className="attachment-row"
                      >
                        <span className="attachment-icon">
                          <Icon name="file" size={23} />
                        </span>
                        <span>
                          <strong>{file.filename}</strong>
                          <small>
                            {(file.size / 1024).toFixed(0)} КБ ·{" "}
                            {dateLabel(file.createdAt)}
                          </small>
                        </span>
                        <Icon name="download" size={19} />
                      </a>
                    ))}
                  </div>
                  {!attachments.data?.items.length && (
                    <EmptyState
                      title="Вложений пока нет"
                      text="Здесь будут документы и изображения к обращению."
                    />
                  )}
                  {open && (handle || actor.id === ticket.authorId) && (
                    <button
                      className="button button-quiet"
                      onClick={() => setDialog("upload")}
                    >
                      <Icon name="paperclip" size={17} />
                      Добавить вложения
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
          {tab === "comments" &&
            !ticket.archivedAt &&
            (handle || actor.id === ticket.authorId) && (
              <section className="panel comment-composer">
                <span className="avatar">{initials(actor.name)}</span>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError(null);
                    try {
                      const data = await writeApi<{ ticket: TicketDto }>(
                        `tickets/${id}/comments`,
                        {
                          version: ticket.version,
                          content: comment,
                          visibility: internal ? "INTERNAL" : "PUBLIC",
                        },
                      );
                      updated(data.ticket);
                      setComment("");
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Не удалось отправить комментарий",
                      );
                      if (
                        err instanceof ApiRequestError &&
                        err.code === "VERSION_CONFLICT"
                      )
                        resource.refresh();
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="sr-only" htmlFor="ticket-comment">
                    Комментарий
                  </label>
                  <textarea
                    id="ticket-comment"
                    placeholder={
                      ticket.status === "NEEDS_CLARIFICATION" &&
                      actor.id === ticket.authorId
                        ? "Ответьте на запрос уточнения…"
                        : "Добавить комментарий…"
                    }
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    required
                    maxLength={5000}
                    rows={3}
                  />
                  <div className="composer-actions">
                    {handle && (
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={internal}
                          onChange={(e) => setInternal(e.target.checked)}
                        />
                        Служебная заметка
                      </label>
                    )}
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setComment("")}
                      disabled={!comment || busy}
                    >
                      Отмена
                    </button>
                    <button
                      className="button button-primary button-small"
                      disabled={busy || !comment.trim()}
                    >
                      <Icon name="send" size={17} />
                      {busy ? "Отправляем…" : "Отправить"}
                    </button>
                  </div>
                </form>
              </section>
            )}
        </div>
        <aside className="ticket-aside">
          {handle && open && (
            <section className="panel ticket-actions">
              <button
                className="button button-primary button-wide"
                onClick={() => setDialog("status")}
              >
                <Icon name="refresh" size={19} />
                Изменить статус
                <Icon name="chevron" className="chevron-down" size={15} />
              </button>
              {canAssign && (
                <button
                  className="button button-quiet button-wide"
                  onClick={() => setDialog("assign")}
                >
                  <Icon name="users" size={19} />
                  Назначить ответственного
                </button>
              )}
            </section>
          )}
          <section className="panel ticket-properties">
            <div className="property-row">
              <Icon name="user" size={23} />
              <div>
                <h3>Ответственный</h3>
                <div className="property-person">
                  {ticket.assignee ? (
                    <>
                      <span className="avatar avatar-blue">
                        {initials(ticket.assignee.name)}
                      </span>
                      <span>
                        {ticket.assignee.name}
                        <small>
                          {ticket.assignee.departmentId === ticket.departmentId
                            ? ticket.department.name
                            : "Ответственный специалист"}
                        </small>
                      </span>
                    </>
                  ) : (
                    <span className="muted">Не назначен</span>
                  )}
                </div>
              </div>
              {canAssign && (
                <button
                  className="icon-button property-edit"
                  aria-label="Изменить ответственного"
                  onClick={() => setDialog("assign")}
                >
                  <Icon name="edit" size={17} />
                </button>
              )}
            </div>
            <div className="property-row">
              <Icon name="calendar" size={23} />
              <div>
                <h3>Срок рассмотрения</h3>
                <div className={isOverdue(ticket) ? "overdue-text" : ""}>
                  {dateLabel(ticket.dueAt)}
                </div>
                {open && (
                  <span
                    className={`deadline-label ${isOverdue(ticket) ? "deadline-late" : ""}`}
                  >
                    {isOverdue(ticket)
                      ? `Просрочено на ${Math.max(1, -days)} дн.`
                      : days === 0
                        ? "Срок сегодня"
                        : `Осталось ${days} дн.`}
                  </span>
                )}
              </div>
              {handle && open && (
                <button
                  className="icon-button property-edit"
                  aria-label="Изменить срок"
                  onClick={() => setDialog("due")}
                >
                  <Icon name="edit" size={17} />
                </button>
              )}
            </div>
          </section>
          <section className="panel resolution-panel">
            <h2 className="panel-title">
              <Icon name="check" size={23} />
              Решение
            </h2>
            {ticket.resolution ? (
              <>
                <p className="resolution-text">{ticket.resolution}</p>
                <p className="form-help">
                  {ticket.outcome ? statusLabels[ticket.outcome] : ""} ·{" "}
                  {dateLabel(ticket.closedAt, true)}
                </p>
              </>
            ) : handle && terminalOptions.length > 0 && !ticket.archivedAt ? (
              <form
                className="form-stack"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  setBusy(true);
                  setError(null);
                  try {
                    updated(
                      await writeApi<TicketDto>(`tickets/${id}/status`, {
                        version: ticket.version,
                        status: form.get("status"),
                        resolution,
                      }),
                    );
                    setResolution("");
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Не удалось сохранить решение",
                    );
                    resource.refresh();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="sr-only" htmlFor="resolution-status">
                  Результат рассмотрения
                </label>
                <select
                  id="resolution-status"
                  name="status"
                  defaultValue={
                    terminalOptions.includes("IMPLEMENTED")
                      ? "IMPLEMENTED"
                      : terminalOptions[0]
                  }
                >
                  {terminalOptions.map((s) => (
                    <option key={s} value={s}>
                      {statusLabels[s]}
                    </option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="resolution-text">
                  Итоговое решение
                </label>
                <textarea
                  id="resolution-text"
                  placeholder="Опишите принятое решение, результаты и дальнейшие действия…"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  required
                  minLength={5}
                  maxLength={10000}
                  rows={4}
                />
                <button
                  className="button button-primary button-wide"
                  disabled={busy}
                >
                  <Icon name="save" size={18} />
                  Сохранить решение
                </button>
              </form>
            ) : (
              <p className="muted small">
                {handle
                  ? "Примите обращение на рассмотрение, чтобы зафиксировать результат."
                  : "Ответственный ещё не зафиксировал итоговое решение."}
              </p>
            )}
          </section>
          <section className="panel history-summary">
            <h2 className="panel-title">
              <Icon name="clock" size={22} />
              История изменений
            </h2>
            <ol className="history-timeline">
              {lastEvents.slice(0, 4).map((event, i) => (
                <li key={event.id} className={i === 0 ? "latest-event" : ""}>
                  <span className="timeline-marker" />
                  <strong>{eventTitle(event)}</strong>
                  <small>
                    {dateLabel(event.createdAt, true)} · {event.actor.name}
                  </small>
                </li>
              ))}
            </ol>
            <button
              className="text-button small"
              onClick={() => setTab("history")}
            >
              Показать всю историю
              <Icon name="arrow" size={15} />
            </button>
          </section>
          {handle && isCompleted(ticket.status) && (
            <button
              className="button button-quiet button-wide"
              onClick={() => setDialog("archive")}
            >
              <Icon name="archive" size={18} />
              {ticket.archivedAt
                ? "Восстановить из архива"
                : "Архивировать обращение"}
            </button>
          )}
        </aside>
      </div>
      {dialog && (
        <TicketActionDialog
          kind={dialog}
          ticket={ticket}
          onClose={() => setDialog(null)}
          onUpdated={updated}
          onConflict={resource.refresh}
        />
      )}
    </>
  );
}
