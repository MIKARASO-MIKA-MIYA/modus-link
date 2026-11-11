"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CategoryDto,
  PageDto,
  Priority,
  TicketDto,
  TicketType,
} from "@/types/api";
import { writeApi } from "@/lib/client-api";
import { useResource } from "./use-resource";
import { Icon, type IconName } from "./ui/icon";
import { ErrorNotice, PageHeading } from "./ui/shared";
import { FilePicker, uploadFile } from "./file-picker";
const types: { value: TicketType; label: string; icon: IconName }[] = [
  { value: "PROBLEM", label: "Проблема", icon: "alert" },
  { value: "SUGGESTION", label: "Предложение", icon: "lightbulb" },
  { value: "POSITIVE_FEEDBACK", label: "Отзыв", icon: "thumbs" },
];
export function CreateTicket() {
  const router = useRouter();
  const categories = useResource<PageDto<CategoryDto>>(
    "categories?pageSize=100",
  );
  const [type, setType] = useState<TicketType>("PROBLEM");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [files, setFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<TicketDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  return (
    <div className="create-ticket-page">
      <Link className="back-link" href="/tickets">
        <Icon name="back" size={19} />
        Вернуться к обращениям
      </Link>
      <PageHeading
        title="Создать обращение"
        description="Расскажите о проблеме или предложите, что можно улучшить"
      />
      <section className="panel create-panel">
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setBusy(true);
            setError(null);
            let ticket = created;
            try {
              if (!ticket) {
                setProgress("Регистрируем обращение…");
                ticket = await writeApi<TicketDto>("tickets", {
                  type,
                  priority,
                  categoryId: form.get("categoryId"),
                  title: form.get("title"),
                  description: form.get("description"),
                });
                setCreated(ticket);
              }
              for (const file of files) {
                setProgress(`Загружаем ${file.name}…`);
                const uploaded = await uploadFile(ticket, file);
                ticket = uploaded.ticket;
                setCreated(ticket);
                setFiles((remaining) =>
                  remaining.filter((item) => item !== file),
                );
              }
              router.push(`/tickets/${ticket.id}`);
            } catch (err) {
              setError(
                `${ticket ? `Обращение ${ticket.number} уже создано. ` : ""}${err instanceof Error ? err.message : "Не удалось отправить обращение"}`,
              );
            } finally {
              setBusy(false);
              setProgress("");
            }
          }}
        >
          <ErrorNotice message={error || categories.error} />
          {created && (
            <div className="notice notice-success">
              <Icon name="check" size={19} />
              <span>
                Обращение {created.number} сохранено.{" "}
                <Link href={`/tickets/${created.id}`} className="text-button">
                  Открыть карточку
                </Link>
              </span>
            </div>
          )}
          <fieldset className="type-field" disabled={busy || Boolean(created)}>
            <legend>
              Тип обращения <span className="required">*</span>
            </legend>
            <div className="type-options">
              {types.map((row) => (
                <label
                  key={row.value}
                  className={`type-option ${type === row.value ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={row.value}
                    checked={type === row.value}
                    onChange={() => setType(row.value)}
                  />
                  <Icon name={row.icon} size={22} />
                  <span>{row.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            <span>
              Категория <span className="required">*</span>
            </span>
            <select
              name="categoryId"
              required
              defaultValue=""
              disabled={busy || Boolean(created) || categories.loading}
            >
              <option value="" disabled>
                {categories.loading
                  ? "Загрузка категорий…"
                  : "Выберите категорию"}
              </option>
              {categories.data?.items.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>
              Тема <span className="required">*</span>
            </span>
            <input
              name="title"
              minLength={3}
              maxLength={200}
              placeholder="Кратко опишите суть обращения"
              required
              disabled={busy || Boolean(created)}
            />
          </label>
          <label>
            <span>
              Описание <span className="required">*</span>
            </span>
            <textarea
              name="description"
              rows={5}
              minLength={10}
              maxLength={10000}
              placeholder="Опишите проблему или ваше предложение подробнее…"
              required
              disabled={busy || Boolean(created)}
            />
          </label>
          <fieldset
            className="priority-field"
            disabled={busy || Boolean(created)}
          >
            <legend>Приоритет</legend>
            <div className="priority-options">
              {(
                [
                  { value: "LOW", label: "Низкий" },
                  { value: "MEDIUM", label: "Средний" },
                  { value: "HIGH", label: "Высокий" },
                ] as const
              ).map((row) => (
                <label
                  className={`priority-option priority-${row.value.toLowerCase()} ${priority === row.value ? "is-selected" : ""}`}
                  key={row.value}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={row.value}
                    checked={priority === row.value}
                    onChange={() => setPriority(row.value)}
                  />
                  <Icon
                    name={row.value === "MEDIUM" ? "lightbulb" : "layers"}
                    size={19}
                  />
                  {row.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <div className="field-label">Вложения</div>
            <FilePicker files={files} onChange={setFiles} disabled={busy} />
          </div>
          <div className="create-form-footer">
            <p className="form-help">
              Обращение автоматически направится ответственному.
              <br />
              Вы сможете отслеживать статус в своём кабинете.
            </p>
            <div className="form-actions">
              <Link
                href={created ? `/tickets/${created.id}` : "/tickets"}
                className="button"
              >
                {created ? "Открыть обращение" : "Отмена"}
              </Link>
              <button
                className="button button-primary"
                disabled={
                  busy || categories.loading || Boolean(categories.error)
                }
                type="submit"
              >
                <Icon name="send" size={18} />
                {busy
                  ? "Отправляем…"
                  : created
                    ? "Повторить загрузку файлов"
                    : "Отправить обращение"}
              </button>
            </div>
          </div>
          {progress && (
            <p role="status" className="muted small">
              {progress}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
