export interface RustRule {
  crate: string;
  /** "host" — платформа, на которой идёт проверка; иначе целевая тройка (например, wasm32-unknown-unknown). */
  target: string;
  /** Исчерпывающий список прямых зависимостей (кроме dev и build). Любая другая — нарушение. */
  directOnly?: string[];
  /** Крейты, которых не должно быть среди всех (прямых и транзитивных) зависимостей. */
  forbidTransitive?: string[];
  why: string;
}

export interface TsRule {
  package: string;
  /** Исчерпывающий список `dependencies` (рантайм). devDependencies правило не ограничивает. */
  directOnly?: string[];
  /** Имена или шаблоны (`@tauri-apps/*`), которых не должно быть среди зависимостей, в т.ч. через другие пакеты воркспейса. */
  forbidTransitive?: string[];
  why: string;
}

export interface Rules {
  rust: RustRule[];
  ts: TsRule[];
}

export interface Violation {
  /** Кого проверяли: крейт или пакет. */
  subject: string;
  /** Что именно не так. */
  message: string;
  /** Почему правило существует. */
  why: string;
}
