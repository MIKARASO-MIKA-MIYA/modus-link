# REST API v1

Базовый URL `/api/v1`. JSON UTF-8. Кроме бинарного скачивания вложений ответы имеют описанный ниже JSON-формат. Все приватные запросы используют серверную сессию из HttpOnly cookie `modus_session`. Записывающие запросы требуют `Origin`, в точности равный origin из APP_ORIGIN либо HTTPS-адресу проекта из системных переменных Vercel (`VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` при `VERCEL=1`), и при наличии тела `Content-Type: application/json`. Без настройки вне production разрешён `http://localhost:3000`; в production автоматического допуска localhost нет. CORS между разными сайтами не включён. Максимум тела JSON 64 KiB; multipart-загрузка ограничена 10 МиБ плюс 64 КиБ служебной формы. Роль, автор, номер и подразделение при создании определяются сервером.

## Ответы

```json
{ "data": { "id": "uuid", "status": "NEW", "version": 1 } }
```

Создание возвращает 201, чтение и изменение 200. Списки обращений и справочников:

```json
{
  "data": {
    "items": [],
    "pagination": { "page": 1, "pageSize": 20, "total": 0, "totalPages": 0 }
  }
}
```

Пагинация page=1..100000, pageSize=1..100. Аналитика по категориям/подразделениям возвращает агрегированный items и scope/asOf без пагинации. Каждый ответ API запрещает кэширование. Карточка не включает массивы комментариев и истории — они читаются отдельными маршрутами.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте поля запроса",
    "details": [{ "path": "title", "message": "..." }],
    "requestId": "uuid"
  }
}
```

| HTTP | Примеры code | Поведение клиента |
| --- | --- | --- |
| 400 | INVALID_JSON | Исправить JSON |
| 401 | UNAUTHENTICATED, INVALID_CREDENTIALS | Показать вход/ошибку учётных данных |
| 403 | FORBIDDEN, INVALID_ORIGIN, SELF_ADMIN_CHANGE | Объяснить отсутствие прав |
| 404 | NOT_FOUND | Карточка не найдена или недоступна |
| 405 | METHOD_NOT_ALLOWED | Проверить метод; DELETE не поддерживается |
| 409 | USERNAME_TAKEN, VERSION_CONFLICT, INVALID_TRANSITION, CONFLICT, ARCHIVED, COMPLETED, UNRESOLVED, HAS_ACTIVE_TICKETS, HAS_ACTIVE_USERS | Показать причину; при USERNAME_TAKEN предложить другой ник |
| 413, 415 | PAYLOAD_TOO_LARGE, UNSUPPORTED_MEDIA_TYPE | Ограничить тело или сменить формат |
| 422 | VALIDATION_ERROR, RESOLUTION_REQUIRED, CLARIFICATION_REQUIRED, INACTIVE_CATEGORY, INVALID_ASSIGNEE, INVALID_ROUTING, INVALID_REFERENCE, INVALID_DEPARTMENT | Ошибка полей или бизнес-правила |
| 429 | RATE_LIMITED | Повторить вход после окна 15 минут |
| 500 | INTERNAL_ERROR | Сохранить requestId для диагностики |

GET /health — исключение без авторизации: data.status=ok/unavailable, database=connected/disconnected, HTTP 200/503. Содержимое ошибок БД и пароли клиенту не возвращаются.

## Маршруты

| Метод и путь | Назначение и права |
| --- | --- |
| POST /auth/register | username, password; создаёт EMPLOYEE без почты, возвращает Actor и cookie, HTTP 201 |
| POST /auth/login | username, password; сессия и cookie, возвращает Actor. Для прежних интеграций поддерживается email вместо username |
| POST /auth/logout | Отозвать текущую сессию и cookie; нужен вход |
| GET /auth/me, GET /users/me | Актуальный Actor: id/name/username/email/role/departmentId/canViewCompanyAnalytics; email может быть null |
| GET /tickets | Доступные обращения и пагинация |
| POST /tickets | Создать от имени текущего пользователя; все роли |
| GET /tickets/:id | Доступная карточка, включая архивную |
| PATCH /tickets/:id | Автор: title/description только NEW; обработчик: также priority/dueAt открытого обращения |
| GET /tickets/:id/history | Доступная история с пагинацией |
| GET /tickets/:id/comments | Доступные комментарии с пагинацией |
| POST /tickets/:id/comments | Комментарий; PUBLIC автора в NEEDS_CLARIFICATION возобновляет рассмотрение |
| POST /tickets/:id/assign | Назначить/снять исполнителя в пределах полномочий; reason обязателен |
| POST /tickets/:id/status | Допустимый переход, решение или вопрос |
| POST /tickets/:id/archive | Архивировать/восстановить завершённое обращение; обработчик, reason обязателен |
| GET /categories | Действующие категории, ADMIN также отключённые; пагинация |
| POST /categories, PATCH /categories/:id | ADMIN: name/description/isActive |
| GET /users | EMPLOYEE — себя; MANAGER — активных сотрудников своего подразделения; ADMIN — всех; пагинация |
| POST /users, PATCH /users/:id | Только ADMIN; создать пользователя/сменить роль, право аналитики, активность, пароль, подразделение |
| GET /routing | ADMIN: правила с категорией, подразделением и ответственным; пагинация |
| POST /routing, PATCH /routing/:id | ADMIN: настройки правила |
| GET /departments | Своё подразделение; ADMIN/право общей аналитики — все; пагинация |
| POST /departments, PATCH /departments/:id | ADMIN: name/isActive |
| GET /analytics/overview | Сводка по доступной области, включая архив |
| GET /analytics/categories | Агрегаты по категориям той же области |
| GET /analytics/departments | Агрегаты по подразделениям той же области |
| GET /health | Проверка настоящего подключения PostgreSQL |

UUID в пути и теле проверяются. Неизвестные поля в JSON и в query фильтров отклоняются. Входные схемы — src/server/validators/index.ts; TypeScript-контракты — src/types/api.ts. У карточки дополнительно есть category, department, author, assignee; проекции пользователей не содержат passwordHash или токены.

## Фильтры реестра

GET /tickets поддерживает `categoryId`, `status`, `departmentId`, `type`, `priority`, `dueBefore`, `dueAfter`, `overdue`, `unassigned`, `archived`, `q`, `page`, `pageSize`. Даты — ISO 8601 с timezone, границы dueBefore/dueAfter включительные. overdue=true — строго просроченные открытые, false — остальные. unassigned=true — assigneeId=null, false — назначенные. archived=false по умолчанию, true — только архив. Нельзя получить чужие карточки через фильтр подразделения: параметры пересекаются с серверной областью доступа. Повторяющиеся query-параметры отклоняются.

q — регистронезависимый поиск подстроки по номеру, заголовку, описанию и имени автора. Это базовый поиск в реестре, не ранжирование похожих обращений. Сортировка createdAt DESC, id DESC. Комментарии и история — createdAt ASC, id ASC.

```text
/api/v1/tickets?status=NEW&page=1&pageSize=20
/api/v1/tickets?unassigned=true
/api/v1/tickets?overdue=true&priority=HIGH
/api/v1/tickets?archived=true
```

## Регистрация и вход

POST /auth/register и POST /auth/login принимают `{ "username": "konstantin_01", "password": "MyOwnPassword2026!" }`. При регистрации сервер назначает роль EMPLOYEE и подразделение «Новые сотрудники»; дополнительные поля, в том числе role и departmentId, отклоняются. Пароль хранится только как scrypt-хеш. При выходе аккаунт и обращения сохраняются, отзывается только текущая сессия.

Ник нормализуется через NFKC, trim и нижний регистр; повторяющиеся пробелы заменяются одним. Длина 3..32 символа, допустимы буквы, цифры, пробелы, точка, дефис и подчёркивание в любом порядке, например `yu _otsaka3301`. Регистрация и вход используют одинаковую нормализацию. Новый пароль 12..256 символов; при входе проверяется сохранённый пароль. Занятый ник возвращает 409 USERNAME_TAKEN. Регистрация и вход ограничены 15 попытками за 15 минут для каждого нормализованного идентификатора и операции. Неверный ник или пароль возвращает 401 INVALID_CREDENTIALS.

## Тела запросов

POST /tickets (priority необязателен, по умолчанию MEDIUM):

```json
{
  "title": "Нужно уточнить шаблон заявки",
  "description": "В шаблоне не хватает назначения изделия и параметров для закупки.",
  "type": "PROBLEM",
  "categoryId": "uuid-из-GET-categories",
  "priority": "HIGH"
}
```

PATCH /tickets/:id:

```json
{ "version": 1, "title": "Уточнённый заголовок" }
```

Обработчик может передать priority и dueAt, например `"dueAt":"2026-11-20T12:00:00Z"`. Категорию и автора существующего обращения в MVP менять нельзя.

POST /tickets/:id/status:

```json
{ "version": 2, "status": "NEEDS_CLARIFICATION", "message": "Уточните вид документа и ожидаемый результат" }
```

```json
{ "version": 3, "status": "IN_PROGRESS" }
```

```json
{ "version": 4, "status": "IMPLEMENTED", "resolution": "Шаблон обновлён, обязательные поля добавлены и проверены" }
```

```json
{ "version": 4, "status": "REJECTED", "resolution": "Сейчас нет подходящего помещения; вопрос вернётся при перепланировке" }
```

Примеры — отдельные допустимые операции, версии нужно получать из актуальной карточки. Переходы описаны в architecture.md. Для REJECTED всегда нужна новая причина; для CLOSED из IMPLEMENTED/REJECTED можно использовать уже сохранённое решение.

POST /tickets/:id/comments:

```json
{ "version": 3, "content": "Пример заявки и необходимые параметры уточнены", "visibility": "PUBLIC" }
```

Возвращает `{data:{comment: CommentDto, ticket: TicketDto}}`, чтобы клиент сразу получил новую version. INTERNAL доступен только обработчикам; автору внутренний комментарий создать нельзя. Обычные комментарии разрешены и после завершения, но до архивирования. Они не переоткрывают завершённый статус.

POST /tickets/:id/assign:

```json
{ "version": 5, "assigneeId": "uuid-ответственного", "reason": "Передано профильному специалисту" }
```

assigneeId=null возвращает обращение в нераспределённую очередь. Нельзя назначить автора или отключённого пользователя.

POST /tickets/:id/archive:

```json
{ "version": 6, "archived": true, "reason": "Решение зафиксировано и доведено до автора" }
```

Для восстановления archived=false; результат и история сохраняются.

POST /routing (departmentId=null — глобальное правило):

```json
{ "categoryId": "uuid", "departmentId": null, "assigneeId": "uuid", "isActive": true }
```

POST /categories: `{ "name": "Закупки", "description": "Вопросы закупок", "isActive": true }`. POST /departments: `{ "name": "Сервис", "isActive": true }`. PATCH принимает непустое подмножество соответствующих полей.

POST /users — только после входа ADMIN:

```json
{
  "name": "Условный руководитель",
  "username": "head_01",
  "password": "ChangeThisPassword!2026",
  "departmentId": "uuid",
  "role": "MANAGER",
  "canViewCompanyAnalytics": false
}
```

Пароль 12..256 символов. Почта необязательна (email: null либо адрес). PATCH /users/:id принимает непустое подмножество этих полей, дополнительно isActive. Изменение отзывает сессии пользователя. Понизить роль/отключить/перевести ответственного с открытыми обращениями нельзя до переназначения. Изменить собственные административные настройки нельзя.

## Пример PowerShell

```powershell
$base = 'http://localhost:3000/api/v1'
$origin = @{ Origin = 'http://localhost:3000' }
$login = @{ username = 'employee'; password = 'ModusDemo2026!' } | ConvertTo-Json
Invoke-RestMethod "$base/auth/login" -Method Post -Headers $origin -ContentType 'application/json' -Body $login -SessionVariable employeeSession
$categories = (Invoke-RestMethod "$base/categories?pageSize=100" -WebSession $employeeSession).data.items
$category = $categories | Where-Object name -eq 'Межотдельное взаимодействие' | Select-Object -First 1
$body = @{ title = 'Проверка шаблона'; description = 'В шаблоне не хватает необходимых параметров оборудования'; type = 'PROBLEM'; categoryId = $category.id; priority = 'MEDIUM' } | ConvertTo-Json
$ticket = (Invoke-RestMethod "$base/tickets" -Method Post -Headers $origin -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -WebSession $employeeSession).data
Invoke-RestMethod "$base/tickets/$($ticket.id)/history" -WebSession $employeeSession
```

Для руководителя создайте отдельную WebSession с ником manager. Не переиспользуйте cookie одной роли при демонстрации другой. Интерфейс позволяет выполнить эти же операции через формы и карточки.

## Правила аналитики

Область всех метрик: ADMIN или canViewCompanyAnalytics — компания; MANAGER — своё подразделение, назначенные и собственные; EMPLOYEE — собственные. Архив включён, поскольку результат не должен исчезать из статистики. Таблицы категорий и подразделений содержат группы, в которых есть доступные обращения; скрытые группы не раскрываются. asOf — время расчёта.

| Поле overview | Точное правило |
| --- | --- |
| total | Все обращения доступной области, включая архив |
| new | status=NEW |
| inProgress | status=IN_PROGRESS |
| underReview / needsClarification | Соответствующий текущий статус |
| completed | Текущий статус IMPLEMENTED, REJECTED или CLOSED |
| archived | archivedAt не null |
| overdue | dueAt < asOf и статус не завершённый |
| reviewed | firstRespondedAt не null |
| reviewedShare | reviewed/total, 0 при пустом реестре; дробь 0..1 |
| averageFirstResponseHours | Среднее (firstRespondedAt-createdAt) в часах среди ответивших; null без ответов |
| firstResponseSampleSize | Число обращений, вошедших в среднее |
| implementedImprovements | type=SUGGESTION и outcome=IMPLEMENTED, включая последующий CLOSED/архив |
| byType / byStatus | Счётчики по каждому значению enum, в том числе 0 |
| byCategory / byDepartment | total, completed, overdue, implemented, rejected по группе; implemented/rejected по outcome для всех типов |

firstRespondedAt фиксируется при первом публичном комментарии обработчика, отличного от автора, либо при его первом публичном изменении статуса. Автомаршрутизация, назначение, служебная заметка INTERNAL, изменение срока и ответ самого автора не считаются первым ответом. Поле записывается один раз в той же транзакции, что и реальное событие. В seed те же timestamps стоят на синтетических событиях; показатели не выдаются за реальные результаты компании. Без days среднее охватывает весь доступный период. При days используется когорта зарегистрированных за период обращений.
## Добавления для интерфейса

GET /tickets: assigneeId и authorId (UUID); sortBy=createdAt|number|dueAt, order=asc|desc. Поиск q включает имя автора. stateGroup=ACTIVE соответствует UNDER_REVIEW и IN_PROGRESS, COMPLETED — IMPLEMENTED/REJECTED/CLOSED, IMPLEMENTED — outcome=IMPLEMENTED с сохранением результата после закрытия. Группы пересекаются с любыми другими фильтрами. includeArchived=true снимает обычное исключение архива; archived=true имеет приоритет и возвращает только архив. Эти параметры не расширяют права доступа.

GET /analytics/overview, /categories, /departments поддерживают days=7|30|90|all (по умолчанию all). Отбираются обращения с createdAt >= asOf - days × 24 часа. Все их события используются для расчёта, архив сохраняется. Новые поля overview:

- periodDays — применённый период;
- unassigned — незавершённые без исполнителя;
- onTimeShare — доля завершённых с closedAt <= dueAt; null без завершённых;
- deadlineDistribution — среди открытых: onTime (до срока больше 48 ч), approaching (до срока 0..48 ч), overdue;
- dailyTrend — до 30 временных интервалов с date и counts created/responded/completed по createdAt/firstRespondedAt/closedAt. При длинной истории интервалы могут охватывать несколько суток. Серии относятся к выбранной когорте обращений.

GET /notifications — авторизованная лента последних 50 публичных событий доступных карточек, кроме действий текущего пользователя. Ответ {data:{items:[{id,action,createdAt,actor:{name},ticket:{id,number,title}}]}}. Внутренние заметки в ленту не включаются. Серверный read-state, почта и push отсутствуют.

### Вложения

- GET /tickets/:id/attachments — {data:{items:AttachmentDto[]}}, без storageKey.
- POST /tickets/:id/attachments — multipart/form-data, один file и строковый version; только автор/обработчик открытого обращения. Ответ 201: {data:{attachment:AttachmentDto,ticket:TicketDto}}.
- GET /tickets/:id/attachments/:attachmentId — проверка доступа, затем бинарное скачивание с Content-Disposition: attachment. Архивные вложения остаются доступными.

PDF/DOCX/XLSX/JPG/PNG, максимум 10 файлов по 10 МиБ. Ограничение потока выполняется до разбора multipart. Проверяются MIME, расширение и сигнатуры; Office ZIP — структура, отсутствие макросов/вложенных объектов и пределы размера. Файлы вне public. Новые ошибки: FILE_TOO_LARGE (413), INVALID_FILE_TYPE/ATTACHMENT_LIMIT (422), INVALID_MULTIPART (400), STORAGE_UNAVAILABLE (503). Конфликт версии — 409 без записи метаданных/истории. Событие истории ATTACHMENT_ADDED содержит attachmentId, filename, size. Загрузка не считается первым ответом автору.

PATCH /categories/:id дополнительно допускает description=null для очистки описания.
