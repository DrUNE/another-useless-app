import type { Fs, FsEntry } from "@app/platform";

/** Пути относительны корню OPFS (Origin Private File System), разделитель — "/". */
function segments(path: string): string[] {
  const parts = path.split("/").filter((s) => s !== "" && s !== ".");
  if (parts.includes("..")) throw new Error(`Path must not contain "..": ${path}`);
  return parts;
}

const isMissing = (e: unknown) =>
  e instanceof DOMException && (e.name === "NotFoundError" || e.name === "TypeMismatchError");

export function createOpfsFs(): Fs {
  const root = () => navigator.storage.getDirectory();

  async function dir(parts: string[], create: boolean) {
    let handle = await root();
    for (const part of parts) handle = await handle.getDirectoryHandle(part, { create });
    return handle;
  }

  async function splitPath(path: string) {
    const parts = segments(path);
    const name = parts.pop();
    if (name === undefined) throw new Error(`Path has no file name: "${path}"`);
    return { parts, name };
  }

  async function file(path: string, create: boolean) {
    const { parts, name } = await splitPath(path);
    return (await dir(parts, create)).getFileHandle(name, { create });
  }

  async function readBytes(path: string) {
    const f = await (await file(path, false)).getFile();
    return new Uint8Array(await f.arrayBuffer());
  }

  async function writeBytes(path: string, data: Uint8Array) {
    const writable = await (await file(path, true)).createWritable();
    try {
      // Копия нужна для типов: в BufferSource допускается только ArrayBuffer-backed массив.
      await writable.write(new Uint8Array(data));
      await writable.close();
    } catch (e) {
      // Запись идёт во временный файл и применяется на close(): при ошибке откатываем её целиком.
      await writable.abort();
      throw e;
    }
  }

  return {
    readBytes,
    writeBytes,
    async readText(path) {
      return new TextDecoder().decode(await readBytes(path));
    },
    async writeText(path, data) {
      await writeBytes(path, new TextEncoder().encode(data));
    },
    async exists(path) {
      const parts = segments(path);
      const name = parts.pop();
      if (name === undefined) return true;
      try {
        const parent = await dir(parts, false);
        for (const get of [() => parent.getFileHandle(name), () => parent.getDirectoryHandle(name)]) {
          try {
            await get();
            return true;
          } catch (e) {
            if (!isMissing(e)) throw e;
          }
        }
        return false;
      } catch (e) {
        if (isMissing(e)) return false;
        throw e;
      }
    },
    async mkdir(path) {
      await dir(segments(path), true);
    },
    async readDir(path): Promise<FsEntry[]> {
      const entries: FsEntry[] = [];
      for await (const [name, handle] of (await dir(segments(path), false)).entries()) {
        entries.push({ name, isDirectory: handle.kind === "directory" });
      }
      return entries;
    },
    async remove(path) {
      const { parts, name } = await splitPath(path);
      await (await dir(parts, false)).removeEntry(name, { recursive: true });
    },
    // В OPFS нет «домашних» каталогов: корень и есть хранилище приложения.
    async appDataDir() {
      return "";
    },
  };
}
