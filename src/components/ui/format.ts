import type { Actor, TicketDto, TicketStatus } from "@/types/api";
export const statusLabels: Record<TicketStatus, string> = {
  NEW: "Новое",
  UNDER_REVIEW: "На рассмотрении",
  NEEDS_CLARIFICATION: "Уточнение",
  IN_PROGRESS: "В работе",
  IMPLEMENTED: "Реализовано",
  REJECTED: "Отклонено",
  CLOSED: "Закрыто",
};
export const typeLabels = {
  PROBLEM: "Проблема",
  SUGGESTION: "Предложение",
  POSITIVE_FEEDBACK: "Отзыв",
};
export const priorityLabels = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
};
export const roleLabels = {
  EMPLOYEE: "Сотрудник",
  MANAGER: "Руководитель",
  ADMIN: "Администратор",
};
export const dateLabel = (value: string | null, time = false) =>
  value
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "Asia/Qyzylorda",
      }).format(new Date(value))
    : "—";
export const shortDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Qyzylorda",
  }).format(new Date(value));
export const initials = (name: string) =>
  name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
export const isCompleted = (status: TicketStatus) =>
  ["IMPLEMENTED", "REJECTED", "CLOSED"].includes(status);
export const isOverdue = (ticket: Pick<TicketDto, "status" | "dueAt">) =>
  !isCompleted(ticket.status) && new Date(ticket.dueAt).getTime() < Date.now();
export const canHandle = (actor: Actor, ticket: TicketDto) =>
  actor.id !== ticket.authorId &&
  (actor.role === "ADMIN" ||
    (actor.role === "MANAGER" &&
      (actor.departmentId === ticket.departmentId ||
        actor.id === ticket.assigneeId)));
export function historyLabel(action: string) {
  return (
    (
      {
        CREATED: "Обращение создано",
        ASSIGNED: "Назначен ответственный",
        UPDATED: "Данные обновлены",
        STATUS_CHANGED: "Изменён статус",
        CLARIFICATION_REQUESTED: "Запрошено уточнение",
        CLARIFICATION_PROVIDED: "Получено уточнение",
        COMMENTED: "Добавлен комментарий",
        ARCHIVED: "Обращение архивировано",
        RESTORED: "Восстановлено из архива",
        ATTACHMENT_ADDED: "Добавлено вложение",
      } as Record<string, string>
    )[action] ?? action
  );
}
