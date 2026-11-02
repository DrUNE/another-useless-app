# 0020. Bilingual documentation and generated English API references

Status: accepted (2026-11-02)

[Русская версия](0020-bilingual-docs-and-api-reference.ru.md)

## Context

The project documentation must be available in Russian and English. Ordinary code comments should
remain Russian, but release API references and quick function documentation must be English.
There is no documentation release workflow, and TypeScript has no documentation generator installed.
A two-language process must not duplicate generated artifacts or require rewriting accepted ADRs.

## Decision

1. **English is the default documentation language.** New Markdown documents use the usual name
   (`README.md`, `docs/adr/0020-*.md`), and the Russian translation is placed next to it with the
   `.ru.md` suffix. Files whose names are fixed by GitHub may contain both languages in one file.
   Every new document has both versions and cross-links. Existing Russian-only files are migrated
   in separate PRs; the consistency test has an explicit legacy allowlist. Accepted ADR decisions
   are not rewritten: translations are added as new language variants.
2. **Code comments and API comments are different.** Ordinary `//` comments stay Russian. New
   Rustdoc (`///`, `//!`) and TSDoc (`/** ... */`) comments are English. Existing API comments are
   migrated separately. Generated files such as `bindings.ts` are not edited by hand.
3. **API HTML is generated locally and on release.** `bun run docs` builds the WASM boundary, runs
   `cargo doc --workspace --no-deps` for every Rust crate and TypeDoc for TS packages, applications,
   tools, and E2E tests. TypeDoc uses `entryPointStrategy: "packages"` and a pinned catalog version.
   Output goes to the ignored `target/docs` directory.
4. **GitHub Pages is the publication target.** A release workflow uploads the generated site to
   GitHub Pages. Generated HTML is never committed. A manual workflow trigger is allowed for
   verification and recovery.
5. **Pairs are checked mechanically, translations are reviewed by people.** The consistency test
   checks that every non-legacy document has both language versions. It cannot prove that the
   translations are equivalent or current.

## Alternatives

- **English only or Russian only.** Simpler, but excludes part of the intended audience and does
  not meet the release requirement.
- **Both languages in every file.** No naming convention is needed, but long documents become hard
  to read and edit; language-specific links are impossible. GitHub-specific files may be the
  exception.
- **Translate everything in one PR.** It would mix infrastructure with hundreds of translation
  changes and make review unreliable. Incremental migration keeps the policy enforceable from the
  first PR.
- **Commit generated HTML.** Direct links are convenient, but generated diffs are large and become
  stale immediately. CI artifacts and GitHub Pages are publication outputs, not source files.
- **Machine translation in CI.** It would create unaudited semantic drift. Translations are written
  and reviewed as source documents.

## Consequences

- (+) New human documentation is bilingual by default, and API search/quick references have one
  English source suitable for releases.
- (+) Local and release generation use the same command and tools already pinned by the repository.
- (+) Legacy documents do not block the policy: new unpaired files fail the consistency test.
- (−) Every documentation change requires two translations and review of both.
- (−) The pair test does not detect stale or low-quality translations.
- (−) GitHub Pages must be enabled for the repository, and the workflow needs Pages permissions.
- (−) Existing Russian API comments remain in generated output until their dedicated migration PRs.
