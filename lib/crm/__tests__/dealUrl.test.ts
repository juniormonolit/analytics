import { describe, expect, it } from "vitest";

import { buildDealCrmUrl } from "../dealUrl";

describe("buildDealCrmUrl", () => {
  it("builds a Monolit CRM deal details URL", () => {
    expect(buildDealCrmUrl(12345)).toBe(
      "https://td.monolit-crm.ru/crm/deal/details/12345/",
    );
  });
});
