"use client";
import Link from "next/link";
import { useAuth } from "./app-frame";
import { Icon, type IconName } from "./ui/icon";
import { PageHeading, EmptyState } from "./ui/shared";
export function SettingsHome() {
  const { actor } = useAuth();
  if (actor.role !== "ADMIN")
    return (
      <EmptyState
        title="Нет доступа к настройкам"
        text="Настройки системы доступны администратору."
      />
    );
  const rows: { title: string; text: string; icon: IconName; href: string }[] =
    [
      {
        title: "Пользователи и роли",
        text: "Сотрудники, руководители, права доступа",
        icon: "users",
        href: "/team",
      },
      {
        title: "Подразделения",
        text: "Структура компании",
        icon: "building",
        href: "/settings/departments",
      },
      {
        title: "Маршрутизация",
        text: "Кому направляются обращения",
        icon: "route",
        href: "/settings/routing",
      },
      {
        title: "Категории",
        text: "Темы обращений и их активность",
        icon: "settings",
        href: "/settings/categories",
      },
    ];
  return (
    <>
      <PageHeading
        title="Настройки системы"
        description="Управление пользователями, структурой компании и параметрами работы платформы."
        icon="settings"
      />
      <div className="settings-cards">
        {rows.map((row) => (
          <Link href={row.href} className="settings-card" key={row.href}>
            <span className="settings-card-icon">
              <Icon name={row.icon} size={36} />
            </span>
            <span>
              <h2>{row.title}</h2>
              <p>{row.text}</p>
            </span>
            <Icon name="chevron" size={25} />
          </Link>
        ))}
      </div>
    </>
  );
}
