# 0021. Source API documentation without a generated site

Status: accepted (2026-11-02)

[Русская версия](0021-source-api-docs-without-generated-site.ru.md)

Supersedes [ADR-0020](0020-bilingual-docs-and-api-reference.md).

## Context

ADR-0020 introduced a TypeDoc/Rustdoc website and GitHub Pages alongside bilingual source
documentation. The site adds a separate TypeScript version, generated-output configuration, CI
system dependencies, and a publication target. It duplicates what package ecosystems and editors
already provide, while the repository does not yet publish crates or npm packages.

## Decision

1. **The bilingual source policy remains.** English Markdown is canonical, Russian versions use
   `.ru.md`, ordinary `//` comments remain Russian, and new Rustdoc/TSDoc comments are English.
   The language-pair consistency test and incremental migration remain unchanged.
2. **There is no standalone API website.** The `docs` scripts, TypeDoc workspace and catalog entry,
   TypeDoc configuration, API-site home pages, and GitHub Pages workflow are removed. Generated HTML
   is neither committed nor published by this repository.
3. **API documentation stays with package sources.** For a future crates.io release, docs.rs builds
   Rustdoc from the published crate. TSDoc remains in TypeScript sources and declaration output when
   npm package builds are introduced, providing editor quick info without TypeDoc.
4. **Publishing is a separate decision.** This change does not make packages public or add release
   pipelines. Existing Rust `publish = false` and npm `private: true` settings remain unchanged.

## Alternatives

- **Keep the generated site.** It provides centralized search, but costs dependencies and CI time
  and duplicates docs.rs and editor documentation.
- **Commit generated HTML.** It works without a release workflow, but generated diffs are large and
  become stale immediately.
- **Remove API comments too.** This would simplify source text but discard documentation needed by
  docs.rs, declaration consumers, and IDE quick info.
- **Add crates/npm publishing now.** It would combine unrelated release policy and package design
  with infrastructure removal; it belongs in dedicated issues.

## Consequences

- (+) TypeDoc, its isolated TypeScript version, native Rustdoc CI dependencies, and Pages setup are
  no longer maintained.
- (+) Bilingual guides and English API comments remain useful without generated artifacts.
- (−) The repository no longer offers a centralized searchable API website.
- (−) docs.rs documentation appears only for crates that are eventually published; npm quick info
  depends on the future package build preserving TSDoc in declarations.
