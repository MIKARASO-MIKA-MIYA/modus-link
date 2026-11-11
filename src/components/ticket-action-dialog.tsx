"use client";
import { useState } from "react";
import type {
  TicketDto,
  TicketStatus,
  UserSummary,
  PageDto,
} from "@/types/api";
import { transitions } from "@/types/workflow";
import { ApiRequestError, writeApi } from "@/lib/client-api";
import { useAuth } from "./app-frame";
import { useResource } from "./use-resource";
import { ErrorNotice, Modal } from "./ui/shared";
import { priorityLabels, statusLabels, canHandle } from "./ui/format";
import { FilePicker, uploadFile } from "./file-picker";
export type TicketDialogKind =
  | "status"
  | "assign"
  | "due"
  | "edit"
  | "archive"
  | "upload";
export function TicketActionDialog({
  kind,
  ticket,
  onClose,
  onUpdated,
  onConflict,
}: {
  kind: TicketDialogKind;
  ticket: TicketDto;
  onClose: () => void;
  onUpdated: (ticket: TicketDto) => void;
  onConflict: () => void;
}) {
  const { actor } = useAuth();
  const allowed = transitions[ticket.status];
  const [status, setStatus] = useState<TicketStatus>(
    allowed[0] ?? ticket.status,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [current, setCurrent] = useState(ticket);
  const users = useResource<PageDto<UserSummary>>(
    kind === "assign" ? "users?pageSize=100" : null,
  );
  const titles = {
    status: "Изменить статус",
    assign: "Назначить ответственного",
    due: "Срок рассмотрения",
    edit: "Редактировать обращение",
    archive: ticket.archivedAt
      ? "Восстановить из архива"
      : "Архивировать обращение",
    upload: "Добавить вложения",
  };
  return (
    <Modal
      title={titles[kind]}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          const form = new FormData(e.currentTarget);
          try {
            let updated: TicketDto;
            if (kind === "upload") {
              updated = current;
              for (const file of files) {
                updated = (await uploadFile(updated, file)).ticket;
                setCurrent(updated);
                onUpdated(updated);
                setFiles((remaining) =>
                  remaining.filter((item) => item !== file),
                );
              }
            } else if (kind === "status")
              updated = await writeApi<TicketDto>(
                `tickets/${ticket.id}/status`,
                {
                  version: ticket.version,
                  status,
                  ...(form.get("resolution")
                    ? { resolution: form.get("resolution") }
                    : {}),
                  ...(form.get("message")
                    ? { message: form.get("message") }
                    : {}),
                },
              );
            else if (kind === "assign")
              updated = await writeApi<TicketDto>(
                `tickets/${ticket.id}/assign`,
                {
                  version: ticket.version,
                  assigneeId: form.get("assigneeId") || null,
                  reason: form.get("reason"),
                },
              );
            else if (kind === "archive")
              updated = await writeApi<TicketDto>(
                `tickets/${ticket.id}/archive`,
                {
                  version: ticket.version,
                  archived: !ticket.archivedAt,
                  reason: form.get("reason"),
                },
              );
            else if (kind === "due")
              updated = await writeApi<TicketDto>(
                `tickets/${ticket.id}`,
                {
                  version: ticket.version,
                  dueAt: new Date(`${form.get("due")}+05:00`).toISOString(),
                },
                "PATCH",
              );
            else
              updated = await writeApi<TicketDto>(
                `tickets/${ticket.id}`,
                {
                  version: ticket.version,
                  title: form.get("title"),
                  description: form.get("description"),
                  ...(canHandle(actor, ticket)
                    ? { priority: form.get("priority") }
                    : {}),
                },
                "PATCH",
              );
            onUpdated(updated);
            onClose();
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Не удалось сохранить",
            );
            if (
              err instanceof ApiRequestError &&
              err.code === "VERSION_CONFLICT"
            )
              onConflict();
          } finally {
            setBusy(false);
          }
        }}
      >
        <ErrorNotice message={error || users.error} />
        {kind === "status" && (
          <>
            <label>
              Новый статус
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
              >
                {allowed.map((value) => (
                  <option key={value} value={value}>
                    {statusLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            {status === "NEEDS_CLARIFICATION" && (
              <label>
                Что необходимо уточнить?
                <textarea
                  name="message"
                  required
                  minLength={5}
                  maxLength={5000}
                  placeholder="Задайте автору конкретный вопрос"
                />
              </label>
            )}
            {["IMPLEMENTED", "REJECTED", "CLOSED"].includes(status) && (
              <label>
                {status === "REJECTED"
                  ? "Причина отклонения"
                  : "Итоговое решение"}
                <textarea
                  name="resolution"
                  required
                  minLength={5}
                  maxLength={10000}
                  defaultValue={
                    status === "REJECTED" ? "" : (ticket.resolution ?? "")
                  }
                  placeholder="Опишите результат и дальнейшие действия"
                />
              </label>
            )}
            {![
              "NEEDS_CLARIFICATION",
              "IMPLEMENTED",
              "REJECTED",
              "CLOSED",
            ].includes(status) && (
              <label>
                Комментарий <span className="muted small">необязательно</span>
                <textarea
                  name="message"
                  minLength={5}
                  maxLength={5000}
                  placeholder="Расскажите автору о следующих шагах"
                />
              </label>
            )}
          </>
        )}
        {kind === "assign" && (
          <>
            <label>
              Ответственный
              <select name="assigneeId" defaultValue={ticket.assigneeId ?? ""}>
                <option value="">Не назначен — вернуть в очередь</option>
                {users.data?.items
                  .filter(
                    (u) => u.role !== "EMPLOYEE" && u.id !== ticket.authorId,
                  )
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Причина назначения
              <textarea
                name="reason"
                minLength={5}
                maxLength={1000}
                required
                placeholder="Почему обращение направляется этому сотруднику"
              />
            </label>
          </>
        )}
        {kind === "due" && (
          <label>
            Новый срок (время Казахстана, UTC+5)
            <input
              name="due"
              type="datetime-local"
              required
              defaultValue={new Date(
                new Date(ticket.dueAt).getTime() + 5 * 3600000,
              )
                .toISOString()
                .slice(0, 16)}
            />
            <span className="form-help">
              Изменение срока сохранится в истории обращения.
            </span>
          </label>
        )}
        {kind === "edit" && (
          <>
            <label>
              Тема
              <input
                name="title"
                defaultValue={ticket.title}
                required
                minLength={3}
                maxLength={200}
              />
            </label>
            <label>
              Описание
              <textarea
                name="description"
                rows={5}
                defaultValue={ticket.description}
                minLength={10}
                maxLength={10000}
                required
              />
            </label>
            {canHandle(actor, ticket) && (
              <label>
                Приоритет
                <select name="priority" defaultValue={ticket.priority}>
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}
        {kind === "archive" && (
          <>
            <p className="form-help">
              Результат, комментарии и история останутся доступны автору
              обращения.
            </p>
            <label>
              Причина
              <textarea name="reason" minLength={5} maxLength={1000} required />
            </label>
          </>
        )}
        {kind === "upload" && (
          <FilePicker files={files} onChange={setFiles} disabled={busy} />
        )}
        <div className="form-actions">
          <button
            type="button"
            className="button"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={
              busy ||
              (kind === "assign" && users.loading) ||
              (kind === "upload" && !files.length)
            }
          >
            {busy
              ? "Сохраняем…"
              : kind === "upload"
                ? "Загрузить файлы"
                : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
