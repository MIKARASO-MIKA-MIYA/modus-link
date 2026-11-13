"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type {
  AnalyticsDto,
  CategoryDto,
  DepartmentDto,
  PageDto,
  TicketDto,
  UserSummary,
} from "@/types/api";
import { statuses } from "@/types/domain";
import { useAuth } from "./app-frame";
import { useResource } from "./use-resource";
import {
  EmptyState,
  ErrorNotice,
  Loading,
  MetricCard,
  PageHeading,
  PaginationControls,
} from "./ui/shared";
import { statusLabels, dateLabel } from "./ui/format";
import { Icon } from "./ui/icon";
import { downloadCsv, TicketTable } from "./ticket-table";
export function TicketsScreen() {
  const { actor } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const [selection, setSelection] = useState<string[]>([]);
  const query = new URLSearchParams(params.toString());
  if (!query.has("pageSize")) query.set("pageSize", "10");
  const resource = useResource<PageDto<TicketDto>>(
    `tickets?${query.toString()}`,
  );
  const summary = useResource<AnalyticsDto>("analytics/overview");
  const categories = useResource<PageDto<CategoryDto>>(
    "categories?pageSize=100",
  );
  const departments = useResource<PageDto<DepartmentDto>>(
    "departments?pageSize=100",
  );
  const users = useResource<PageDto<UserSummary>>(
    actor.role === "EMPLOYEE" ? null : "users?pageSize=100",
  );
  function filter(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.replace(`/tickets${next.size ? `?${next}` : ""}`);
  }
  const unassigned = params.get("unassigned") === "true",
    overdue = params.get("overdue") === "true",
    archived = params.get("archived") === "true";
  const group = params.get("stateGroup");
  const title =
    group === "COMPLETED"
      ? "Завершённые обращения"
      : group === "ACTIVE"
        ? "В работе и на рассмотрении"
        : group === "IMPLEMENTED"
          ? "Реализованные обращения"
          : unassigned
            ? "Без ответственного"
            : overdue
              ? "Просроченные обращения"
              : archived
                ? "Архив обращений"
                : actor.role === "EMPLOYEE"
                  ? "Мои обращения"
                  : "Все обращения";
  const data = summary.data;
  const currentSelection =
    resource.data?.items.filter((t) => selection.includes(t.id)) ?? [];
  return (
    <div className="tickets-page">
      <PageHeading
        title={title}
        description={
          actor.role === "EMPLOYEE"
            ? "Следите за рассмотрением своих проблем и предложений"
            : "Реестр обращений сотрудников с фильтрацией, назначением и контролем сроков"
        }
        action={
          <Link className="button button-primary" href="/tickets/new">
            <Icon name="plus" size={20} />
            Создать обращение
          </Link>
        }
      />
      {data && (
        <div className="metrics-grid metrics-grid-six">
          <MetricCard
            label="Всего обращений"
            value={data.total}
            icon="file"
            href="/tickets"
          />
          <MetricCard
            label="Новых"
            value={data.new}
            icon="ticket"
            tone="blue"
            href="/tickets?status=NEW"
          />
          <MetricCard
            label="В работе"
            value={data.inProgress}
            icon="refresh"
            href="/tickets?status=IN_PROGRESS"
          />
          <MetricCard
            label="Требуют уточнения"
            value={data.needsClarification}
            icon="clock"
            tone="orange"
            href="/tickets?status=NEEDS_CLARIFICATION"
          />
          <MetricCard
            label="Просрочено"
            value={data.overdue}
            icon="alert"
            tone="red"
            href="/tickets?overdue=true"
          />
          <MetricCard
            label="Завершено"
            value={data.completed}
            icon="check"
            tone="green"
          />
        </div>
      )}
      <section className="registry-filters" aria-label="Фильтры обращений">
      <div className="registry-toolbar">
        <label className="filter-control">
          <span>Статус</span>
          <select
            value={params.get("status") ?? ""}
            onChange={(e) => filter({ status: e.target.value, stateGroup: "" })}
          >
            <option value="">Все статусы</option>
            {statuses.map((s) => (
              <option value={s} key={s}>
                {statusLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-control">
          <span>Категория</span>
          <select
            value={params.get("categoryId") ?? ""}
            onChange={(e) => filter({ categoryId: e.target.value })}
          >
            <option value="">Все категории</option>
            {categories.data?.items.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-control">
          <span>Подразделение</span>
          <select
            value={params.get("departmentId") ?? ""}
            onChange={(e) => filter({ departmentId: e.target.value })}
          >
            <option value="">Все доступные</option>
            {departments.data?.items.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter-control">
          <span>Ответственный</span>
          <select
            disabled={actor.role === "EMPLOYEE"}
            value={params.get("assigneeId") ?? ""}
            onChange={(e) =>
              filter({ assigneeId: e.target.value, unassigned: "" })
            }
          >
            <option value="">Все ответственные</option>
            {users.data?.items
              .filter((u) => u.role !== "EMPLOYEE")
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
        </label>
        <form
          className="search-control"
          onSubmit={(e) => {
            e.preventDefault();
            const value = new FormData(e.currentTarget).get("q") as string;
            filter({ q: value.trim() });
          }}
        >
          <Icon name="search" size={21} />
          <input
            name="q"
            key={params.get("q")}
            aria-label="Поиск по номеру, теме или автору"
            placeholder="Поиск по номеру, теме или автору"
            defaultValue={params.get("q") ?? ""}
            minLength={2}
          />
          <button type="submit" className="sr-only">
            Найти
          </button>
        </form>
      </div>
      <div className="filter-extras">
        {params.get("includeArchived") === "true" && !archived && (
          <span className="muted small">С учётом архива</span>
        )}
        <select
          aria-label="Тип обращения"
          value={params.get("type") ?? ""}
          onChange={(e) => filter({ type: e.target.value })}
        >
          <option value="">Все типы</option>
          <option value="PROBLEM">Проблема</option>
          <option value="SUGGESTION">Предложение</option>
          <option value="POSITIVE_FEEDBACK">Отзыв</option>
        </select>
        <select
          aria-label="Приоритет"
          value={params.get("priority") ?? ""}
          onChange={(e) => filter({ priority: e.target.value })}
        >
          <option value="">Любой приоритет</option>
          <option value="HIGH">Высокий</option>
          <option value="MEDIUM">Средний</option>
          <option value="LOW">Низкий</option>
        </select>
        <label>
          Срок до:{" "}
          <input
            type="date"
            aria-label="Срок рассмотрения до даты"
            value={params.get("dueBefore")?.slice(0, 10) ?? ""}
            onChange={(e) =>
              filter({
                dueBefore: e.target.value
                  ? `${e.target.value}T23:59:59+05:00`
                  : "",
              })
            }
          />
        </label>
        {(group ||
          params.get("includeArchived") ||
          unassigned ||
          overdue ||
          params.get("q") ||
          params.get("status") ||
          params.get("categoryId") || params.get("departmentId") ||
          params.get("assigneeId") || params.get("authorId") ||
          params.get("type") || params.get("priority") || params.get("dueBefore") || archived) && (
          <button
            className="text-button"
            onClick={() => router.replace("/tickets")}
          >
            Сбросить фильтры
          </button>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={archived}
            onChange={(e) =>
              filter({ archived: e.target.checked ? "true" : "" })
            }
          />
          Только архив
        </label>
        {actor.role !== "EMPLOYEE" && (
          <label className="checkbox">
            <input type="checkbox" checked={unassigned} onChange={(e) => filter({ unassigned: e.target.checked ? "true" : "", assigneeId: "" })} />
            Без ответственного
          </label>
        )}
        {actor.role !== "EMPLOYEE" && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={params.get("authorId") === actor.id}
              onChange={(e) =>
                filter({ authorId: e.target.checked ? actor.id : "" })
              }
            />
            Только мои
          </label>
        )}
      </div>
      </section>
      <ErrorNotice
        message={
          resource.error ||
          categories.error ||
          departments.error ||
          users.error ||
          summary.error
        }
        retry={() => { resource.refresh(); categories.refresh(); departments.refresh(); users.refresh(); summary.refresh(); }}
      />
      {currentSelection.length > 0 && (
        <div className="selection-toolbar">
          <span>Выбрано: {currentSelection.length}</span>
          <button
            className="text-button"
            onClick={() =>
              downloadCsv("modus-link-tickets.csv", [
                [
                  "Номер",
                  "Тема",
                  "Категория",
                  "Статус",
                  "Ответственный",
                  "Срок",
                ],
                ...currentSelection.map((t) => [
                  t.number,
                  t.title,
                  t.category.name,
                  statusLabels[t.status],
                  t.assignee?.name ?? "Не назначен",
                  dateLabel(t.dueAt),
                ]),
              ])
            }
          >
            <Icon name="download" size={16} />
            Скачать CSV
          </button>
          <button className="text-button" onClick={() => setSelection([])}>
            Снять выделение
          </button>
        </div>
      )}
      <section className="panel registry-panel" aria-busy={resource.loading}>
        {resource.loading && !resource.data ? (
          <Loading />
        ) : resource.data?.items.length ? (
          <TicketTable
            items={resource.data.items}
            selected={new Set(selection)}
            onSelect={(id) =>
              setSelection((ids) =>
                ids.includes(id)
                  ? ids.filter((value) => value !== id)
                  : [...ids, id],
              )
            }
            sort={params.get("sortBy") ?? "createdAt"}
            onSort={(field) =>
              filter({
                sortBy: field,
                order:
                  params.get("sortBy") === field &&
                  params.get("order") !== "asc"
                    ? "asc"
                    : "desc",
              })
            }
          />
        ) : (
          !resource.error && (
            <EmptyState
              title="Обращения не найдены"
              text="Попробуйте изменить фильтры или создать новое обращение."
            />
          )
        )}
      {resource.data && (
        <PaginationControls
          {...resource.data.pagination}
          onPage={(page) => {
            const next = new URLSearchParams(params.toString());
            next.set("page", String(page));
            router.replace(`/tickets?${next}`);
          }}
          onSize={(size) => filter({ pageSize: String(size) })}
        />
      )}
      </section>
    </div>
  );
}
