"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type {
  CategoryDto,
  PageDto,
  Priority,
  TicketDto,
  TicketType,
} from "@/types/api";
import { ApiRequestError, writeApi } from "@/lib/client-api";
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const availableCategories = categories.data?.items.filter(row => row.isActive) ?? [];
  const noCategories = !categories.loading && !categories.error && Boolean(categories.data) && availableCategories.length === 0;
  useEffect(() => {
    const field = Object.keys(fieldErrors)[0];
    if (field) formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
  }, [fieldErrors]);
  const fieldError = (name: string) => fieldErrors[name] ? <small id={`${name}-error`} className="field-error" role="alert">{fieldErrors[name]}</small> : null;
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
          ref={formRef}
          noValidate
          aria-busy={busy}
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            const form = new FormData(e.currentTarget);
            setError(null);
            const errors: Record<string, string> = {};
            const title = String(form.get("title") ?? "").trim();
            const description = String(form.get("description") ?? "").trim();
            if (!created) {
              if (!form.get("categoryId") || !availableCategories.some(row => row.id === form.get("categoryId"))) errors.categoryId = "Выберите действующую категорию.";
              if (title.length < 3 || title.length > 200) errors.title = "Тема должна содержать от 3 до 200 символов без крайних пробелов.";
              if (description.length < 10 || description.length > 10000) errors.description = "Описание должно содержать от 10 до 10 000 символов без крайних пробелов.";
            }
            setFieldErrors(errors);
            if (Object.keys(errors).length || (!created && (categories.loading || categories.error || noCategories))) return;
            submitting.current = true;
            setBusy(true);
            let ticket = created;
            try {
              if (!ticket) {
                setProgress("Регистрируем обращение…");
                ticket = await writeApi<TicketDto>("tickets", {
                  type,
                  priority,
                  categoryId: form.get("categoryId"),
                  title,
                  description,
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
              if (!ticket && err instanceof ApiRequestError) {
                const errors: Record<string, string> = {};
                for (const detail of err.details ?? []) {
                  if (["type", "priority", "categoryId", "title", "description"].includes(detail.path)) errors[detail.path] = detail.message;
                }
                if (err.code === "INACTIVE_CATEGORY") errors.categoryId = err.message;
                setFieldErrors(errors);
              }
              setError(
                `${ticket ? `Обращение ${ticket.number} уже создано. ` : ""}${err instanceof Error ? err.message : "Не удалось отправить обращение"}`,
              );
            } finally {
              submitting.current = false;
              setBusy(false);
              setProgress("");
            }
          }}
        >
          <p className="create-field-help">Поля со знаком * обязательны. Вложения добавляются по желанию.</p>
          <ErrorNotice message={error} />
          {!created && <ErrorNotice message={categories.error} retry={categories.refresh} />}
          {!created && noCategories && <div className="notice" role="status"><span>Доступных категорий пока нет. Обратитесь к администратору или обновите список.</span><button type="button" className="text-button" onClick={categories.refresh}>Обновить категории</button></div>}
          {created && (
            <div className="notice notice-success" role="status">
              <Icon name="check" size={19} />
              <span>
                Обращение {created.number} сохранено.{" "}
                <Link href={`/tickets/${created.id}`} className="text-button">
                  Открыть карточку
                </Link>
              </span>
            </div>
          )}
          <fieldset className="type-field" disabled={busy || Boolean(created)} aria-describedby={fieldErrors.type ? "type-error" : undefined} aria-invalid={Boolean(fieldErrors.type)}>
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
            {fieldError("type")}
          </fieldset>
          <label>
            <span>
              Категория <span className="required">*</span>
            </span>
            <select
              name="categoryId"
              aria-invalid={Boolean(fieldErrors.categoryId)}
              aria-describedby={fieldErrors.categoryId ? "categoryId-error" : undefined}
              required
              defaultValue=""
              disabled={busy || Boolean(created) || categories.loading || Boolean(categories.error) || noCategories}
            >
              <option value="" disabled>
                {categories.loading
                  ? "Загрузка категорий…"
                  : "Выберите категорию"}
              </option>
              {availableCategories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
            {fieldError("categoryId")}
          </label>
          <label>
            <span>
              Тема <span className="required">*</span>
            </span>
            <input
              name="title"
              aria-invalid={Boolean(fieldErrors.title)}
              aria-describedby={`title-help${fieldErrors.title ? " title-error" : ""}`}
              minLength={3}
              maxLength={200}
              placeholder="Кратко опишите суть обращения"
              required
              disabled={busy || Boolean(created)}
            />
            <small id="title-help" className="create-field-help">От 3 до 200 символов.</small>
            {fieldError("title")}
          </label>
          <label>
            <span>
              Описание <span className="required">*</span>
            </span>
            <textarea
              name="description"
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={`description-help${fieldErrors.description ? " description-error" : ""}`}
              rows={5}
              minLength={10}
              maxLength={10000}
              placeholder="Опишите проблему или ваше предложение подробнее…"
              required
              disabled={busy || Boolean(created)}
            />
            <small id="description-help" className="create-field-help">От 10 до 10 000 символов. Укажите подробности, которые помогут разобраться.</small>
            {fieldError("description")}
          </label>
          <fieldset
            className="priority-field"
            aria-invalid={Boolean(fieldErrors.priority)}
            aria-describedby={fieldErrors.priority ? "priority-error" : undefined}
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
            {fieldError("priority")}
          </fieldset>
          <div>
            <div className="field-label">Вложения</div>
            <FilePicker files={files} onChange={setFiles} disabled={busy} />
            <p className="create-field-help">Не больше 10 файлов. Каждый — до 10 МБ: PDF, DOCX, XLSX, JPG, PNG.</p>
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
                  busy || (!created && (categories.loading || Boolean(categories.error) || noCategories))
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
