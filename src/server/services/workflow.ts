import type { TicketStatus, Priority } from "@/types/domain";
import { ensure } from "@/server/errors";
import { transitions } from "@/types/workflow";
export { transitions } from "@/types/workflow";
export function validateTransition(
  from: TicketStatus,
  to: TicketStatus,
  resolution?: string,
  message?: string,
) {
  ensure(
    transitions[from].includes(to),
    409,
    "INVALID_TRANSITION",
    `Недопустимый переход ${from} → ${to}`,
  );
  if (["IMPLEMENTED", "REJECTED", "CLOSED"].includes(to))
    ensure(
      resolution?.trim() && resolution.trim().length >= 5,
      422,
      "RESOLUTION_REQUIRED",
      "Укажите итоговое решение или причину отклонения",
    );
  if (to === "NEEDS_CLARIFICATION")
    ensure(
      message?.trim() && message.trim().length >= 5,
      422,
      "CLARIFICATION_REQUIRED",
      "Укажите вопрос для уточнения",
    );
}
export function defaultDueAt(priority: Priority, now = new Date()) {
  return new Date(
    now.getTime() + { HIGH: 2, MEDIUM: 5, LOW: 10 }[priority] * 86400000,
  );
}
