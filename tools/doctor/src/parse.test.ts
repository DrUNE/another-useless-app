import { describe, expect, it } from "vitest";

import {
  distroFamily,
  lockedVersion,
  packageManagerVersion,
  readPackageList,
  toolchainChannel,
  versionFromOutput,
} from "./parse";

const LOCK = `[[package]]
name = "wasm-bindgen"
version = "0.2.130"
source = "registry+https://github.com/rust-lang/crates.io-index"

[[package]]
name = "wasm-bindgen-futures"
version = "0.4.80"
`;

describe("lockedVersion", () => {
  it("finds the exact crate and not a crate with the same prefix", () => {
    expect(lockedVersion(LOCK, "wasm-bindgen")).toBe("0.2.130");
    expect(lockedVersion(LOCK, "wasm-bindgen-futures")).toBe("0.4.80");
  });
  it("returns undefined for a missing crate and handles CRLF", () => {
    expect(lockedVersion(LOCK, "serde")).toBeUndefined();
    expect(lockedVersion(LOCK.replaceAll("\n", "\r\n"), "wasm-bindgen")).toBe("0.2.130");
  });
});

describe("version sources", () => {
  it("reads bun from packageManager and ignores other managers", () => {
    expect(packageManagerVersion('{"packageManager":"bun@1.4.4"}')).toBe("1.4.4");
    expect(packageManagerVersion('{"packageManager":"pnpm@9.0.0"}')).toBeUndefined();
    expect(packageManagerVersion("{}")).toBeUndefined();
  });
  it("reads the Rust channel", () => {
    expect(toolchainChannel('[toolchain]\nchannel = "1.99.1"\n')).toBe("1.99.1");
    expect(toolchainChannel("[toolchain]\n")).toBeUndefined();
  });
  it("extracts a version from tool output", () => {
    expect(versionFromOutput("rustc 1.99.1 (58cf8f9c3 2026-10-13)")).toBe("1.99.1");
    expect(versionFromOutput("wasm-bindgen 0.2.130\n")).toBe("0.2.130");
    expect(versionFromOutput("no digits here")).toBeUndefined();
  });
});

describe("distroFamily", () => {
  it("recognises Debian-like and ALT systems", () => {
    expect(distroFamily('ID=ubuntu\nID_LIKE="debian"\n')).toBe("debian");
    expect(distroFamily("ID=debian\n")).toBe("debian");
    expect(distroFamily('NAME="ALT"\nID=altlinux\n')).toBe("alt");
    expect(distroFamily("ID=fedora\nID_LIKE=rhel\n")).toBe("other");
    expect(distroFamily("")).toBe("other");
  });
});

describe("readPackageList", () => {
  it("skips blank lines and comments", () => {
    expect(readPackageList("a\n\n# comment\nb # inline\n")).toEqual(["a", "b"]);
  });
});
