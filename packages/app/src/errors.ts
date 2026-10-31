import { CoreException } from "@app/core-api";

/** Текст для пользователя. Причину берём из `kind`, а не из текста исключения: он зависит от платформы. */
export function describeError(error: unknown): string {
  if (error instanceof CoreException) {
    const cause = error.error;
    switch (cause.kind) {
      case "invalidPath":
        return `Недопустимый путь: ${cause.path}`;
      case "io":
        return `Ошибка файла: ${cause.message}`;
      case "network":
        return `Ошибка сети: ${cause.message}`;
      case "status":
        return `Сервер ответил кодом ${cause.code}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}
