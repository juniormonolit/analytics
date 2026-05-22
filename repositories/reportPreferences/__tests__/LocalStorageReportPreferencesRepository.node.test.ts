// @vitest-environment node
/**
 * SSR-safety tests for `LocalStorageReportPreferencesRepository`.
 *
 * Runs under the `node` vitest environment so `typeof window` is truly
 * `"undefined"` — that's the precondition the repository's `isAvailable`
 * guard checks for. None of `get` / `save` / `update` / `clear` may
 * throw; reads must return `null` and writes must no-op.
 */
import { describe, expect, it } from "vitest";

import { LocalStorageReportPreferencesRepository } from "../LocalStorageReportPreferencesRepository";
import type { RepoKey } from "../types";

const KEY: RepoKey = {
  userKey: "local",
  sectionSlug: "sales",
  reportSlug: "by-managers",
};

describe("LocalStorageReportPreferencesRepository in a node environment", () => {
  it("sanity: window is undefined in this worker", () => {
    expect(typeof window).toBe("undefined");
  });

  it("get() returns null and does not throw", async () => {
    const repo = new LocalStorageReportPreferencesRepository();
    await expect(repo.get(KEY)).resolves.toBeNull();
  });

  it("save() resolves without throwing (no-op)", async () => {
    const repo = new LocalStorageReportPreferencesRepository();
    await expect(repo.save(KEY, { grouping: "team" })).resolves.toBeUndefined();
  });

  it("update() resolves without throwing (no-op)", async () => {
    const repo = new LocalStorageReportPreferencesRepository();
    await expect(
      repo.update(KEY, { grouping: "total" }),
    ).resolves.toBeUndefined();
  });

  it("clear() resolves without throwing (no-op)", async () => {
    const repo = new LocalStorageReportPreferencesRepository();
    await expect(repo.clear(KEY)).resolves.toBeUndefined();
  });

  it("save then get still returns null (writes did not persist anywhere)", async () => {
    const repo = new LocalStorageReportPreferencesRepository();
    await repo.save(KEY, { grouping: "team" });
    await expect(repo.get(KEY)).resolves.toBeNull();
  });
});
