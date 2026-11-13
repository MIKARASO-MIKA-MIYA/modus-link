"use client";
import { useRef, useState } from "react";
import type { AdminUserDto, CategoryDto, DepartmentDto, PageDto, RoutingDto, UserSummary } from "@/types/api";
import { ApiRequestError, writeApi } from "@/lib/client-api";
import { useAuth } from "./app-frame";
import { ErrorNotice, Modal } from "./ui/shared";

interface Lookup<T> { data: PageDto<T> | null; loading: boolean; error: string | null; refresh: () => void }
export function RoutingEditor({ rule, categories, departments, users, onClose, onSaved }: {
  rule: RoutingDto | null; categories: Lookup<CategoryDto>; departments: Lookup<DepartmentDto>;
  users: Lookup<UserSummary & Partial<AdminUserDto>>; onClose: () => void; onSaved: () => void;
}) {
  const { actor } = useAuth();
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? "");
  const [departmentId, setDepartmentId] = useState(rule?.departmentId ?? "");
  const [assigneeId, setAssigneeId] = useState(rule?.assigneeId ?? "");
  const [active, setActive] = useState(rule?.isActive ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const saving = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const category = categories.data?.items.find(row => row.id === categoryId);
  const department = departments.data?.items.find(row => row.id === departmentId);
  const assignee = users.data?.items.find(row => row.id === assigneeId);
  const assigneeDepartment = departments.data?.items.find(row => row.id === assignee?.departmentId);
  const lookups = [{ name: "Категории", resource: categories }, { name: "Подразделения", resource: departments }, { name: "Сотрудники", resource: users }];
  const unavailable = lookups.some(({ resource }) => resource.loading || resource.error || !resource.data);
  const issues: Record<string, string> = {};
  if (!categoryId) issues.categoryId = "Выберите категорию.";
  else if (!category) issues.categoryId = "Выбранная категория отсутствует в загруженных вариантах. Выбранный ID сохранён; обновите справочник или явно выберите другую категорию.";
  else if (active && !category.isActive) issues.categoryId = "Для активного правила нужна активная категория.";
  if (departmentId && !department) issues.departmentId = "Выбранное подразделение отсутствует в загруженных вариантах. Область не изменена на глобальную; обновите справочник или явно измените выбор.";
  else if (active && department && !department.isActive) issues.departmentId = "Для активного правила нужно активное подразделение.";
  if (!assigneeId) issues.assigneeId = "Выберите исполнителя.";
  else if (!assignee) issues.assigneeId = "Выбранный исполнитель отсутствует в загруженных вариантах. Выбранный ID сохранён; обновите справочник или явно выберите другого исполнителя.";
  else if (assignee.role === "EMPLOYEE") issues.assigneeId = "Сервер требует исполнителя MANAGER или ADMIN даже для отключённого правила. Выберите подходящего исполнителя.";
  else if (active && assignee.isActive !== true) issues.assigneeId = "Для активного правила нужен подтверждённо активный исполнитель.";
  else if (active && !assigneeDepartment) issues.assigneeId = "Подразделение исполнителя отсутствует в загруженном справочнике; его активность нельзя проверить.";
  else if (active && !assigneeDepartment?.isActive) issues.assigneeId = "Подразделение исполнителя должно быть активно.";
  const changes = rule ? {
    ...(categoryId !== rule.categoryId ? { categoryId } : {}),
    ...((departmentId || null) !== rule.departmentId ? { departmentId: departmentId || null } : {}),
    ...(assigneeId !== rule.assigneeId ? { assigneeId } : {}),
    ...(active !== rule.isActive ? { isActive: active } : {}),
  } : { categoryId, departmentId: departmentId || null, assigneeId, isActive: active };
  const unchanged = Boolean(rule) && Object.keys(changes).length === 0;
  const blocked = actor.role !== "ADMIN" || unavailable || Object.keys(issues).length > 0 || unchanged;
  const message = (name: string) => fields[name] || issues[name];
  const attributes = (name: string) => ({ "aria-invalid": Boolean(message(name)), "aria-describedby": message(name) ? `routing-${name}-error` : undefined });
  const fieldError = (name: string) => message(name) ? <small className="field-error" id={`routing-${name}-error`}>{message(name)}</small> : null;
  function refreshAll() { categories.refresh(); departments.refresh(); users.refresh(); }
  return <Modal title={rule ? "Изменить правило" : "Добавить правило"} onClose={() => { if (!saving.current) onClose(); }}>
    <form ref={form} className="form-stack" noValidate aria-busy={busy} onSubmit={async event => {
      event.preventDefault();
      if (saving.current || blocked) return;
      saving.current = true; setBusy(true); setError(null); setFields({});
      try {
        await writeApi(`routing${rule ? `/${rule.id}` : ""}`, changes, rule ? "PATCH" : "POST");
        onSaved(); onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось сохранить правило");
        const errors: Record<string, string> = {};
        if (err instanceof ApiRequestError) {
          for (const detail of err.details ?? []) if (["categoryId", "departmentId", "assigneeId", "isActive"].includes(detail.path)) errors[detail.path] = detail.message;
          if (err.code === "CONFLICT") errors.departmentId = "Для этой категории и области уже существует активное правило. Измените выбор или проверьте существующие правила.";
          if (err.code === "INVALID_ROUTING") refreshAll();
        }
        setFields(errors);
        const first = Object.keys(errors)[0];
        if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      } finally { saving.current = false; setBusy(false); }
    }}>
      <ErrorNotice message={error} />
      {lookups.map(({ name, resource }) => <div key={name} className="routing-lookup">
        {resource.loading && <p className="routing-help" role="status">{name}: загрузка…</p>}
        <ErrorNotice message={resource.error ? `${name}: ${resource.error}` : null} retry={resource.refresh} />
        {resource.data && resource.data.pagination.total > resource.data.items.length && <p className="routing-help">{name}: загружено {resource.data.items.length} из {resource.data.pagination.total}. Список неполный, не больше первых 100 записей.</p>}
        {resource.data && !resource.loading && !resource.error && !resource.data.items.length && <p className="routing-help">{name}: список пуст.</p>}
      </div>)}
      <label>Категория<select name="categoryId" required value={categoryId} {...attributes("categoryId")} disabled={busy} onChange={event => { setCategoryId(event.target.value); setFields({}); }}>
        <option value="" disabled>Выберите категорию</option>
        {categoryId && !category && <option value={categoryId}>{categoryId === rule?.categoryId ? rule.category.name : "Выбранная категория"} — нет в загруженном списке</option>}
        {categories.data?.items.map(row => <option key={row.id} value={row.id}>{row.name}{!row.isActive ? " — неактивна" : ""}</option>)}
      </select>{fieldError("categoryId")}</label>
      <label>Подразделение<select name="departmentId" value={departmentId} {...attributes("departmentId")} disabled={busy} onChange={event => { setDepartmentId(event.target.value); setFields({}); }}>
        <option value="">Все подразделения — глобальное правило</option>
        {departmentId && !department && <option value={departmentId}>{departmentId === rule?.departmentId ? rule.department?.name : "Выбранное подразделение"} — нет в загруженном списке; область сохранена</option>}
        {departments.data?.items.map(row => <option key={row.id} value={row.id}>{row.name}{!row.isActive ? " — неактивно" : ""}</option>)}
      </select>{fieldError("departmentId")}</label>
      <label>Ответственный<select name="assigneeId" required value={assigneeId} {...attributes("assigneeId")} disabled={busy} onChange={event => { setAssigneeId(event.target.value); setFields({}); }}>
        <option value="" disabled>Выберите исполнителя</option>
        {assigneeId && (!assignee || assignee.role === "EMPLOYEE") && <option value={assigneeId}>{assignee?.name ?? (assigneeId === rule?.assigneeId ? rule.assignee.name : "Выбранный исполнитель")} — {assignee ? "роль EMPLOYEE" : "нет в загруженном списке"}</option>}
        {users.data?.items.filter(row => row.role !== "EMPLOYEE").map(row => <option key={row.id} value={row.id}>{row.name}{row.isActive === false ? " — отключён" : ""}</option>)}
      </select>{fieldError("assigneeId")}</label>
      <label className="checkbox"><input name="isActive" type="checkbox" checked={active} disabled={busy} {...attributes("isActive")} onChange={event => { setActive(event.target.checked); setFields({}); }} />Правило активно{fieldError("isActive")}</label>
      <p className="routing-help">Правило подразделения приоритетнее глобального. При отсутствии подходящего правила обращение остаётся без исполнителя. Автор не назначается самому себе; изменение правила не переназначает существующие обращения.</p>
      <p className="routing-help">Флаг активности не гарантирует назначение: связанные записи должны оставаться допустимыми. При неполных справочниках неподтверждённые значения нельзя сохранить автоматически.</p>
      {unavailable && <p className="routing-help" role="status">Сохранение заблокировано до успешной загрузки всех справочников.</p>}
      {unchanged && <p className="routing-help">Нет изменений для сохранения.</p>}
      <button type="button" className="text-button" disabled={busy || lookups.some(({ resource }) => resource.loading)} onClick={refreshAll}>Обновить справочники</button>
      <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>Отмена</button><button type="submit" className="button button-primary" disabled={busy || blocked}>{busy ? "Сохраняем…" : "Сохранить"}</button></div>
    </form>
  </Modal>;
}
