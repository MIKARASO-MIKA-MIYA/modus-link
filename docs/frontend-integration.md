# Подключение интерфейса MODUS PULSE

Это контракт для frontend-разработчика и дизайнера. Интерфейс по макетам реализован в src/components; API не зависит от его верстки. Основной URL — /api/v1 на том же origin, что и frontend. TypeScript DTO доступны в src/types/api.ts; доменные enum — src/types/domain.ts. Не импортируйте Prisma Client в браузер.

## Сессия и запросы

Регистрация POST /auth/register и вход POST /auth/login используют `{username,password}` без почты. Регистрация возвращает 201 и создаёт только кабинет сотрудника; вход возвращает 200. Оба маршрута возвращают Actor и выставляют HttpOnly cookie. Формы разделяют «Создать аккаунт» и «Вход»; повторный вход использует уже сохранённые ник и пароль. Ник нечувствителен к регистру, пароль при создании — минимум 12 символов. Для нового пароля используйте autoComplete="new-password", для входа — "current-password", для ника — "username". Занятый ник: 409 USERNAME_TAKEN. Поле Actor.username обязательно, Actor.email допускает null.

Токен не возвращается в JSON, не читается JavaScript и не хранится в localStorage. При загрузке приложения GET /auth/me возвращает актуальные полномочия. Для запросов используйте credentials: same-origin. В браузере Origin для записи выставляется автоматически; APP_ORIGIN должен совпадать с адресом frontend. На Vercel точные HTTPS-адреса проекта из VERCEL_URL, VERCEL_BRANCH_URL и VERCEL_PROJECT_PRODUCTION_URL разрешаются автоматически при VERCEL=1; дополнительный собственный домен задайте через APP_ORIGIN. В development не смешивайте localhost и 127.0.0.1.

```typescript
import type { ApiSuccess, ApiError, TicketDto, CreateTicketInput } from '@/types/api';

async function createTicket(input: CreateTicketInput): Promise<TicketDto> {
  const res = await fetch('/api/v1/tickets', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const payload = await res.json() as ApiSuccess<TicketDto> | ApiError;
  if ('error' in payload) throw new Error(payload.error.message);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return payload.data;
}
```

Для разработки отдельного frontend-сервера настройте same-origin reverse proxy на /api; не включайте произвольный CORS с credentials. Production требует HTTPS; Secure cookie включается принудительно. API не принимает роль, authorId, assigneeId, status или departmentId в форме создания обращения.

## Состояния экранов

У каждого запроса различайте initial/loading/success/empty/error. Во время записи отключайте повторную отправку. Ошибки валидации содержат details с path полей; сетевые ошибки могут вообще не содержать JSON. При 401 очистите отображаемый профиль и предложите вход. При 403 покажите причину отсутствия права. При 404 показывайте «Обращение не найдено или недоступно». При 409 VERSION_CONFLICT заново загрузите карточку, сохранив черновик пользователя, и предложите повторить осознанно. Не повторяйте запись автоматически: idempotency key в этом MVP не реализован.

Нельзя считать client-side роль защитой. Возможности кнопок служат подсказкой, последнее решение всегда принимает API. canViewCompanyAnalytics даёт только общую аналитику. Самого себя нельзя назначить на обработку собственного обращения или согласовать его даже при ADMIN. MANAGER не обязательно видит каждое обращение компании.

## Основные экраны

1. **Мои обращения**: GET /tickets, фильтры, пагинация; у сотрудника сервер уже ограничивает выборку автором.
2. **Создание**: GET /categories?pageSize=100 с учётом пагинации; title 3..200, description 10..10000, type, categoryId, priority. После 201 покажите серверный number, status, dueAt и assignee либо «В очереди распределения».
3. **Реестр руководителя**: сохранённые фильтры status=NEW, unassigned=true, overdue=true. Фильтры могут пересекаться. Отсутствие исполнителя не является ошибкой регистрации.
4. **Карточка**: GET /tickets/:id + отдельные пагинируемые comments/history. Срок и просрочку вычисляйте по dueAt и статусу. Завершённые статусы: IMPLEMENTED/REJECTED/CLOSED.
5. **Уточнение**: обработчик POST /status с message; автор POST /comments PUBLIC. Ответ вернёт comment и обновлённый ticket со статусом UNDER_REVIEW.
6. **Решение**: переход в IMPLEMENTED/REJECTED/CLOSED с resolution. Причина отказа обязательна; показывайте результат автору. Поле outcome сохраняет исход при CLOSED.
7. **Архив**: GET /tickets?archived=true; прямой URL остаётся доступен автору. POST /archive меняет archived. Кнопки удаления нет.
8. **Сводка**: GET /analytics/overview, /categories, /departments. Для собственника в том же приложении отображается scope=COMPANY; для остальных — доступная им область. Общие метрики, подразделения, категории, сроки и исходы уже доступны через API и панель с диаграммами на главной странице и /analytics.
9. **Настройки ADMIN**: справочники, пользователи, правила. Разделы /team и /settings уже работают в том же приложении.

Все изменяющие запросы обращения требуют актуальный version: PATCH, status, assign, comments, archive. Большинство возвращают обновлённый TicketDto. Комментарий возвращает `{comment,ticket}`. После записи заменяйте локальную карточку серверным ответом и обновляйте список событий.

Историю показывайте по action и oldValue/newValue; payload зависит от действия. Не предполагайте, что автор видит INTERNAL. Ссылки на историю синтетических данных можно помечать isSynthetic. Категория и подразделение вложены в карточку; даты — строки ISO 8601, отображение в локальном часовом поясе клиента. Долю reviewedShare умножайте на 100, среднее время может быть null.

Полные переходы и доступ: architecture.md. Примеры тел и ошибок: api.md. Отсутствующие возможности не следует изображать работающими: почтовые и push-уведомления, а также внешние интеграции пока отсутствуют. Загрузка файлов уже работает: используйте multipart на /tickets/:id/attachments с file и актуальной version. Возвращается {attachment,ticket}; типы и лимиты описаны в api.md.

## Развитие контракта

Изменения, совместимые с v1: новые необязательные поля и новые отдельные маршруты. Не меняйте тип существующего поля, смысл статуса или ограничения доступа без согласования. Для несовместимого поведения создавайте v2. Общие элементы находятся в src/components/ui, стили — src/app/globals.css. Дизайн можно менять, сохраняя src/server и REST API. Поведение ресурсов и сессии вынесено в use-resource.ts и app-frame.tsx. Макеты и ограничения визуальной проверки описаны в design.md.
## Добавления для реализованных экранов

Фильтры assigneeId/authorId и q по имени автора по-прежнему пересекаются с серверной областью. sortBy=createdAt|number|dueAt, order=asc|desc. Группы stateGroup=ACTIVE (UNDER_REVIEW + IN_PROGRESS), COMPLETED (три завершённых статуса), IMPLEMENTED (первоначальный outcome) используются в переходах из карточек показателей. includeArchived=true показывает и архив; archived=true — только архив и имеет приоритет.

Аналитика поддерживает days=7|30|90|all. Новые поля AnalyticsDto: periodDays, unassigned, onTimeShare, deadlineDistribution, dailyTrend. Графики строятся по реальным timestamps, а не по заданным в макете числам. Даты интерфейса отображаются в Asia/Qyzylorda, UTC+5.

GET /notifications — последние 50 PUBLIC событий доступных обращений, кроме собственных действий. Отметки просмотра хранятся только в текущем браузере. Выход и повторный вход переводят на главную соответствующего кабинета. Выбор кабинета до входа не назначает роль и не передаёт role серверу.
