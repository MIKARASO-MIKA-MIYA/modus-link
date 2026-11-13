"use client";
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return <section className="panel error-card" role="alert"><h1>Не удалось открыть страницу</h1><p>Повторите загрузку страницы.</p><button type="button" className="button button-primary" onClick={retry}>Повторить</button></section>;
}
