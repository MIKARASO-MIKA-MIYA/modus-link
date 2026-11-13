"use client";
import Link from "next/link";
import { useState } from "react";
import { useAuth, type NoticeDto } from "./app-frame";
import { useResource } from "./use-resource";
import { Icon } from "./ui/icon";
import { EmptyState, ErrorNotice, Loading, PageHeading } from "./ui/shared";
import { dateLabel, historyLabel, initials, roleLabels } from "./ui/format";
export function ProfileScreen() {
  const { actor, department, logout } = useAuth();
  return (
    <>
      <PageHeading
        title="Мой профиль"
        description="Ваша учётная запись и права доступа"
      />
      <section className="panel profile-panel">
        <div className="profile-cover">
          <span className="profile-avatar">{initials(actor.name)}</span>
          <div>
            <h2>{actor.name}</h2>
            <span>{department}</span>
          </div>
          <span className="role-pill">{roleLabels[actor.role]}</span>
        </div>
        <dl className="profile-fields">
          <div>
            <dt>Ник для входа</dt>
            <dd>{actor.username}</dd>
          </div>
          <div>
            <dt>Подразделение</dt>
            <dd>{department || "—"}</dd>
          </div>
          <div>
            <dt>Роль</dt>
            <dd>{roleLabels[actor.role]}</dd>
          </div>
          <div>
            <dt>Общая аналитика</dt>
            <dd>
              {actor.canViewCompanyAnalytics || actor.role === "ADMIN"
                ? "Доступ предоставлен"
                : "В пределах вашей роли"}
            </dd>
          </div>
        </dl>
        <p className="form-help">
          Для изменения ника, имени, пароля или подразделения обратитесь к
          администратору системы.
        </p>
        <button className="button button-quiet" onClick={() => void logout()}>
          <Icon name="logout" size={18} />
          Выйти из системы
        </button>
      </section>
    </>
  );
}
export function NotificationsScreen() {
  const { actor } = useAuth();
  const resource = useResource<{ items: NoticeDto[] }>("notifications");
  const [marked, setMarked] = useState(false);
  return (
    <>
      <PageHeading
        title="Уведомления"
        description="Последние изменения по доступным вам обращениям"
        action={
          <button
            className="button button-quiet"
            onClick={() => {
              localStorage.setItem(
                `modus:seen:${actor.id}`,
                new Date().toISOString(),
              );
              window.dispatchEvent(new Event("modus:notices-read"));
              setMarked(true);
            }}
            disabled={marked}
          >
            <Icon name="check" size={18} />
            {marked ? "Всё просмотрено" : "Отметить просмотренными"}
          </button>
        }
      />
      <ErrorNotice message={resource.error} retry={resource.refresh} />
      <section className="panel notifications-panel">
        {resource.loading ? (
          <Loading />
        ) : resource.data?.items.length ? (
          resource.data.items.map((row) => (
            <Link
              className="notification-row"
              key={row.id}
              href={`/tickets/${row.ticket.id}`}
            >
              <span className="notification-icon">
                <Icon
                  name={
                    row.action === "ASSIGNED"
                      ? "user"
                      : row.action.includes("CLARIFICATION")
                        ? "help"
                        : "ticket"
                  }
                  size={22}
                />
              </span>
              <span>
                <strong>{historyLabel(row.action)}</strong>
                <p>
                  #{row.ticket.number} · {row.ticket.title}
                </p>
                <small>
                  {row.actor.name} · {dateLabel(row.createdAt, true)}
                </small>
              </span>
              <Icon name="chevron" size={20} />
            </Link>
          ))
        ) : (
          !resource.error && <EmptyState
            title="Новых событий пока нет"
            text="Здесь появятся ответы и изменения по вашим обращениям."
          />
        )}
      </section>
    </>
  );
}
export function HelpScreen() {
  const questions = [
    {
      title: "Как создать обращение?",
      text: "Нажмите «Создать обращение», выберите тип и категорию, кратко сформулируйте тему и опишите ситуацию. При необходимости прикрепите документы. После отправки появится номер обращения и назначенный ответственный.",
    },
    {
      title: "Что делать, если ответственный не назначен?",
      text: "Обращение уже сохранено и попало в очередь распределения. Руководитель или администратор назначит ответственного. Вы можете наблюдать за статусом в разделе «Мои обращения».",
    },
    {
      title: "Как ответить на запрос уточнения?",
      text: "Откройте карточку и добавьте публичный комментарий с ответом. После отправки обращение автоматически вернётся на рассмотрение.",
    },
    {
      title: "Какие сроки рассмотрения?",
      text: "Первоначальный срок зависит от приоритета: 2 календарных дня для высокого, 5 для среднего и 10 для низкого. Руководитель может изменить срок с сохранением изменения в истории.",
    },
    {
      title: "Кто видит моё обращение?",
      text: "Вы, руководитель вашего подразделения, назначенный ответственный и администратор. Служебные заметки обработчиков не показываются автору. Итоговое решение всегда доступно автору.",
    },
    {
      title: "Что происходит после решения?",
      text: "Результат появится в карточке вместе с датой и историей. Если обращение отклонено, будет указана причина. Завершённое обращение можно перенести в архив; результат и история сохранятся.",
    },
  ];
  return (
    <>
      <PageHeading
        title="База знаний"
        description="Как работает MODUS LINK и как получить результат по обращению"
      />
      <section className="panel help-intro">
        <span className="heading-icon">
          <Icon name="book" size={30} />
        </span>
        <div>
          <h2>Ваш голос помогает менять компанию</h2>
          <p>
            Сообщайте о проблемах, предлагайте улучшения и делитесь
            положительным опытом.
          </p>
        </div>
        <Link className="button button-primary" href="/tickets/new">
          Создать обращение
          <Icon name="arrow" size={18} />
        </Link>
      </section>
      <div className="faq-list">
        {questions.map((question, i) => (
          <details
            className="panel faq-item"
            key={question.title}
            open={i === 0}
          >
            <summary>
              {question.title}
              <Icon name="chevron" size={19} />
            </summary>
            <p>{question.text}</p>
          </details>
        ))}
      </div>
    </>
  );
}
