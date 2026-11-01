import { describe, expect, it } from "vitest";

import readScenarioData from "../contract/read-scenarios.json" with { type: "json" };
import scenarioData from "../contract/scenarios.json" with { type: "json" };
import { type Core, CoreException } from "./index";

/**
 * Контрактные сценарии: данные в `contract/scenarios.json`, а не код. Их читают и TS-тесты (WASM на настоящем
 * Rust-ядре), и Rust-тесты IPC Tauri, поэтому «обе реализации ведут себя одинаково» проверяется, а не декларируется.
 */
export interface ContractScenario {
  name: string;
  path: string;
  http: { status: number; body: string } | { fail: true };
  fs?: { writeFails?: boolean };
  expect: {
    ok?: { path: string; bytes: number };
    /** Частичное совпадение: перечисленные поля обязаны совпасть, остальные (например, текст ошибки ОС) не проверяются. */
    error?: Record<string, unknown>;
    written?: boolean;
    httpContacted?: boolean;
  };
}

export const scenarios = scenarioData as ContractScenario[];
export const readFileScenarios = readScenarioData as ReadFileContractScenario[];

export interface Harness {
  core: Core;
  /** Адрес, который реализация передаёт в `saveUrl`. */
  url: string;
  /** Что окружение видело. Если не задано, проверки `written` и `httpContacted` пропускаются. */
  observe?(): { written: boolean; httpContacted: boolean };
}

export interface ContractTarget {
  /** Готовит окружение под сценарий (ответ сервера, поведение файловой системы) и возвращает ядро. */
  arrange(scenario: ContractScenario): Promise<Harness> | Harness;
}

export function defineCoreContract(name: string, target: ContractTarget): void {
  describe(`Core contract: ${name}`, () => {
    for (const scenario of scenarios) {
      it(scenario.name, async () => {
        const harness = await target.arrange(scenario);
        const outcome = await harness.core.saveUrl(harness.url, scenario.path).then(
          (report) => ({ report }),
          (error: unknown) => ({ error }),
        );

        if (scenario.expect.ok !== undefined) {
          expect(outcome).toEqual({ report: scenario.expect.ok });
        } else {
          expect("error" in outcome ? outcome.error : undefined).toBeInstanceOf(CoreException);
          const exception = (outcome as { error: CoreException }).error;
          expect(exception.error).toMatchObject(scenario.expect.error ?? {});
        }

        const seen = harness.observe?.();
        if (seen !== undefined) {
          if (scenario.expect.written !== undefined)
            expect(seen.written).toBe(scenario.expect.written);
          if (scenario.expect.httpContacted !== undefined) {
            expect(seen.httpContacted).toBe(scenario.expect.httpContacted);
          }
        }
      });
    }
  });
}

export interface ReadFileContractScenario {
  name: string;
  path: string;
  file: { body: string } | { readFails: true };
  expect: {
    ok?: { bytes: number[] };
    error?: Record<string, unknown>;
    readAttempted?: boolean;
  };
}

export interface ReadFileHarness {
  core: Core;
  observe?(): { readAttempted: boolean };
}

export interface ReadFileContractTarget {
  arrange(scenario: ReadFileContractScenario): Promise<ReadFileHarness> | ReadFileHarness;
}

export function defineReadFileContract(name: string, target: ReadFileContractTarget): void {
  describe(`Core readFile contract: ${name}`, () => {
    for (const scenario of readFileScenarios) {
      it(scenario.name, async () => {
        const harness = await target.arrange(scenario);
        const outcome = await harness.core.readFile(scenario.path).then(
          (report) => ({ report }),
          (error: unknown) => ({ error }),
        );

        if (scenario.expect.ok !== undefined) {
          expect("report" in outcome ? Array.from(outcome.report) : undefined).toEqual(
            scenario.expect.ok.bytes,
          );
        } else {
          expect("error" in outcome ? outcome.error : undefined).toBeInstanceOf(CoreException);
          const exception = (outcome as { error: CoreException }).error;
          expect(exception.error).toMatchObject(scenario.expect.error ?? {});
        }

        if (scenario.expect.readAttempted !== undefined) {
          expect(harness.observe?.().readAttempted).toBe(scenario.expect.readAttempted);
        }
      });
    }
  });
}
