/**
 * Tests for the `reportPreferencesRepository` singleton exported from
 * `repositories/reportPreferences/index.ts`.
 *
 * These tests pin the v1 contract: the public entry point must hand
 * back an instance of `LocalStorageReportPreferencesRepository` and
 * fully satisfy the `ReportPreferencesRepository` interface.
 */
import { describe, expect, it } from "vitest";

import { reportPreferencesRepository } from "../index";
import { LocalStorageReportPreferencesRepository } from "../LocalStorageReportPreferencesRepository";

describe("reportPreferencesRepository singleton", () => {
  it("is an instance of LocalStorageReportPreferencesRepository", () => {
    expect(reportPreferencesRepository).toBeInstanceOf(
      LocalStorageReportPreferencesRepository,
    );
  });

  it("implements the ReportPreferencesRepository interface (all four methods are functions)", () => {
    expect(typeof reportPreferencesRepository.get).toBe("function");
    expect(typeof reportPreferencesRepository.save).toBe("function");
    expect(typeof reportPreferencesRepository.update).toBe("function");
    expect(typeof reportPreferencesRepository.clear).toBe("function");
  });
});
