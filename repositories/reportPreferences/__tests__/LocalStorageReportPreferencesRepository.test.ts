/**
 * Tests for `LocalStorageReportPreferencesRepository`.
 *
 * Default vitest environment (jsdom) gives us `window.localStorage`. The
 * SSR-safety case lives in a sibling `*.node.test.ts` file because
 * `// @vitest-environment` is a per-file pragma in Vitest.
 *
 * Each test starts with a clean `localStorage` (cleared globally in
 * `vitest.setup.ts`) so cases stay independent.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { LocalStorageReportPreferencesRepository } from "../LocalStorageReportPreferencesRepository";
import type { ReportPreferences, RepoKey } from "../types";

const makeRepo = () => new LocalStorageReportPreferencesRepository();

const KEY: RepoKey = {
  userKey: "local",
  sectionSlug: "sales",
  reportSlug: "by-managers",
};

const STORAGE_KEY = "bi.prefs.local.sales.by-managers";

const fullPrefs: ReportPreferences = {
  metricIds: ["incoming_deals_count", "won_deals_amount"],
  columnOrder: ["manager_name", "incoming_deals_count"],
  hiddenColumns: [],
  columnWidths: { manager_name: 220 },
  grouping: "team",
  sort: { columnId: "metric:incoming_deals_count.current", direction: "desc" },
};

beforeEach(() => {
  // vitest.setup.ts already clears localStorage; this is a belt-and-
  // suspenders guard in case the global setup is changed later.
  window.localStorage.clear();
});

describe("get()", () => {
  it("returns null when nothing has been saved for the key", async () => {
    const repo = makeRepo();
    expect(await repo.get(KEY)).toBeNull();
  });

  it("returns the saved prefs (with prefsVersion stripped from the result)", async () => {
    const repo = makeRepo();
    await repo.save(KEY, fullPrefs);

    const result = await repo.get(KEY);
    expect(result).toEqual(fullPrefs);
    expect(result).not.toHaveProperty("prefsVersion");
  });

  it("returns null when the stored payload is malformed JSON", async () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const repo = makeRepo();
    expect(await repo.get(KEY)).toBeNull();
  });

  it("returns null when the stored payload has an unrecognized prefsVersion", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...fullPrefs, prefsVersion: 999 }),
    );
    const repo = makeRepo();
    expect(await repo.get(KEY)).toBeNull();
  });

  it("returns null when the stored payload has no prefsVersion at all", async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPrefs));
    const repo = makeRepo();
    expect(await repo.get(KEY)).toBeNull();
  });
});

describe("save()", () => {
  it("writes a JSON string under the namespaced key bi.prefs.<user>.<section>.<report>", async () => {
    const repo = makeRepo();
    await repo.save(KEY, fullPrefs);

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(typeof raw).toBe("string");
    expect(() => JSON.parse(raw as string)).not.toThrow();
  });

  it("uses exactly bi.prefs.local.sales.by-managers for the documented userKey/section/report", async () => {
    const repo = makeRepo();
    await repo.save(KEY, fullPrefs);

    // Spot-check the *exact* storage key.
    const keys = Object.keys(window.localStorage);
    expect(keys).toEqual(["bi.prefs.local.sales.by-managers"]);
  });

  it("adds prefsVersion: 1 to the stored payload", async () => {
    const repo = makeRepo();
    await repo.save(KEY, fullPrefs);

    const raw = window.localStorage.getItem(STORAGE_KEY) as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.prefsVersion).toBe(1);
  });

  it("round-trips a partial payload (only the fields the caller passed in)", async () => {
    const repo = makeRepo();
    await repo.save(KEY, { grouping: "total" });

    const raw = window.localStorage.getItem(STORAGE_KEY) as string;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed).toEqual({ grouping: "total", prefsVersion: 1 });
  });

  it("overwrites the previous record entirely (full-replace semantics)", async () => {
    const repo = makeRepo();
    await repo.save(KEY, fullPrefs);
    await repo.save(KEY, { metricIds: ["only_one"] });

    expect(await repo.get(KEY)).toEqual({ metricIds: ["only_one"] });
  });
});

describe("update()", () => {
  it("merges the patch with the existing record (sibling fields preserved)", async () => {
    const repo = makeRepo();
    await repo.save(KEY, {
      metricIds: ["incoming_deals_count", "won_deals_amount"],
      grouping: "none",
    });

    await repo.update(KEY, { grouping: "team" });

    expect(await repo.get(KEY)).toEqual({
      metricIds: ["incoming_deals_count", "won_deals_amount"],
      grouping: "team",
    });
  });

  it("creates a fresh record when nothing exists yet", async () => {
    const repo = makeRepo();
    await repo.update(KEY, { grouping: "total" });
    expect(await repo.get(KEY)).toEqual({ grouping: "total" });
  });

  it("treats unrecognized-version records as missing (drops then writes the patch)", async () => {
    // A v999 record exists. update() reads via get() (which returns null
    // for unknown versions) and writes a brand-new record.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        metricIds: ["should_be_dropped"],
        prefsVersion: 999,
      }),
    );
    const repo = makeRepo();
    await repo.update(KEY, { grouping: "team" });

    expect(await repo.get(KEY)).toEqual({ grouping: "team" });
  });
});

describe("clear()", () => {
  it("removes only the targeted key (other keys survive)", async () => {
    const repo = makeRepo();
    const otherKey: RepoKey = { ...KEY, reportSlug: "by-product-groups" };

    await repo.save(KEY, fullPrefs);
    await repo.save(otherKey, { grouping: "total" });

    await repo.clear(KEY);

    expect(await repo.get(KEY)).toBeNull();
    expect(await repo.get(otherKey)).toEqual({ grouping: "total" });
  });

  it("is a no-op when the key does not exist", async () => {
    const repo = makeRepo();
    await expect(repo.clear(KEY)).resolves.toBeUndefined();
  });
});

describe("namespaced storage keys", () => {
  it("different userKey produces a different storage key", async () => {
    const repo = makeRepo();
    await repo.save({ ...KEY, userKey: "local" }, { grouping: "team" });
    await repo.save({ ...KEY, userKey: "alice" }, { grouping: "total" });

    expect(window.localStorage.getItem("bi.prefs.local.sales.by-managers")).not
      .toBeNull();
    expect(window.localStorage.getItem("bi.prefs.alice.sales.by-managers")).not
      .toBeNull();
    // Two distinct entries.
    expect(Object.keys(window.localStorage).sort()).toEqual([
      "bi.prefs.alice.sales.by-managers",
      "bi.prefs.local.sales.by-managers",
    ]);
  });

  it("different sectionSlug produces a different storage key", async () => {
    const repo = makeRepo();
    await repo.save({ ...KEY, sectionSlug: "sales" }, { grouping: "team" });
    await repo.save(
      { ...KEY, sectionSlug: "marketing" },
      { grouping: "total" },
    );

    expect(window.localStorage.getItem("bi.prefs.local.sales.by-managers")).not
      .toBeNull();
    expect(
      window.localStorage.getItem("bi.prefs.local.marketing.by-managers"),
    ).not.toBeNull();
  });

  it("different reportSlug produces a different storage key", async () => {
    const repo = makeRepo();
    await repo.save({ ...KEY, reportSlug: "by-managers" }, { grouping: "team" });
    await repo.save(
      { ...KEY, reportSlug: "by-product-groups" },
      { grouping: "total" },
    );

    expect(window.localStorage.getItem("bi.prefs.local.sales.by-managers")).not
      .toBeNull();
    expect(
      window.localStorage.getItem("bi.prefs.local.sales.by-product-groups"),
    ).not.toBeNull();
  });
});
