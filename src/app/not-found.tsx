import Link from "next/link";
export default function NotFound() {
  return <section className="panel error-card"><h1>Страница не найдена</h1><p>Проверьте адрес или вернитесь на главную страницу.</p><Link className="button button-primary" href="/">На главную</Link></section>;
}
