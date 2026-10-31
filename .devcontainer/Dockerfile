# Образ разработки: Linux (Debian) со всем, что нужно проекту. Контекст сборки — корень репозитория.
# Версии не пишутся здесь: Rust берётся из rust-toolchain.toml, wasm-bindgen-cli из Cargo.lock,
# системные пакеты из tools/system-deps/debian.txt (тот же список использует CI).
# bun и rustup копируются из официальных образов с закреплённым тегом: без `curl | sh`. Node.js в образе нет и не нужен.
ARG BUN_VERSION
FROM oven/bun:${BUN_VERSION} AS bun
FROM rust:1-bookworm AS rustup

FROM mcr.microsoft.com/devcontainers/base:bookworm

COPY tools/system-deps/debian.txt /tmp/debian.txt
RUN apt-get update \
 && xargs -a /tmp/debian.txt apt-get install -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/* /tmp/debian.txt

COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
COPY --from=rustup /usr/local/rustup /usr/local/rustup
COPY --from=rustup /usr/local/cargo /usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:${PATH}

# Тулчейн по rust-toolchain.toml (версия, таргет wasm32, компоненты) и CLI той же версии, что крейт в Cargo.lock.
WORKDIR /tmp/toolchain
COPY rust-toolchain.toml Cargo.lock ./
RUN rustup toolchain install \
 && cargo install wasm-bindgen-cli --locked \
      --version "$(sed -n '/^name = "wasm-bindgen"$/{n;s/version = "\(.*\)"/\1/p}' Cargo.lock)" \
 && chown -R vscode:vscode /usr/local/rustup /usr/local/cargo

WORKDIR /
