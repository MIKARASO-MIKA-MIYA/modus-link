"use client";
import Link from "next/link";
import { Fragment, useRef, useState } from "react";
import type {
  AdminUserDto,
  CategoryDto,
  DepartmentDto,
  PageDto,
  RoutingDto,
  UserSummary,
} from "@/types/api";
import { ApiRequestError, writeApi } from "@/lib/client-api";
import { useAuth } from "./app-frame";
import { useResource } from "./use-resource";
import { Icon } from "./ui/icon";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  Modal,
  PageHeading,
} from "./ui/shared";
import { initials, roleLabels } from "./ui/format";
import { RoutingEditor } from "./routing-editor";
type DirectoryKind = "users" | "departments" | "categories" | "routing";
type TeamUser = UserSummary & Partial<AdminUserDto>;
type RecordItem = TeamUser | DepartmentDto | CategoryDto | RoutingDto;
export function AdminDirectory({ kind }: { kind: DirectoryKind }) {
  const { actor } = useAuth();
  const admin = actor.role === "ADMIN";
  const simpleDirectory = kind === "categories" || kind === "departments";
  const endpoint = kind;
  const [page, setPage] = useState(1);
  const resource = useResource<PageDto<RecordItem>>(
    !admin && kind !== "users" ? null : `${endpoint}?pageSize=20&page=${page}`,
  );
  const departments = useResource<PageDto<DepartmentDto>>(
    simpleDirectory || (kind === "routing" && !admin) ? null : "departments?pageSize=100",
  );
  const categories = useResource<PageDto<CategoryDto>>(
    admin && kind === "routing" ? "categories?pageSize=100" : null,
  );
  const users = useResource<PageDto<TeamUser>>(
    admin && kind === "routing" ? "users?pageSize=100" : null,
  );
  const [editor, setEditor] = useState<RecordItem | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const names = {
    users: admin ? "Сотрудники" : actor.role === "EMPLOYEE" ? "Моя учётная запись" : "Команда",
    departments: "Подразделения",
    categories: "Категории",
    routing: "Маршрутизация",
  };
  const descriptions = {
    users: "Сотрудники, руководители и их права доступа",
    departments: "Управление структурой компании",
    categories: "Темы обращений, описания и доступность для новых обращений",
    routing:
      "Автоматическое назначение ответственных по категориям и подразделениям",
  };
  const edit = editor === "new" ? null : editor;
  const departmentName = (id: string) =>
    departments.data?.items.find((d) => d.id === id)?.name ??
    (kind === "users" ? departments.loading ? "Загрузка подразделения…" : "Название подразделения недоступно" : "Другое подразделение");
  const activeDepartments = departments.data?.items.filter(d => d.isActive) ?? [];
  const editUser = kind === "users" ? edit as TeamUser | null : null;
  const missingDepartment = editUser && !activeDepartments.some(d => d.id === editUser.departmentId);
  const departmentLimit = kind === "users" && departments.data && departments.data.pagination.total > departments.data.items.length;
  const fieldPrefix = kind === "categories" ? "category" : kind === "departments" ? "department" : "user";
  const fieldProps = (name: string) => kind === "users" || simpleDirectory ? { "aria-invalid": Boolean(fieldErrors[name]), "aria-describedby": fieldErrors[name] ? `${fieldPrefix}-${name}-error` : undefined } : {};
  const fieldError = (name: string) => (kind === "users" || simpleDirectory) && fieldErrors[name] ? <small className="field-error" role="alert" id={`${fieldPrefix}-${name}-error`}>{fieldErrors[name]}</small> : null;
  function retryTeam() { resource.refresh(); departments.refresh(); }
  function open(item: RecordItem | "new") {
    if (simpleDirectory && !admin) return;
    if (kind === "users" && (!admin || (item !== "new" && item.id === actor.id))) return;
    setEditor(item);
    setError(null);
    setFieldErrors({});
  }
  if (!admin && kind !== "users")
    return (
      <EmptyState
        title="Нет доступа"
        text="Этот раздел доступен администратору."
      />
    );
  const Container = kind === "users" || simpleDirectory || kind === "routing" ? "div" : Fragment;
  return (
    <Container {...(kind === "users" ? { className: "team-page" } : kind === "categories" ? { className: "categories-page" } : kind === "departments" ? { className: "departments-page" } : kind === "routing" ? { className: "routing-page" } : {})}>
      {admin && kind !== "users" && (
        <Link href="/settings" className="back-link">
          <Icon name="back" size={18} />
          Настройки системы
        </Link>
      )}
      <PageHeading
        title={names[kind]}
        description={descriptions[kind]}
        action={
          admin && (
            <button
              className="button button-primary"
              onClick={() => open("new")}
            >
              <Icon name="plus" size={18} />
              {
                {
                  users: "Добавить пользователя",
                  departments: "Добавить подразделение",
                  categories: "Добавить категорию",
                  routing: "Добавить правило",
                }[kind]
              }
            </button>
          )
        }
      />
      <ErrorNotice
        message={
          kind === "routing" ? resource.error : resource.error || departments.error || categories.error || users.error
        }
        retry={kind === "users" ? retryTeam : resource.refresh}
      />
      {kind === "routing" && <p className="routing-help">Правило подразделения имеет приоритет перед глобальным. Тип и приоритет обращения не участвуют в выборе правила. Без подходящего правила обращение остаётся без исполнителя. «Активно» — состояние правила; назначение также зависит от связанных записей. Изменения действуют при создании новых обращений.</p>}
      {kind === "users" && <p className="team-help">{admin ? "Управление учётными записями. Свою запись может изменить другой администратор." : actor.role === "MANAGER" ? "Показаны активные сотрудники вашего подразделения. Изменения выполняет администратор." : "Доступна только ваша запись. Для изменения прав обратитесь к администратору."}</p>}
      {departmentLimit && <p className="team-help" role="status">Список подразделений ограничен: загружено {departments.data!.items.length} из {departments.data!.pagination.total}. Часть названий и вариантов выбора может быть недоступна.</p>}
      {kind === "categories" && (
        <section className="panel sla-panel">
          <span className="heading-icon">
            <Icon name="clock" size={26} />
          </span>
          <div>
            <h3>Сроки рассмотрения — справочная информация</h3>
            <p>Высокий — 2 дня · Средний — 5 дней · Низкий — 10 дней</p>
            <small>
              Эти сроки заданы системой и не редактируются на этой странице. Календарные дни. Ответственный может изменить срок в карточке с
              записью в историю.
            </small>
          </div>
        </section>
      )}
      {kind === "departments" && <p className="department-help">Подразделение с активными сотрудниками нельзя деактивировать. Сначала переведите или отключите сотрудников. Связанные обращения сохраняются.</p>}
      <section className="panel directory-panel" {...(simpleDirectory || kind === "routing" ? { "aria-busy": resource.loading } : {})}>
        {resource.loading && (!resource.data || simpleDirectory || kind === "routing") ? (
          <Loading />
        ) : resource.data?.items.length ? (
          <div className="table-scroll">
            <table className="data-table directory-table">
              <thead>
                <tr>
                  {kind === "users" ? (
                    <>
                      <th>Сотрудник</th>
                      {admin && <><th>Ник</th><th>Почта</th></>}
                      <th>Роль</th>
                      <th>Подразделение</th>
                      {admin && <><th>Активность</th><th>Общая аналитика</th></>}
                    </>
                  ) : kind === "routing" ? (
                    <>
                      <th>Категория</th>
                      <th>Подразделение</th>
                      <th>Ответственный</th>
                      <th>Статус</th>
                    </>
                  ) : (
                    <>
                      <th>Название</th>
                      {kind === "categories" && <th>Описание</th>}
                      <th>Статус</th>
                    </>
                  )}
                  {admin && (
                    <th>
                      <span className="sr-only">Изменить</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {resource.data.items.map((item) => {
                  const user = item as TeamUser,
                    rule = item as RoutingDto;
                  return (
                    <tr key={item.id}>
                      {kind === "users" ? (
                        <>
                          <td>
                            <div className="author-cell">
                              <span className="avatar avatar-accent">
                                {initials(user.name)}
                              </span>
                              <span>{user.name}</span>
                            </div>
                          </td>
                          {admin && <><td>{user.username}</td><td>{user.email ?? "—"}</td></>}
                          <td>
                            <span className="category-chip">
                              {roleLabels[user.role]}
                            </span>
                          </td>
                          <td>{departmentName(user.departmentId)}</td>
                          {admin && (
                            <><td><span className={`team-activity${user.isActive === false ? " is-inactive" : ""}`}>{user.isActive === false ? "Отключена" : "Активна"}</span></td>
                            <td><span className="team-permission">{user.role === "ADMIN" ? "По роли ADMIN" : user.canViewCompanyAnalytics ? "Дополнительно разрешена" : "Не предоставлена"}</span></td></>
                          )}
                        </>
                      ) : kind === "routing" ? (
                        <>
                          <td>{rule.category.name}</td>
                          <td>
                            {rule.department?.name ?? "Все подразделения"}
                          </td>
                          <td>{rule.assignee.name}</td>
                          <td>
                            <span
                              className={`directory-status ${rule.isActive ? "enabled" : ""}`}
                            >
                              {rule.isActive ? "Активно" : "Отключено"}
                            </span>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>
                            <strong>{(item as DepartmentDto).name}</strong>
                          </td>
                          {kind === "categories" && (
                            <td className="muted">
                              {(item as CategoryDto).description || "—"}
                            </td>
                          )}
                          <td>
                            <span
                              className={`directory-status ${(item as CategoryDto).isActive ? "enabled" : ""}`}
                            >
                              {(item as CategoryDto).isActive
                                ? "Активно"
                                : "Отключено"}
                            </span>
                          </td>
                        </>
                      )}
                      {admin && (
                        <td>
                          {kind === "users" && item.id === actor.id ? <span className="team-help">Ваша запись</span> : <button
                            className="icon-button"
                            disabled={kind === "users" && item.id === actor.id}
                            title={
                              kind === "users" && item.id === actor.id
                                ? "Собственную учётную запись изменяет другой администратор"
                                : "Изменить"
                            }
                            aria-label={`Изменить ${kind === "routing" ? "правило" : (item as TeamUser).name}`}
                            onClick={() => open(item)}
                          >
                            <Icon name="edit" size={18} />
                          </button>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          !resource.error && (
            <EmptyState
              title={kind === "users" ? "Сотрудники не найдены" : "Записей пока нет"}
              text={kind !== "users" || admin ? "Добавьте первую запись с помощью кнопки выше." : actor.role === "MANAGER" ? "В вашем подразделении нет доступных активных сотрудников." : "Ваша запись недоступна. Обратитесь к администратору."}
            />
          )
        )}
      </section>
      {resource.data && resource.data.pagination.totalPages > 1 && (
        <div className="events-pagination">
          <button
            className="button button-small"
            disabled={page === 1}
            onClick={() => setPage((v) => v - 1)}
          >
            Назад
          </button>
          <span>
            Страница {page} из {resource.data.pagination.totalPages}
          </span>
          <button
            className="button button-small"
            disabled={page >= resource.data.pagination.totalPages}
            onClick={() => setPage((v) => v + 1)}
          >
            Далее
          </button>
        </div>
      )}
      {editor && kind === "routing" && admin && <RoutingEditor rule={editor === "new" ? null : editor as RoutingDto} categories={categories} departments={departments} users={users} onClose={() => setEditor(null)} onSaved={() => { resource.refresh(); categories.refresh(); departments.refresh(); users.refresh(); }} />}
      {editor && kind !== "routing" && admin && (
        <Modal
          title={`${edit ? "Изменить" : "Добавить"} ${{ users: "пользователя", departments: "подразделение", categories: "категорию", routing: "правило" }[kind]}`}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            ref={formRef}
            noValidate={simpleDirectory}
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (simpleDirectory && (!admin || saving.current)) return;
              if (kind === "users" && (saving.current || !admin || edit?.id === actor.id || departments.loading || departments.error || (!edit && !activeDepartments.length))) return;
              const f = new FormData(e.currentTarget);
              if (simpleDirectory) {
                const errors: Record<string, string> = {};
                const name = String(f.get("name") ?? "").trim();
                const description = String(f.get("description") ?? "").trim();
                if (name.length < 2 || name.length > 120) errors.name = "Название должно содержать от 2 до 120 символов без крайних пробелов.";
                if (kind === "categories" && description.length > 1000) errors.description = "Описание должно содержать не больше 1000 символов.";
                setFieldErrors(errors);
                setError(null);
                const first = Object.keys(errors)[0];
                if (first) { formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus(); return; }
                f.set("name", name); if (kind === "categories") f.set("description", description);
              }
              saving.current = true;
              setBusy(true);
              setError(null);
              setFieldErrors({});
              let data: Record<string, unknown>;
              if (kind === "users") {
                data = {
                  name: f.get("name"),
                  username: f.get("username"),
                  email: f.get("email") || null,
                  role: f.get("role"),
                  ...(!editUser || f.get("departmentId") !== editUser.departmentId ? { departmentId: f.get("departmentId") } : {}),
                  canViewCompanyAnalytics:
                    f.get("canViewCompanyAnalytics") === "on",
                  ...(edit ? { isActive: f.get("isActive") === "on" } : {}),
                  ...(f.get("password") ? { password: f.get("password") } : {}),
                };
              } else
                data = {
                  name: f.get("name"),
                  ...(kind === "categories"
                    ? { description: f.get("description") || null }
                    : {}),
                  isActive: f.get("isActive") === "on",
                };
              try {
                await writeApi(
                  `${endpoint}${edit ? `/${edit.id}` : ""}`,
                  data,
                  edit ? "PATCH" : "POST",
                );
                resource.refresh();
                if (!simpleDirectory) departments.refresh();
                setEditor(null);
              } catch (err) {
                if (simpleDirectory && err instanceof ApiRequestError) {
                  const fields: Record<string, string> = {};
                  for (const detail of err.details ?? []) if (["name", "description", "isActive"].includes(detail.path)) fields[detail.path] = detail.message;
                  if (err.code === "CONFLICT") fields.name = kind === "categories" ? "Категория с таким названием уже существует." : "Подразделение с таким названием уже существует.";
                  if (kind === "departments" && err.code === "HAS_ACTIVE_USERS") fields.isActive = "Нельзя деактивировать подразделение с активными сотрудниками. Сначала переведите или отключите их.";
                  setFieldErrors(fields);
                  const first = Object.keys(fields)[0];
                  if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
                }
                if (kind === "users" && err instanceof ApiRequestError) {
                  const fields: Record<string, string> = {};
                  for (const detail of err.details ?? []) if (["name", "username", "email", "password", "role", "departmentId", "canViewCompanyAnalytics", "isActive"].includes(detail.path)) fields[detail.path] = detail.message;
                  if (err.code === "INVALID_DEPARTMENT") fields.departmentId = err.message;
                  setFieldErrors(fields);
                  const first = Object.keys(fields)[0];
                  if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
                }
                setError(
                  err instanceof Error ? err.message : "Не удалось сохранить",
                );
              } finally {
                saving.current = false;
                setBusy(false);
              }
            }}
          >
            <ErrorNotice message={error} />
            {kind === "users" && <>
              <ErrorNotice message={departments.error} retry={departments.refresh} />
              {departments.loading && <Loading label="Загружаем подразделения…" />}
              {!departments.loading && !departments.error && activeDepartments.length === 0 && <p className="team-help" role="status">Доступных активных подразделений нет.{edit ? " Текущее подразделение сохраняется без изменения." : " Создание пользователя недоступно до появления активного подразделения."}</p>}
              {departmentLimit && <p className="team-help">Доступны первые {departments.data!.items.length} из {departments.data!.pagination.total} подразделений. Список неполный.</p>}
            </>}
            {kind === "users" ? (
              <>
                <label>
                  Имя и фамилия
                  <input
                    name="name"
                    {...fieldProps("name")}
                    defaultValue={(edit as TeamUser)?.name}
                    minLength={2}
                    maxLength={120}
                    required
                  />
                  {fieldError("name")}
                </label>
                <label>Ник<input name="username" {...fieldProps("username")} defaultValue={(edit as TeamUser)?.username ?? ""} autoComplete="off" required minLength={3} maxLength={32} />{fieldError("username")}</label>
                <label>
                  Почта (необязательно)
                  <input
                    name="email"
                    {...fieldProps("email")}
                    type="email"
                    defaultValue={(edit as TeamUser)?.email ?? ""}
                  />
                  {fieldError("email")}
                </label>
                <label>
                  {edit ? "Новый пароль (необязательно)" : "Пароль"}
                  <input
                    name="password"
                    {...fieldProps("password")}
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    required={!edit}
                    placeholder="Не меньше 12 символов"
                  />
                  {fieldError("password")}
                </label>
                <div className="form-row">
                  <label>
                    Роль
                    <select
                      name="role"
                      {...fieldProps("role")}
                      defaultValue={(edit as TeamUser)?.role ?? "EMPLOYEE"}
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {fieldError("role")}
                  </label>
                  <label>
                    Подразделение
                    <select
                      name="departmentId"
                      {...fieldProps("departmentId")}
                      disabled={departments.loading || Boolean(departments.error)}
                      defaultValue={(edit as TeamUser)?.departmentId ?? ""}
                      required
                    >
                      <option value="" disabled>
                        Выберите
                      </option>
                      {missingDepartment && <option value={editUser.departmentId}>{departmentName(editUser.departmentId)} (текущее; без изменения)</option>}
                      {departments.data?.items
                        .filter((d) => d.isActive)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                    {fieldError("departmentId")}
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="canViewCompanyAnalytics"
                    {...fieldProps("canViewCompanyAnalytics")}
                    defaultChecked={(edit as TeamUser)?.canViewCompanyAnalytics}
                  />
                  Доступ к общей аналитике компании
                  {fieldError("canViewCompanyAnalytics")}
                </label>
                {edit && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="isActive"
                      {...fieldProps("isActive")}
                      defaultChecked={(edit as TeamUser)?.isActive !== false}
                    />
                    Учётная запись активна
                    {fieldError("isActive")}
                  </label>
                )}
                <p className="form-help">
                  При изменении пользователя его текущие сессии будут завершены.
                </p>
              </>
            ) : (
              <>
                <label>
                  Название
                  <input
                    name="name"
                    {...fieldProps("name")}
                    defaultValue={(edit as CategoryDto)?.name}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                  {kind === "categories" && <small className="category-help">Обязательное поле: от 2 до 120 символов.</small>}
                  {kind === "departments" && <small className="department-help">Обязательное поле: от 2 до 120 символов.</small>}
                  {fieldError("name")}
                </label>
                {kind === "categories" && (
                  <label>
                    Описание
                    <textarea
                      name="description"
                      {...fieldProps("description")}
                      defaultValue={(edit as CategoryDto)?.description ?? ""}
                      maxLength={1000}
                    />
                    <small className="category-help">Необязательное поле, до 1000 символов.</small>
                    {fieldError("description")}
                  </label>
                )}
                <label className="checkbox">
                  <input
                    name="isActive"
                    {...fieldProps("isActive")}
                    type="checkbox"
                    defaultChecked={(edit as CategoryDto)?.isActive ?? true}
                  />
                  Активно
                  {fieldError("isActive")}
                </label>
                {kind === "categories" && <p className="category-help">Неактивная категория недоступна для новых обращений. Существующие обращения сохраняются.</p>}
                {kind === "departments" && <p className="department-help">Для деактивации сначала переведите или отключите активных сотрудников подразделения. Существующие обращения и связи не удаляются.</p>}
              </>
            )}
            <div className="form-actions">
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={() => setEditor(null)}
              >
                Отмена
              </button>
              <button className="button button-primary" disabled={busy || (kind === "users" && (departments.loading || Boolean(departments.error) || (!edit && !activeDepartments.length)))}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Container>
  );
}
