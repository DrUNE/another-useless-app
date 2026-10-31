/** Порт файловой системы. Пути — строки в формате конкретной платформы. */
export interface Fs {
  readText(path: string): Promise<string>;
  readBytes(path: string): Promise<Uint8Array>;
  writeText(path: string, data: string): Promise<void>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
  /** Создаёт каталог вместе с родителями; без ошибки, если он уже есть. */
  mkdir(path: string): Promise<void>;
  readDir(path: string): Promise<FsEntry[]>;
  remove(path: string): Promise<void>;
  /** Корневой каталог данных приложения: от него фичи строят свои пути. */
  appDataDir(): Promise<string>;
}

export interface FsEntry {
  name: string;
  isDirectory: boolean;
}
