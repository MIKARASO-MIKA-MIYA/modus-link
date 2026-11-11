"use client";
import Link from "next/link";
import { useState } from "react";
import type {
  AdminUserDto,
  CategoryDto,
  DepartmentDto,
  PageDto,
  RoutingDto,
  UserSummary,
} from "@/types/api";
import { writeApi } from "@/lib/client-api";
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
type DirectoryKind = "users" | "departments" | "categories" | "routing";
type TeamUser = UserSummary & Partial<AdminUserDto>;
type RecordItem = TeamUser | DepartmentDto | CategoryDto | RoutingDto;
export function AdminDirectory({ kind }: { kind: DirectoryKind }) {
  const { actor } = useAuth();
  const admin = actor.role === "ADMIN";
  const endpoint = kind;
  const [page, setPage] = useState(1);
  const resource = useResource<PageDto<RecordItem>>(
    !admin && kind !== "users" ? null : `${endpoint}?pageSize=20&page=${page}`,
  );
  const departments = useResource<PageDto<DepartmentDto>>(
    "departments?pageSize=100",
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
  const names = {
    users: admin ? "Пользователи и роли" : "Команда",
    departments: "Подразделения",
    categories: "Категории и параметры",
    routing: "Маршрутизация",
  };
  const descriptions = {
    users: "Сотрудники, руководители и их права доступа",
    departments: "Управление структурой компании",
    categories: "Темы обращений и правила сроков рассмотрения",
    routing:
      "Автоматическое назначение ответственных по категориям и подразделениям",
  };
  const edit = editor === "new" ? null : editor;
  const departmentName = (id: string) =>
    departments.data?.items.find((d) => d.id === id)?.name ??
    "Другое подразделение";
  function open(item: RecordItem | "new") {
    setEditor(item);
    setError(null);
  }
  if (!admin && kind !== "users")
    return (
      <EmptyState
        title="Нет доступа"
        text="Этот раздел доступен администратору."
      />
    );
  return (
    <>
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
          resource.error || departments.error || categories.error || users.error
        }
        retry={resource.refresh}
      />
      {kind === "categories" && (
        <section className="panel sla-panel">
          <span className="heading-icon">
            <Icon name="clock" size={26} />
          </span>
          <div>
            <h3>Сроки рассмотрения по приоритету</h3>
            <p>Высокий — 2 дня · Средний — 5 дней · Низкий — 10 дней</p>
            <small>
              Календарные дни. Ответственный может изменить срок в карточке с
              записью в историю.
            </small>
          </div>
        </section>
      )}
      <section className="panel directory-panel">
        {resource.loading && !resource.data ? (
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
                      {admin && <th>Доступ</th>}
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
                              <span className="avatar avatar-purple">
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
                            <td>
                              <span
                                className={
                                  user.isActive === false
                                    ? "muted"
                                    : "access-active"
                                }
                              >
                                {user.isActive === false
                                  ? "Отключён"
                                  : user.canViewCompanyAnalytics
                                    ? "Общая аналитика"
                                    : "По роли"}
                              </span>
                            </td>
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
                          <button
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
                          </button>
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
              title="Записей пока нет"
              text="Добавьте первую запись с помощью кнопки выше."
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
      {editor && (
        <Modal
          title={`${edit ? "Изменить" : "Добавить"} ${{ users: "пользователя", departments: "подразделение", categories: "категорию", routing: "правило" }[kind]}`}
          onClose={() => {
            if (!busy) setEditor(null);
          }}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const f = new FormData(e.currentTarget);
              let data: Record<string, unknown>;
              if (kind === "users") {
                data = {
                  name: f.get("name"),
                  username: f.get("username"),
                  email: f.get("email") || null,
                  role: f.get("role"),
                  departmentId: f.get("departmentId"),
                  canViewCompanyAnalytics:
                    f.get("canViewCompanyAnalytics") === "on",
                  ...(edit ? { isActive: f.get("isActive") === "on" } : {}),
                  ...(f.get("password") ? { password: f.get("password") } : {}),
                };
              } else if (kind === "routing")
                data = {
                  categoryId: f.get("categoryId"),
                  departmentId: f.get("departmentId") || null,
                  assigneeId: f.get("assigneeId"),
                  isActive: f.get("isActive") === "on",
                };
              else
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
                departments.refresh();
                setEditor(null);
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Не удалось сохранить",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <ErrorNotice message={error} />
            {kind === "users" ? (
              <>
                <label>
                  Имя и фамилия
                  <input
                    name="name"
                    defaultValue={(edit as TeamUser)?.name}
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </label>
                <label>Ник<input name="username" defaultValue={(edit as TeamUser)?.username ?? ""} autoComplete="off" required minLength={3} maxLength={32} /></label>
                <label>
                  Почта (необязательно)
                  <input
                    name="email"
                    type="email"
                    defaultValue={(edit as TeamUser)?.email ?? ""}
                  />
                </label>
                <label>
                  {edit ? "Новый пароль (необязательно)" : "Пароль"}
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    required={!edit}
                    placeholder="Не меньше 12 символов"
                  />
                </label>
                <div className="form-row">
                  <label>
                    Роль
                    <select
                      name="role"
                      defaultValue={(edit as TeamUser)?.role ?? "EMPLOYEE"}
                    >
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Подразделение
                    <select
                      name="departmentId"
                      defaultValue={(edit as TeamUser)?.departmentId ?? ""}
                      required
                    >
                      <option value="" disabled>
                        Выберите
                      </option>
                      {departments.data?.items
                        .filter((d) => d.isActive)
                        .map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="canViewCompanyAnalytics"
                    defaultChecked={(edit as TeamUser)?.canViewCompanyAnalytics}
                  />
                  Доступ к общей аналитике компании
                </label>
                {edit && (
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={(edit as TeamUser)?.isActive !== false}
                    />
                    Учётная запись активна
                  </label>
                )}
                <p className="form-help">
                  При изменении пользователя его текущие сессии будут завершены.
                </p>
              </>
            ) : kind === "routing" ? (
              <>
                <label>
                  Категория
                  <select
                    name="categoryId"
                    defaultValue={(edit as RoutingDto)?.categoryId ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Выберите категорию
                    </option>
                    {categories.data?.items.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Подразделение
                  <select
                    name="departmentId"
                    defaultValue={(edit as RoutingDto)?.departmentId ?? ""}
                  >
                    <option value="">
                      Все подразделения — глобальное правило
                    </option>
                    {departments.data?.items.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ответственный
                  <select
                    name="assigneeId"
                    defaultValue={(edit as RoutingDto)?.assigneeId ?? ""}
                    required
                  >
                    <option value="" disabled>
                      Выберите ответственного
                    </option>
                    {users.data?.items
                      .filter((u) => u.role !== "EMPLOYEE")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </select>
                </label>
                <p className="form-help">
                  Правило подразделения имеет приоритет перед глобальным. Для
                  одной области доступно одно активное правило.
                </p>
                <label className="checkbox">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={(edit as RoutingDto)?.isActive ?? true}
                  />
                  Правило активно
                </label>
              </>
            ) : (
              <>
                <label>
                  Название
                  <input
                    name="name"
                    defaultValue={(edit as CategoryDto)?.name}
                    required
                    minLength={2}
                    maxLength={120}
                  />
                </label>
                {kind === "categories" && (
                  <label>
                    Описание
                    <textarea
                      name="description"
                      defaultValue={(edit as CategoryDto)?.description ?? ""}
                      maxLength={1000}
                    />
                  </label>
                )}
                <label className="checkbox">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={(edit as CategoryDto)?.isActive ?? true}
                  />
                  Активно
                </label>
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
              <button className="button button-primary" disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
