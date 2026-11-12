"use client";
import { useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import type { Actor } from "@/types/api";
import { ApiRequestError, writeApi } from "@/lib/client-api";
import { getUsernameError, normalizeUsername } from "@/lib/usernames";
import { Brand, Icon, type IconName } from "./ui/icon";
import { ErrorNotice } from "./ui/shared";
export function LoginScreen({ onLogin }: { onLogin: (actor: Actor) => void }) {
 const [selection, setSelection] = useState<string | null>(null);
 const [mode, setMode] = useState<"login" | "register">("login");
 const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState("");
 const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
 const [usernameError, setUsernameError] = useState<string | null>(null);
 const registering = mode === "register";
 const choices: { key: string; name: string; icon: IconName; description: string }[] = [
  { key: "employee", name: "Сотрудник", icon: "user", description: "Создавайте обращения и отслеживайте их статус" },
  { key: "manager", name: "Руководитель", icon: "users", description: "Рассматривайте обращения, назначайте ответственных" },
  { key: "admin", name: "Администратор", icon: "settings", description: "Настройка системы, пользователей и маршрутизации" },
 ];
 function select(key: string, nextMode: "login" | "register" = "login") { setSelection(key); setMode(nextMode); setUsername(""); setPassword(""); setConfirmation(""); setError(null); setUsernameError(null); }
 function switchMode(next: "login" | "register") { setMode(next); setPassword(""); setConfirmation(""); setError(null); setUsernameError(null); }
 return <div className="login-page"><ThemeToggle login /><div className="login-decoration login-decoration-one" /><div className="login-decoration login-decoration-two" /><div className="login-building" aria-hidden="true"><svg viewBox="0 0 420 500"><path d="M0 500V150L240 0v500M0 220 240 70M0 290l240-150M0 360l240-150M0 430l240-150M60 110v390m60-430v430m60-470v470M240 130l180 100v270M240 200l180 100m-180-30 180 100m-180-30 180 100M300 164v336m60-300v300" /></svg></div><main className="login-layout"><div className="login-intro"><Brand /><h1>Каждая идея<br />имеет значение.</h1><p>Платформа обратной связи<br />и предложений сотрудников</p><span className="company-sign">ГК «Модус Трейд»</span></div><section className="login-card">
 {selection ? <><button className="back-link" type="button" disabled={busy} onClick={() => { setSelection(null); setPassword(""); setConfirmation(""); setError(null); }}><Icon name="back" size={18} />Выбрать кабинет</button><h2>{registering ? "Создать аккаунт" : "Добро пожаловать"}</h2><p className="muted">{registering ? "Придумайте ник и пароль для входа" : "Войдите по своему нику и паролю"}</p>{selection === "employee" && <div className="login-tabs" aria-label="Вход или регистрация"><button type="button" className={!registering ? "active" : ""} disabled={busy} onClick={() => switchMode("login")} aria-pressed={!registering}>Вход</button><button type="button" className={registering ? "active" : ""} disabled={busy} onClick={() => switchMode("register")} aria-pressed={registering}>Создать аккаунт</button></div>}<form className="form-stack" onSubmit={async e => {
 e.preventDefault(); setError(null);
 const nickname = normalizeUsername(username);
 const nicknameError = getUsernameError(nickname);
 setUsernameError(nicknameError);
 if (nicknameError) return;
 if (registering && password !== confirmation) { setError("Пароли не совпадают. Повторите придуманный пароль."); return; }
 setBusy(true);
 try { const actor = await writeApi<Actor>(registering ? "auth/register" : "auth/login", { username: nickname, password }); setPassword(""); setConfirmation(""); onLogin(actor); }
 catch (err) {
  const nicknameIssue = err instanceof ApiRequestError ? err.details?.find(detail => detail.path === "username") : undefined;
  if (err instanceof ApiRequestError && err.code === "USERNAME_TAKEN") setUsernameError("Этот ник занят. Попробуйте другой.");
  else if (nicknameIssue) setUsernameError(nicknameIssue.message);
  else setError(err instanceof ApiRequestError && err.details?.length ? err.details.map(d => d.message).join(". ") : err instanceof Error ? err.message : "Не удалось войти");
 }
 finally { setBusy(false); }
 }}>
 <ErrorNotice message={error} />
 <label>
  {registering ? "Придумайте ник" : "Ник"}
  <input
   name="username" type="text" autoComplete="username" autoCapitalize="none"
   autoCorrect="off" spellCheck={false} autoFocus required minLength={3} maxLength={32}
   value={username}
   onChange={e => { setUsername(e.target.value); setUsernameError(null); setError(null); }}
   placeholder={registering ? undefined : "Введите свой ник"}
   disabled={busy} aria-invalid={Boolean(usernameError)}
   aria-describedby={usernameError ? "username-help" : undefined}
  />
  {usernameError && (
   <span className="form-help form-help-error" id="username-help" role="alert">{usernameError}</span>
  )}
 </label>
 <label>{registering ? "Придумайте пароль" : "Пароль"}<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} required minLength={registering ? 12 : 1} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} placeholder={registering ? "Не менее 12 символов" : "Введите свой пароль"} disabled={busy} /></label>{registering && <label>Повторите пароль<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Введите придуманный пароль ещё раз" disabled={busy} /></label>}<button className="button button-primary" disabled={busy}>{busy ? registering ? "Создаём аккаунт…" : "Входим…" : registering ? "Создать аккаунт" : "Войти в кабинет"}<Icon name="arrow" size={19} /></button></form><p className="login-footnote">{registering ? "Вы получите кабинет сотрудника. После выхода входите по этому же нику и паролю." : "Используйте ник и пароль, которые выбрали при регистрации."}</p></> : <><h2>Войти как?</h2><p className="muted login-subtitle">Выберите свой рабочий кабинет</p><div className="login-choices">{choices.map(choice => <button key={choice.key} className="login-choice" onClick={() => select(choice.key)}><span className="login-choice-icon"><Icon name={choice.icon} size={29} /></span><span><strong>{choice.name}</strong><small>{choice.description}</small></span><Icon name="arrow" size={19} /></button>)}</div><button className="registration-entry" onClick={() => select("employee", "register")}>Впервые здесь? <strong>Создать аккаунт</strong><Icon name="arrow" size={16} /></button><button className="owner-entry" onClick={() => select("owner")}><Icon name="chart" size={17} />Кабинет собственника<Icon name="arrow" size={16} /></button></>}
 </section></main><div className="login-bottom">MODUS LINK <span>Вместе улучшаем компанию</span></div></div>;
}
