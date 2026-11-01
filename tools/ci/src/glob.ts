// Шаблон пути в стиле gitignore: `*` не пересекает `/`, а `**` пересекает.
// `**` вместе с `/` допускает ноль каталогов, поэтому шаблон для файлов `.md` в любом каталоге
// подходит и к `README.md` в корне, и к `docs/a.md`.
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const rest = glob.slice(i);
    if (rest.startsWith("**/")) {
      out += "(?:.*/)?";
      i += 2;
    } else if (rest.startsWith("**")) {
      out += ".*";
      i += 1;
    } else if (rest.startsWith("*")) {
      out += "[^/]*";
    } else {
      out += (glob[i] as string).replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${out}$`);
}

export const matchesGlob = (glob: string, path: string): boolean => globToRegExp(glob).test(path);
