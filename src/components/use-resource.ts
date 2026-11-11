"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client-api";
export function useResource<T>(url: string | null) {
  const [revision, setRevision] = useState(0);
  const key = `${url}:${revision}`;
  const [state, setState] = useState<{
    key: string;
    url: string | null;
    data: T | null;
    error: string | null;
  }>({ key: "", url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    api<T>(url, { signal: controller.signal })
      .then((data) => setState({ key, url, data, error: null }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({
            key,
            url,
            data: null,
            error:
              error instanceof Error
                ? error.message
                : "Не удалось загрузить данные",
          });
      });
    return () => controller.abort();
  }, [url, key]);
  return {
    data: state.url === url ? state.data : null,
    error: state.url === url ? state.error : null,
    loading: Boolean(url) && state.key !== key,
    refresh: useCallback(() => setRevision((v) => v + 1), []),
  };
}
