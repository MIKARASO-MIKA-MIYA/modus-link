export const normalizeUsername = (value: string) =>
  value.normalize("NFKC").trim().replace(/ +/g, " ").toLowerCase();

export const usernamePattern = /^[\p{L}\p{N}_. -]{3,32}$/u;

export function getUsernameError(value: string): string | null {
  const username = normalizeUsername(value);
  if (username.length < 3) return "Введите хотя бы 3 символа.";
  if (username.length > 32) return "Ник слишком длинный — максимум 32 символа.";
  if (!usernamePattern.test(username))
    return "Используйте буквы, цифры, пробелы или . _ -";
  return null;
}
