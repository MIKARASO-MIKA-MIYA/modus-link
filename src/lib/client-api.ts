import type { ApiError, ApiSuccess, PageDto } from "@/types/api";
export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api/v1/${path}`, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  let payload: ApiError | ApiSuccess<T>;
  try {
    payload = await res.json();
  } catch {
    throw new ApiRequestError(
      res.status,
      "NETWORK_ERROR",
      "Не удалось получить ответ сервера. Повторите попытку.",
    );
  }
  if ("error" in payload) {
    if (
      res.status === 401 &&
      path !== "auth/login" &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("modus:session-expired"));
    throw new ApiRequestError(
      res.status,
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }
  if (!res.ok)
    throw new ApiRequestError(
      res.status,
      "REQUEST_FAILED",
      "Не удалось выполнить запрос",
    );
  return payload.data;
}
export const writeApi = <T>(path: string, body: unknown, method = "POST") =>
  api<T>(path, { method, body: JSON.stringify(body) });
export async function allPages<T>(path: string, signal?: AbortSignal) {
  const separator = path.includes("?") ? "&" : "?";
  const first = await api<PageDto<T>>(`${path}${separator}pageSize=100`, {
    signal,
  });
  const items = [...first.items];
  for (let page = 2; page <= first.pagination.totalPages; page++)
    items.push(
      ...(
        await api<PageDto<T>>(`${path}${separator}pageSize=100&page=${page}`, {
          signal,
        })
      ).items,
    );
  return items;
}
